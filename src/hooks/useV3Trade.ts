import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Pool, Route, Trade, SwapRouter, FeeAmount, encodeRouteToPath } from '@uniswap/v3-sdk';
import {
  V3_FACTORY_ADDRESS,
  V3_SWAP_ROUTER_ADDRESS,
  V3_QUOTER_ADDRESS,
  V3_FACTORY_ABI,
  V3_POOL_ABI,
  ERC20_ABI,
  DEFAULT_SLIPPAGE,
  MIN_LIQUIDITY_THRESHOLD,
  WETH_ADDRESS,
} from '@/utils/constants';
import { calculateDeadline } from '@/utils/helpers';
import type { V3PoolInfo, V3TradeResult, TradeRoute } from '@/types/uniswap';
import { getRouteBridgeTokens } from '@/utils/routeTokens';

interface V3TradeState {
  trade: Trade<Token, Token, TradeType> | null;
  pool: Pool | null;
  route: TradeRoute | null;
  isCalculating: boolean;
  error: string | null;
}

interface V3RouteCandidate {
  route: Route<Token, Token>;
  trade: Trade<Token, Token, TradeType>;
  pools: V3PoolInfo[];
  quotedAmountOut: ethers.BigNumber;
}

export const useV3Trade = (
  provider: ethers.providers.Web3Provider | null,
  signer: ethers.Signer | null,
  readOnlyProvider: ethers.providers.JsonRpcProvider
) => {
  const [tradeState, setTradeState] = useState<V3TradeState>({
    trade: null,
    pool: null,
    route: null,
    isCalculating: false,
    error: null,
  });

  const findPool = useCallback(
    async (tokenA: Token, tokenB: Token): Promise<V3PoolInfo | null> => {
      if (!provider) {
        if (!readOnlyProvider) {
          return null;
        }
      }
      const quoteProvider = provider ?? readOnlyProvider;

      const factory = new ethers.Contract(V3_FACTORY_ADDRESS, V3_FACTORY_ABI, quoteProvider);
      const feeTiers = [FeeAmount.MEDIUM, FeeAmount.LOW, FeeAmount.HIGH, FeeAmount.LOWEST];

      for (const fee of feeTiers) {
        try {
          const poolAddress = await factory.getPool(tokenA.address, tokenB.address, fee);
          
          if (poolAddress === ethers.constants.AddressZero) {
            continue;
          }

          const poolContract = new ethers.Contract(poolAddress, V3_POOL_ABI, quoteProvider);
          
          const [token0, , liquidity, slot0] = await Promise.all([
            poolContract.token0(),
            poolContract.token1(),
            poolContract.liquidity(),
            poolContract.slot0(),
          ]);

          if (liquidity.toString() === '0' || BigInt(liquidity.toString()) < BigInt(MIN_LIQUIDITY_THRESHOLD)) {
            continue;
          }

          const [token0Obj, token1Obj] = token0.toLowerCase() === tokenA.address.toLowerCase()
            ? [tokenA, tokenB]
            : [tokenB, tokenA];

          // V3 Pool constructor requires ticks array (can be empty for basic swaps)
          const pool = new Pool(
            token0Obj,
            token1Obj,
            fee,
            slot0.sqrtPriceX96.toString(),
            liquidity.toString(),
            slot0.tick,
            [] // Empty ticks array - sufficient for basic price calculations
          );

          return {
            pool,
            token0: token0Obj,
            token1: token1Obj,
            fee,
            liquidity: liquidity.toString(),
            sqrtPriceX96: slot0.sqrtPriceX96.toString(),
            tick: slot0.tick,
          };
        } catch (error) {
                    continue;
        }
      }

      return null;
    },
    [provider, readOnlyProvider]
  );

  const buildRouteCandidate = useCallback(
    async (pathTokens: Token[], amount: string): Promise<V3RouteCandidate | null> => {
      if (!(provider || readOnlyProvider) || pathTokens.length < 2) {
        return null;
      }
      const quoteProvider = provider ?? readOnlyProvider;

      const pools: V3PoolInfo[] = [];
      for (let i = 0; i < pathTokens.length - 1; i++) {
        const pool = await findPool(pathTokens[i], pathTokens[i + 1]);
        if (!pool) {
          return null;
        }
        pools.push(pool);
      }

      const route = new Route(pools.map(pool => pool.pool), pathTokens[0], pathTokens[pathTokens.length - 1]);
      const amountIn = CurrencyAmount.fromRawAmount(
        pathTokens[0],
        ethers.utils.parseUnits(amount, pathTokens[0].decimals).toString()
      );
      const quoter = new ethers.Contract(
        V3_QUOTER_ADDRESS,
        ['function quoteExactInput(bytes path, uint256 amountIn) external returns (uint256 amountOut)'],
        quoteProvider
      );
      const encodedPath = encodeRouteToPath(route, false);
      const quotedAmountOut = await quoter.callStatic.quoteExactInput(
        encodedPath,
        amountIn.quotient.toString()
      );
      const outputAmount = CurrencyAmount.fromRawAmount(
        pathTokens[pathTokens.length - 1],
        quotedAmountOut.toString()
      );
      const trade = Trade.createUncheckedTrade({
        route,
        inputAmount: amountIn,
        outputAmount,
        tradeType: TradeType.EXACT_INPUT,
      });

      return {
        route,
        trade,
        pools,
        quotedAmountOut,
      };
    },
    [provider, readOnlyProvider, findPool]
  );

  const calculateTrade = useCallback(
    async (
      inputToken: Token,
      outputToken: Token,
      amount: string
    ): Promise<V3TradeResult | null> => {
      if (!(provider || readOnlyProvider) || !amount || parseFloat(amount) <= 0) {
        return null;
      }

      setTradeState(prev => ({ ...prev, isCalculating: true, error: null }));

      try {
        if (inputToken.address.toLowerCase() === outputToken.address.toLowerCase()) {
          throw new Error('Input and output tokens must be different.');
        }

        const bridges = getRouteBridgeTokens(inputToken, outputToken)
          .filter(token => token.address.toLowerCase() !== WETH_ADDRESS.toLowerCase())
          .slice(0, 7);
        const tokenPaths: Token[][] = [
          [inputToken, outputToken],
          ...bridges.map(bridge => [inputToken, bridge, outputToken]),
        ];

        for (let i = 0; i < bridges.length; i++) {
          for (let j = 0; j < bridges.length; j++) {
            if (i === j) continue;
            tokenPaths.push([inputToken, bridges[i], bridges[j], outputToken]);
          }
        }

        const uniquePaths = tokenPaths.filter((path, index, paths) => {
          const key = path.map(token => token.address.toLowerCase()).join('>');
          return paths.findIndex(candidate =>
            candidate.map(token => token.address.toLowerCase()).join('>') === key
          ) === index;
        });

        const candidates = (await Promise.all(uniquePaths.map(path => buildRouteCandidate(path, amount))))
          .filter((candidate): candidate is V3RouteCandidate => candidate !== null);

        if (candidates.length === 0) {
          throw new Error('No V3 liquidity pool found for this token pair');
        }

        candidates.sort((a, b) => {
          if (!a.quotedAmountOut.eq(b.quotedAmountOut)) {
            return a.quotedAmountOut.gt(b.quotedAmountOut) ? -1 : 1;
          }

          if (a.pools.length !== b.pools.length) {
            return a.pools.length - b.pools.length;
          }

          const aLiquidity = a.pools.reduce((sum, pool) => sum + BigInt(pool.liquidity), 0n);
          const bLiquidity = b.pools.reduce((sum, pool) => sum + BigInt(pool.liquidity), 0n);
          if (aLiquidity === bLiquidity) return 0;
          return aLiquidity > bLiquidity ? -1 : 1;
        });

        const bestCandidate = candidates[0];
        const trade = bestCandidate.trade;
        const route = bestCandidate.route;
        const poolInfo = bestCandidate.pools[0];

        const slippageTolerance = new Percent(DEFAULT_SLIPPAGE, 10000);
        const minimumAmountOut = trade.minimumAmountOut(slippageTolerance);

        const feeTier = bestCandidate.pools
          .map(pool => pool.fee === FeeAmount.LOWEST ? '0.01%' :
            pool.fee === FeeAmount.LOW ? '0.05%' :
            pool.fee === FeeAmount.MEDIUM ? '0.3%' : '1%')
          .join(' -> ');

        const tradeRoute: TradeRoute = {
          version: 'V3',
          inputAmount: trade.inputAmount.toSignificant(6),
          outputAmount: trade.outputAmount.toSignificant(6),
          inputAddress: inputToken.address,
          outputAddress: outputToken.address,
          inputSymbol: inputToken.symbol || 'TOKEN',
          outputSymbol: outputToken.symbol || 'TOKEN',
          executionPrice: trade.executionPrice.toSignificant(6),
          priceImpact: trade.priceImpact.toSignificant(2),
          minimumReceived: minimumAmountOut.toSignificant(6),
          fee: bestCandidate.pools.reduce((total, pool) => total + pool.fee, 0),
          feeTier,
          path: route.tokenPath.map(token => token.address),
          pathSymbols: route.tokenPath.map(token => token.symbol || 'TOKEN'),
          isMultiHop: bestCandidate.pools.length > 1,
        };

        setTradeState({
          trade,
          pool: poolInfo.pool,
          route: tradeRoute,
          isCalculating: false,
          error: null,
        });

        return {
          trade,
          route: tradeRoute,
          pool: poolInfo.pool,
        };
      } catch (error: any) {
        console.error('V3 trade calculation error:', error);
        setTradeState(prev => ({
          ...prev,
          isCalculating: false,
          error: error.message || 'Failed to calculate V3 trade',
        }));
        return null;
      }
    },
    [provider, readOnlyProvider, buildRouteCandidate]
  );

  const executeTrade = useCallback(
    async (
      trade: Trade<Token, Token, TradeType>,
      account: string,
      slippage: number,
      deadline: number
    ): Promise<ethers.providers.TransactionReceipt> => {
      if (!signer || !trade) {
        throw new Error('Wallet not connected or trade not calculated');
      }
      const isNativeInput = trade.inputAmount.currency.symbol === 'ETH';
      // Check wallet balance for ETH buys
      if (isNativeInput) {
        try {
          const balance = await signer.provider!.getBalance(account);
          const value = ethers.utils.parseUnits(trade.inputAmount.toExact(), 18);
          
          if (balance.lt(value)) {
            const shortage = value.sub(balance);
            const message = 
              `Insufficient ETH balance.\n` +
              `Your balance: ${ethers.utils.formatEther(balance)} ETH\n` +
              `Required: ${ethers.utils.formatEther(value)} ETH\n` +
              `Shortage: ${ethers.utils.formatEther(shortage)} ETH\n\n` +
              `Please add ETH to your wallet or use a smaller amount.`;
            
            throw new Error(message);
          }
        } catch (balanceError: any) {
          if (balanceError.message.includes('Insufficient ETH balance')) {
            throw balanceError;
          }
          console.warn('Could not check wallet balance:', balanceError);
        }
      }

      // Check token balance for sells
      if (!isNativeInput) {
        try {
          const tokenContract = new ethers.Contract(
            trade.inputAmount.currency.address,
            ERC20_ABI,
            signer
          );
          const balance = await tokenContract.balanceOf(account);
          const amountIn = ethers.utils.parseUnits(trade.inputAmount.toExact(), trade.inputAmount.currency.decimals);
          
          if (balance.lt(amountIn)) {
            const shortage = amountIn.sub(balance);
            const symbol = trade.inputAmount.currency.symbol;
            throw new Error(
              `Insufficient ${symbol} balance.\n` +
              `Your balance: ${ethers.utils.formatUnits(balance, trade.inputAmount.currency.decimals)} ${symbol}\n` +
              `Required: ${trade.inputAmount.toExact()} ${symbol}\n` +
              `Shortage: ${ethers.utils.formatUnits(shortage, trade.inputAmount.currency.decimals)} ${symbol}\n\n` +
              `Please buy more ${symbol} or use a smaller amount.`
            );
          }
        } catch (balanceError: any) {
          if (balanceError.message.includes('Insufficient')) {
            throw balanceError;
          }
          throw new Error(`Balance check failed: ${balanceError.message}`);
        }
      }

      const slippageTolerance = new Percent(Math.floor(slippage * 100), 10000);
      const deadlineTime = calculateDeadline(deadline);

      const methodParameters = SwapRouter.swapCallParameters([trade], {
        slippageTolerance,
        recipient: account,
        deadline: deadlineTime,
      });

      // SwapRouter returns calldata that should be sent directly to the router
      // The calldata already includes the function selector and encoded parameters
      if (isNativeInput) {
        const value = ethers.BigNumber.from(trade.inputAmount.quotient.toString());
        
        try {
          // Send the pre-encoded calldata directly to the router
          const tx = await signer.sendTransaction({
            to: V3_SWAP_ROUTER_ADDRESS,
            data: methodParameters.calldata,
            value: value,
            gasLimit: 300000, // Reasonable limit for V3 swaps
          });
          const receipt = await tx.wait();
          return receipt;
        } catch (error: any) {
          console.error('V3 Buy Error:', error);
          
          // Handle UNPREDICTABLE_GAS_LIMIT
          if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            const tokenSymbol = trade.outputAmount.currency.symbol;
            const helpfulMessage = 
              `Transaction simulation failed. This usually means:\n\n` +
              `1. Insufficient ${tokenSymbol} liquidity in the pool\n` +
              `2. Slippage protection too tight (minimum output too high)\n` +
              `3. Insufficient token approval for the router\n` +
              `4. Token balance too low for the swap\n` +
              `5. Pool price moved significantly during estimation\n\n` +
              `Try:\n` +
              `• Using a smaller amount\n` +
              `• Increasing slippage tolerance to 1-2%\n` +
              `• Checking your ETH balance (need ${trade.inputAmount.toExact()} ETH + gas)`;
            
            throw new Error(helpfulMessage);
          }
          
          throw error;
        }
      } else {
        const tokenContract = new ethers.Contract(
          trade.inputAmount.currency.address,
          ERC20_ABI,
          signer
        );

        const allowance = await tokenContract.allowance(account, V3_SWAP_ROUTER_ADDRESS);
        const amountIn = ethers.utils.parseUnits(
          trade.inputAmount.toExact(),
          trade.inputAmount.currency.decimals
        );

        // Check if approval is needed (BigNumber comparison)
        if (allowance.lt(amountIn)) {
          const approveTx = await tokenContract.approve(V3_SWAP_ROUTER_ADDRESS, amountIn);
          await approveTx.wait();
        }

        try {
          // Send the pre-encoded calldata directly to the router
          const tx = await signer.sendTransaction({
            to: V3_SWAP_ROUTER_ADDRESS,
            data: methodParameters.calldata,
            gasLimit: 300000, // Reasonable limit for V3 swaps
          });
          const receipt = await tx.wait();
          return receipt;
        } catch (error: any) {
          console.error('V3 Sell Error:', error);
          
          // Handle UNPREDICTABLE_GAS_LIMIT
          if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            const tokenSymbol = trade.inputAmount.currency.symbol;
            const helpfulMessage = 
              `Transaction simulation failed. This usually means:\n\n` +
              `1. Insufficient ${tokenSymbol} balance for the swap\n` +
              `2. Slippage protection too tight (minimum output too high)\n` +
              `3. Insufficient token approval for the router\n` +
              `4. Low liquidity in the trading pool\n` +
              `5. Pool price moved significantly during estimation\n\n` +
              `Try:\n` +
              `• Using a smaller amount\n` +
              `• Increasing slippage tolerance to 1-2%\n` +
              `• Checking your ${tokenSymbol} balance (need ${trade.inputAmount.toExact()} ${tokenSymbol})`;
            
            throw new Error(helpfulMessage);
          }
          
          throw error;
        }
      }
    },
    [signer]
  );

  const clearTrade = useCallback(() => {
    setTradeState({
      trade: null,
      pool: null,
      route: null,
      isCalculating: false,
      error: null,
    });
  }, []);

  return {
    ...tradeState,
    calculateTrade,
    executeTrade,
    clearTrade,
    findBestPool: findPool,
  };
};
