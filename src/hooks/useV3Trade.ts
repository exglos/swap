import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Pool, Route, Trade, SwapRouter, FeeAmount } from '@uniswap/v3-sdk';
import {
  CHAIN_ID,
  WETH_ADDRESS,
  V3_SWAP_ROUTER_ADDRESS,
  V3_QUOTER_ADDRESS,
  V3_POOL_ABI,
  ERC20_ABI,
  DEFAULT_SLIPPAGE,
  MIN_LIQUIDITY_THRESHOLD,
} from '@/utils/constants';
import { calculateDeadline } from '@/utils/helpers';
import type { V3PoolInfo, V3TradeResult, TradeRoute } from '@/types/uniswap';

interface V3TradeState {
  trade: Trade<Token, Token, TradeType> | null;
  pool: Pool | null;
  route: TradeRoute | null;
  isCalculating: boolean;
  error: string | null;
}

export const useV3Trade = (
  provider: ethers.providers.Web3Provider | null,
  signer: ethers.Signer | null
) => {
  const [tradeState, setTradeState] = useState<V3TradeState>({
    trade: null,
    pool: null,
    route: null,
    isCalculating: false,
    error: null,
  });

  const findBestPool = useCallback(
    async (tokenA: Token, tokenB: Token): Promise<V3PoolInfo | null> => {
      if (!provider) {
        return null;
      }

      const feeTiers = [FeeAmount.MEDIUM, FeeAmount.LOW, FeeAmount.HIGH, FeeAmount.LOWEST];

      for (const fee of feeTiers) {
        try {
          // Use official V3 SDK method to compute pool address
          const poolAddress = Pool.getAddress(tokenA, tokenB, fee);
          
          if (poolAddress === ethers.constants.AddressZero) {
            continue;
          }

          const poolContract = new ethers.Contract(poolAddress, V3_POOL_ABI, provider);
          
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
    [provider]
  );

  const calculateTrade = useCallback(
    async (
      token: Token,
      amount: string,
      isBuying: boolean
    ): Promise<V3TradeResult | null> => {
      if (!provider || !amount || parseFloat(amount) <= 0) {
        return null;
      }

      setTradeState(prev => ({ ...prev, isCalculating: true, error: null }));

      try {
        const wethToken = new Token(CHAIN_ID, WETH_ADDRESS, 18, 'WETH', 'Wrapped Ether');
        
        // Check if selected token is WETH - cannot create WETH/WETH pool
        if (token.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
          throw new Error('Cannot trade WETH with itself. Please select a different token.');
        }
        
        // Check for invalid token addresses
        if (token.address === 'ETH' || token.address.toLowerCase() === 'eth') {
          throw new Error('ETH is not an ERC20 token. Please use WETH for trading.');
        }
        
        const [inputToken, outputToken] = isBuying ? [wethToken, token] : [token, wethToken];

        const poolInfo = await findBestPool(inputToken, outputToken);

        if (!poolInfo) {
          throw new Error('No V3 liquidity pool found for this token pair');
        }

        const route = new Route([poolInfo.pool], inputToken, outputToken);
        const amountIn = CurrencyAmount.fromRawAmount(
          inputToken,
          ethers.utils.parseUnits(amount, inputToken.decimals).toString()
        );

        // Use V3 Quoter contract to get output amount (doesn't require tick data)
        const quoter = new ethers.Contract(
          V3_QUOTER_ADDRESS,
          ['function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'],
          provider
        );
        
        const amountOutRaw = await quoter.callStatic.quoteExactInputSingle(
          inputToken.address,
          outputToken.address,
          poolInfo.fee,
          amountIn.quotient.toString(),
          0 // No price limit
        );
        
        const outputAmount = CurrencyAmount.fromRawAmount(
          outputToken,
          amountOutRaw.toString()
        );

        const trade = Trade.createUncheckedTrade({
          route,
          inputAmount: amountIn,
          outputAmount,
          tradeType: TradeType.EXACT_INPUT
        });

        const slippageTolerance = new Percent(DEFAULT_SLIPPAGE, 10000);
        const minimumAmountOut = trade.minimumAmountOut(slippageTolerance);

        const feeTier = poolInfo.fee === FeeAmount.LOWEST ? '0.01%' :
                         poolInfo.fee === FeeAmount.LOW ? '0.05%' :
                         poolInfo.fee === FeeAmount.MEDIUM ? '0.3%' : '1%';

        const tradeRoute: TradeRoute = {
          version: 'V3',
          inputAmount: trade.inputAmount.toSignificant(6),
          outputAmount: trade.outputAmount.toSignificant(6),
          executionPrice: trade.executionPrice.toSignificant(6),
          priceImpact: trade.priceImpact.toSignificant(2),
          minimumReceived: minimumAmountOut.toSignificant(6),
          fee: poolInfo.fee,
          feeTier,
          path: [inputToken.address, outputToken.address],
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
    [provider, findBestPool]
  );

  const executeTrade = useCallback(
    async (
      trade: Trade<Token, Token, TradeType>,
      account: string,
      isBuying: boolean,
      slippage: number,
      deadline: number
    ): Promise<ethers.ContractTransaction> => {
      if (!signer || !trade) {
        throw new Error('Wallet not connected or trade not calculated');
      }
      // Check wallet balance for ETH buys
      if (isBuying) {
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
      if (!isBuying) {
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
            const message = 
              `Insufficient ${symbol} balance.\n` +
              `Your balance: ${ethers.utils.formatUnits(balance, trade.inputAmount.currency.decimals)} ${symbol}\n` +
              `Required: ${trade.inputAmount.toExact()} ${symbol}\n` +
              `Shortage: ${ethers.utils.formatUnits(shortage, trade.inputAmount.currency.decimals)} ${symbol}\n\n` +
              `Please buy more ${symbol} or use a smaller amount.`;
            
            throw new Error(message);
          }
        } catch (balanceError: any) {
          if (balanceError.message.includes('Insufficient')) {
            throw balanceError;
          }
          console.warn('Could not check token balance:', balanceError);
        }
      }

      const slippageTolerance = new Percent(Math.floor(slippage * 100), 10000);
      const deadlineTime = calculateDeadline(deadline);

      const methodParameters = SwapRouter.swapCallParameters([trade], {
        slippageTolerance,
        recipient: account,
        deadline: deadlineTime,
      });

      // Create router contract instance for proper ContractTransactionResponse
      const routerContract = new ethers.Contract(
        V3_SWAP_ROUTER_ADDRESS,
        ['function multicall(uint256 deadline, bytes[] calldata data) payable returns (bytes[] memory)'],
        signer
      );

      if (isBuying) {
        // For ETH buys, the trade.inputAmount should be the ETH amount
        // Since we're buying tokens with ETH, inputAmount represents ETH
        const value = ethers.utils.parseUnits(trade.inputAmount.toExact(), 18); // ETH always has 18 decimals
        
        try {
          const tx = await routerContract.multicall(deadline, [methodParameters.calldata], { value });
          return tx;
        } catch (error: any) {
          console.error('V3 Buy Error:', error);
          
          // Handle UNPREDICTABLE_GAS_LIMIT with helpful error messages
          if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            const tokenSymbol = trade.outputAmount.currency.symbol;
            
            // Common causes of gas estimation failures
            const possibleCauses = [
              `Insufficient ${tokenSymbol} liquidity in the pool`,
              `Slippage protection too tight (minimum output too high)`,
              'Insufficient token approval for the router',
              'Token balance too low for the swap',
              'Pool price moved significantly during estimation'
            ];
            
            const helpfulMessage = 
              `Transaction simulation failed. This usually means:\n\n` +
              possibleCauses.map((cause, i) => `${i + 1}. ${cause}`).join('\n') +
              `\n\nTry:\n` +
              `• Using a smaller amount\n` +
              `• Increasing slippage tolerance\n` +
              `• Checking your token balance and approvals`;
            
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
          const tx = await routerContract.multicall(deadline, [methodParameters.calldata]);
            return tx;
        } catch (error: any) {
          console.error('V3 Sell Error:', error);
          
          // Handle UNPREDICTABLE_GAS_LIMIT with helpful error messages
          if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            const tokenSymbol = trade.inputAmount.currency.symbol;
            
            // Common causes of gas estimation failures
            const possibleCauses = [
              `Insufficient ${tokenSymbol} balance for the swap`,
              `Slippage protection too tight (minimum output too high)`,
              'Insufficient token approval for the router',
              'Low liquidity in the trading pool',
              'Pool price moved significantly during estimation'
            ];
            
            const helpfulMessage = 
              `Transaction simulation failed. This usually means:\n\n` +
              possibleCauses.map((cause, i) => `${i + 1}. ${cause}`).join('\n') +
              `\n\nTry:\n` +
              `• Using a smaller amount\n` +
              `• Increasing slippage tolerance\n` +
              `• Checking your token balance and approvals`;
            
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
    findBestPool,
  };
};
