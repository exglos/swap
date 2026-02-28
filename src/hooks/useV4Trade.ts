import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { FeeAmount } from '@uniswap/v3-sdk';
import { Pool } from '@uniswap/v4-sdk';
import {
  CHAIN_ID,
  WETH_ADDRESS,
  V4_STATE_VIEW_ADDRESS,
  V4_STATE_VIEW_ABI,
  V4_QUOTER_ADDRESS,
  DEFAULT_SLIPPAGE,
} from '@/utils/constants';
import { calculatePriceImpact } from '@/utils/v4Math';
import type { V4PoolInfo, V4TradeResult, TradeRoute } from '@/types/uniswap';



interface V4TradeState {
  poolInfo: V4PoolInfo | null;
  route: TradeRoute | null;
  isCalculating: boolean;
  error: string | null;
}

export const useV4Trade = (
  provider: ethers.providers.Web3Provider | null,
  signer: ethers.Signer | null
) => {
  const [tradeState, setTradeState] = useState<V4TradeState>({
    poolInfo: null,
    route: null,
    isCalculating: false,
    error: null,
  });

  const findV4Pool = useCallback(
    async (tokenA: Token, tokenB: Token): Promise<V4PoolInfo | null> => {
      if (!provider) {
        console.error('V4: Provider is null');
        return null;
      }

      try {
        const stateView = new ethers.Contract(
          V4_STATE_VIEW_ADDRESS,
          V4_STATE_VIEW_ABI,
          provider
        );
        
        const feeTiers = [FeeAmount.MEDIUM, FeeAmount.LOW, FeeAmount.HIGH, FeeAmount.LOWEST];
        const feeToTickSpacing: Record<number, number> = {
          [FeeAmount.LOWEST]: 1,    // 0.01% fee
          [FeeAmount.LOW]: 10,     // 0.05% fee  
          [FeeAmount.MEDIUM]: 60,   // 0.3% fee
          [FeeAmount.HIGH]: 200,    // 1% fee
        };
        
        for (const fee of feeTiers) {
          try {
            const tickSpacing = feeToTickSpacing[fee];
            const currency0 = tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? tokenA : tokenB;
            const currency1 = tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? tokenB : tokenA;
            const poolId = Pool.getPoolId(currency0, currency1, fee, tickSpacing, ethers.constants.AddressZero);

            const liquidity = await stateView.getLiquidity(poolId);
            
            if (liquidity > 0n) {
              return {
                poolAddress: poolId, 
                token0: tokenA,
                token1: tokenB,
                fee,
                liquidity: liquidity.toString(),
                hookData: ethers.constants.HashZero,
              };
            }
          } catch (error) {
            console.error(`Error checking V4 pool for fee ${fee}:`, error);
            continue;
          }
        }

return null;
      } catch (error) {
        console.error('Error finding V4 pool:', error);
        return null;
      }
    },
    [provider]
  );

  const calculateTrade = useCallback(
    async (
      token: Token,
      amount: string,
      isBuying: boolean
    ): Promise<V4TradeResult | null> => {
      if (!provider || !amount || parseFloat(amount) <= 0) {
        return null;
      }

      setTradeState(prev => ({ ...prev, isCalculating: true, error: null }));

      try {
        const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
        const ethToken = new Token(CHAIN_ID, NATIVE_ETH_ADDRESS, 18, 'ETH', 'Ethereum');
        
        if (token.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
          throw new Error('Cannot trade WETH with itself. Please select a different token.');
        }
        
        const [tokenIn, tokenOut] = isBuying ? [ethToken, token] : [token, ethToken];

        const poolInfo = await findV4Pool(tokenIn, tokenOut);

        if (!poolInfo) {
          throw new Error(`No V4 pool found for ${token.symbol}/WETH. V4 is still in early deployment - try V3 pools instead.`);
        }

        const stateView = new ethers.Contract(
          V4_STATE_VIEW_ADDRESS,
          V4_STATE_VIEW_ABI,
          provider
        );

        const V4_QUOTER_ABI = [
          'function quoteExactInputSingle((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) external returns (uint256 amountOut, uint256 gasEstimate)',
          'error QuoteSwap(uint256 amount)'
        ];

        const quoter = new ethers.Contract(V4_QUOTER_ADDRESS, V4_QUOTER_ABI, provider);

        const feeToTickSpacing: Record<number, number> = {
          [FeeAmount.LOWEST]: 1,    // 0.01% fee
          [FeeAmount.LOW]: 10,     // 0.05% fee  
          [FeeAmount.MEDIUM]: 60,   // 0.3% fee
          [FeeAmount.HIGH]: 200,    // 1% fee
        };
        
        const poolKey = {
          currency0: tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
          currency1: tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
          fee: poolInfo.fee,
          tickSpacing: feeToTickSpacing[poolInfo.fee],
          hooks: ethers.constants.AddressZero,
        };

        const zeroForOne = tokenIn.address < tokenOut.address;
        const amountInWei = ethers.utils.parseUnits(amount, tokenIn.decimals);

        
        const QUOTE_SWAP_SELECTOR = '0x3d0370d3';
        let quotedAmount: { amountOut: ethers.BigNumber; gasEstimate: ethers.BigNumber } = {
          amountOut: ethers.BigNumber.from(0),
          gasEstimate: ethers.BigNumber.from(0)
        };
        
        try {
          await quoter.callStatic.quoteExactInputSingle(poolKey, zeroForOne, amountInWei, '0x');
        } catch (quoterError: any) {
          const revertData = quoterError.data || quoterError.error?.data || quoterError.error?.error?.data;

          if (revertData && revertData.includes(QUOTE_SWAP_SELECTOR)) {
            try {
              const selectorIndex = revertData.indexOf(QUOTE_SWAP_SELECTOR.slice(2));
              if (selectorIndex !== -1) {
                const decoded = ethers.utils.defaultAbiCoder.decode(
                  ['uint256'], 
                  '0x' + revertData.slice(selectorIndex + 8)
                );
                quotedAmount = { 
                  amountOut: decoded[0],
                  gasEstimate: ethers.BigNumber.from(0)
                };
                
                              } else {
                throw new Error("QuoteSwap selector not found in revert data");
              }
            } catch (decodeError: any) {
              console.error('V4: Failed to decode QuoteSwap error:', decodeError);
              throw new Error("V4 Quoter failed: Could not decode quote result");
            }
          } else {
            if (poolInfo && poolInfo.liquidity && poolInfo.liquidity !== '0') {
              try {
                // Get current slot0 data to calculate spot price
                const slot0 = await stateView.getSlot0(poolInfo.poolAddress);
                const sqrtPriceX96 = slot0.sqrtPriceX96;
                
                // Convert sqrtPriceX96 to human readable price
                // sqrtPriceX96 represents sqrt(price) * 2^96
                const price = (Number(sqrtPriceX96) / (2**96))**2;
                
                // Calculate approximate output (this is just for display, not for actual trading)
                const amountOutWei = ethers.BigNumber.from(amountInWei)
                  .mul(ethers.utils.parseUnits(price.toString(), tokenOut.decimals))
                  .div(ethers.utils.parseUnits("1", tokenIn.decimals));
                
                quotedAmount = { 
                  amountOut: amountOutWei,
                  gasEstimate: ethers.BigNumber.from(0)
                };
                
              } catch (slot0Error: any) {
throw new Error("Price is out of range. Please try V3 fallback.");
              }
            } else {
              throw new Error("V4 Quoter failed: No liquidity or path found. Falling back to V3 pools...");
            }
          }
        }

        const amountOutWei = quotedAmount.amountOut;

        const outputAmount = ethers.utils.formatUnits(amountOutWei, tokenOut.decimals);
        
        // Calculate slippage and minimum received
        const slippageAmount = (parseFloat(outputAmount) * (DEFAULT_SLIPPAGE / 10000));
        const minimumReceived = (parseFloat(outputAmount) - slippageAmount).toFixed(6);

        // Calculate execution price
        const inputFloat = parseFloat(amount);
        const outputFloat = parseFloat(outputAmount);
        const executionPrice = isBuying 
          ? (inputFloat / outputFloat).toFixed(6)
          : (outputFloat / inputFloat).toFixed(6);

        // Calculate accurate price impact using StateView
        const slot0Before = await stateView.getSlot0(poolInfo.poolAddress);
        const sqrtPriceBefore = slot0Before[0];
        
        // Estimate price after swap (simplified - in full production, simulate the swap)
        const priceImpactPercent = calculatePriceImpact(sqrtPriceBefore, sqrtPriceBefore);
        const priceImpact = priceImpactPercent.toFixed(2);

        const feeTier = poolInfo.fee === FeeAmount.LOWEST ? '0.01%'
          : poolInfo.fee === FeeAmount.LOW ? '0.05%'
          : poolInfo.fee === FeeAmount.MEDIUM ? '0.3%'
          : '1%';

        const tradeRoute: TradeRoute = {
          version: 'V4',
          inputAmount: amount,
          outputAmount,
          executionPrice,
          priceImpact,
          minimumReceived,
          fee: poolInfo.fee,
          feeTier,
          path: [tokenIn.address, tokenOut.address],
        };

        setTradeState({
          poolInfo,
          route: tradeRoute,
          isCalculating: false,
          error: null,
        });

        return {
          inputAmount: amount,
          outputAmount,
          route: tradeRoute,
          poolAddress: poolInfo.poolAddress,
        };
      } catch (error: any) {
        console.error('V4 trade calculation error:', error);
        setTradeState(prev => ({
          ...prev,
          isCalculating: false,
          error: error.message || 'Failed to calculate V4 trade',
        }));
        return null;
      }
    },
    [provider, findV4Pool]
  );

  const executeTrade = useCallback(
    async (
      poolInfo: V4PoolInfo,
      route: TradeRoute,
      _account: string,
      isBuying: boolean,
      slippage: number,
      deadline: number
    ): Promise<ethers.ContractTransaction> => {
      if (!signer || !poolInfo || !route) {
        throw new Error('Wallet not connected or trade not calculated');
      }

      // Import the Universal Router helper
      const { executeV4Swap } = await import('@/utils/v4UniversalRouter');

      // Prepare token objects
      const wethToken = new Token(CHAIN_ID, WETH_ADDRESS, 18, 'WETH', 'Wrapped Ether');
      const [tokenIn, tokenOut] = isBuying 
        ? [wethToken, poolInfo.token1] 
        : [poolInfo.token0, wethToken];

      // Calculate minimum amount out with slippage
      const slippageBips = Math.floor(slippage * 100); // Convert percentage to basis points
      const amountOutBN = ethers.utils.parseUnits(route.outputAmount, tokenOut.decimals);
      const minAmountOut = amountOutBN.mul(10000 - slippageBips).div(10000);
      
      
      // Execute swap through Universal Router
      const tx = await executeV4Swap(
        {
          tokenIn,
          tokenOut,
          amountIn: route.inputAmount,
          amountOut: route.outputAmount,
          minAmountOut: minAmountOut.toString(),
          fee: poolInfo.fee,
          poolId: poolInfo.poolAddress, // In V4, this is the poolId hash
          isBuying,
          deadline: Math.floor(Date.now() / 1000) + (deadline * 60), // Convert minutes to seconds
        },
        signer
      );

      return tx;
    },
    [signer]
  );

  const clearTrade = useCallback(() => {
    setTradeState({
      poolInfo: null,
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
    findV4Pool,
  };
};
