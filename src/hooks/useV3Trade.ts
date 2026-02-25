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
        console.error('V3: Provider is null');
        return null;
      }

      console.log('V3: Finding pool for', tokenA.symbol, '/', tokenB.symbol);
      console.log('V3: TokenA address:', tokenA.address);
      console.log('V3: TokenB address:', tokenB.address);

      const feeTiers = [FeeAmount.MEDIUM, FeeAmount.LOW, FeeAmount.HIGH, FeeAmount.LOWEST];

      for (const fee of feeTiers) {
        try {
          // Use official V3 SDK method to compute pool address
          const poolAddress = Pool.getAddress(tokenA, tokenB, fee);
          console.log(`V3: Checking pool at ${poolAddress} for fee ${fee}`);
          
          if (poolAddress === ethers.constants.AddressZero) {
            console.log('V3: Pool address is zero, skipping');
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
          console.log(`No V3 pool found for fee tier ${fee}:`, error);
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
      isBuying: boolean
    ): Promise<ethers.ContractTransaction> => {
      if (!signer || !trade) {
        throw new Error('Wallet not connected or trade not calculated');
      }

      const slippageTolerance = new Percent(DEFAULT_SLIPPAGE, 10000);
      const deadline = calculateDeadline(20);

      const methodParameters = SwapRouter.swapCallParameters([trade], {
        slippageTolerance,
        recipient: account,
        deadline,
      });

      // Create router contract instance for proper ContractTransactionResponse
      const routerContract = new ethers.Contract(
        V3_SWAP_ROUTER_ADDRESS,
        ['function multicall(uint256 deadline, bytes[] calldata data) payable returns (bytes[] memory)'],
        signer
      );

      if (isBuying) {
        const value = ethers.utils.parseEther(trade.inputAmount.toExact());
        const tx = await routerContract.multicall(deadline, [methodParameters.calldata], { value });
        return tx;
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

        const tx = await routerContract.multicall(deadline, [methodParameters.calldata]);
        return tx;
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
