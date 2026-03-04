import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { FeeAmount } from '@uniswap/v3-sdk';
import { Pool } from '@uniswap/v4-sdk';
import type { V4PoolInfo, TradeRoute, V4TradeResult } from '../types/uniswap';
import { V4_QUOTER_ADDRESS, V4_STATE_VIEW_ADDRESS, WETH_ADDRESS, CHAIN_ID, V4_STATE_VIEW_ABI } from '../utils/constants';
import { NATIVE_ETH_ADDRESS, getPoolConfig } from '../utils/v4PoolRegistry';

const DEFAULT_SLIPPAGE = 50; // 0.5%

// Persistent cache outside hook to prevent redundant RPC calls
const POOL_CACHE: Record<string, V4PoolInfo | null> = {};
const NOT_FOUND_CACHE: Record<string, number> = {};

// Helper to create cache key
const getCacheKey = (a: string, b: string) => 
  [a.toLowerCase(), b.toLowerCase()].sort().join('-');

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
      if (!provider) return null;

      const cacheKey = getCacheKey(tokenA.address, tokenB.address);
      
      // Check positive cache
      if (POOL_CACHE[cacheKey] !== undefined) {
        return POOL_CACHE[cacheKey];
      }

      // Check negative cache (avoid re-scanning recently failed lookups)
      if (NOT_FOUND_CACHE[cacheKey] && Date.now() - NOT_FOUND_CACHE[cacheKey] < 60000) {
        return null;
      }

      try {
        const stateView = new ethers.Contract(V4_STATE_VIEW_ADDRESS, V4_STATE_VIEW_ABI, provider);
        
        // Sort tokens for consistent pool ID computation
        const [sorted0, sorted1] = tokenA.address.toLowerCase() < tokenB.address.toLowerCase()
          ? [tokenA, tokenB]
          : [tokenB, tokenA];

        // STRATEGY 1: Check pre-computed registry for common pairs
        const registryConfig = getPoolConfig(tokenA.address, tokenB.address);
        if (registryConfig) {
          try {
            const poolId = Pool.getPoolId(sorted0, sorted1, registryConfig.fee, registryConfig.tickSpacing, registryConfig.hooks);
            const liquidity = await stateView.getLiquidity(poolId);
            if (liquidity.gt(0)) {
              const poolInfo: V4PoolInfo = {
                poolAddress: poolId,
                token0: sorted0,
                token1: sorted1,
                fee: registryConfig.fee,
                tickSpacing: registryConfig.tickSpacing,
                hooks: registryConfig.hooks,
                liquidity: liquidity.toString(),
                hookData: '0x',
              };
              POOL_CACHE[cacheKey] = poolInfo;
              return poolInfo;
            }
          } catch {
            // Registry pool not accessible, continue to probing
          }
        }
        
        // STRATEGY 2: Quick StateView probes for common fee tiers (no event scanning)
        const TIER_CONFIGS = [
          { fee: FeeAmount.LOW, tickSpacing: 10 },
          { fee: FeeAmount.MEDIUM, tickSpacing: 60 },
          { fee: FeeAmount.HIGH, tickSpacing: 200 },
          { fee: FeeAmount.LOWEST, tickSpacing: 1 },
        ];
        
        for (const tier of TIER_CONFIGS) {
          try {
            const poolId = Pool.getPoolId(sorted0, sorted1, tier.fee, tier.tickSpacing, ethers.constants.AddressZero);
            const liquidity = await stateView.getLiquidity(poolId);
            if (liquidity.gt(0)) {
              const poolInfo: V4PoolInfo = {
                poolAddress: poolId,
                token0: sorted0,
                token1: sorted1,
                fee: tier.fee,
                tickSpacing: tier.tickSpacing,
                hooks: ethers.constants.AddressZero,
                liquidity: liquidity.toString(),
                hookData: '0x',
              };
              POOL_CACHE[cacheKey] = poolInfo;
              return poolInfo;
            }
          } catch {
            continue;
          }
        }
        
        // STRATEGY 3: If one token is WETH, also try Native ETH
        if (tokenA.address.toLowerCase() === WETH_ADDRESS.toLowerCase() || 
            tokenB.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
          const nativeToken = new Token(CHAIN_ID, NATIVE_ETH_ADDRESS, 18, 'ETH', 'Ethereum');
          const otherToken = tokenA.address.toLowerCase() === WETH_ADDRESS.toLowerCase() ? tokenB : tokenA;
          const nativePool = await findV4Pool(nativeToken, otherToken);
          if (nativePool) {
            POOL_CACHE[cacheKey] = nativePool;
            return nativePool;
          }
        }
        
        // Mark as not found to avoid re-scanning
        NOT_FOUND_CACHE[cacheKey] = Date.now();
        POOL_CACHE[cacheKey] = null;
        return null;
      } catch {
        NOT_FOUND_CACHE[cacheKey] = Date.now();
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
        // V4 pools use Native ETH (0x000...0), not WETH
        const ethToken = new Token(token.chainId, NATIVE_ETH_ADDRESS, 18, 'ETH', 'Ethereum');
        
        // Check if trying to trade ETH with itself
        if (token.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) {
          throw new Error('Cannot trade ETH with itself. Please select a different token.');
        }
        
        // Check for ETH/WETH wrap (no pool needed, 1:1 ratio)
        if (token.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
          throw new Error('ETH/WETH is a wrap operation, not a swap. Use V3 or wrap directly.');
        }
        
        const [tokenIn, tokenOut] = isBuying ? [ethToken, token] : [token, ethToken];

        const poolInfo = await findV4Pool(tokenIn, tokenOut);

        if (!poolInfo) {
          throw new Error(`No V4 pool found for ${token.symbol}/ETH. Falling back to V3.`);
        }

        const V4_QUOTER_ABI = [
          'function quoteExactInputSingle((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) external returns (uint256 amountOut, uint256 gasEstimate)',
          'error QuoteSwap(uint256 amount)'
        ];

        const quoter = new ethers.Contract(V4_QUOTER_ADDRESS, V4_QUOTER_ABI, provider);

        // Build poolKey for quoter - MUST match the discovered pool exactly
        const poolKey = {
          currency0: tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
          currency1: tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
          fee: poolInfo.fee,
          tickSpacing: poolInfo.tickSpacing,
          hooks: poolInfo.hooks,
        };

        const zeroForOne = tokenIn.address < tokenOut.address;
        const amountInWei = ethers.utils.parseUnits(amount, tokenIn.decimals);

        // V4 Quoter uses revert-to-data pattern to save gas
        const V4_QUOTE_SELECTOR = '0x07469600';
        
        let quotedAmount: ethers.BigNumber = ethers.BigNumber.from(0);
        
        try {
          await quoter.callStatic.quoteExactInputSingle(poolKey, zeroForOne, amountInWei, '0x');
          throw new Error('Quoter did not revert as expected');
        } catch (quoterError: any) {
          let revertData = quoterError.data || quoterError.error?.data || quoterError.message;
          
          if (revertData && typeof revertData === 'object' && revertData.originalError) {
            revertData = revertData.originalError.data;
          }
          
          if (typeof revertData === 'string' && revertData.includes(V4_QUOTE_SELECTOR)) {
            try {
              const hexData = revertData.substring(revertData.indexOf(V4_QUOTE_SELECTOR));
              const decoded = ethers.utils.defaultAbiCoder.decode(
                ['uint256', 'uint256', 'uint24'],
                ethers.utils.hexDataSlice(hexData, 4)
              );
              quotedAmount = decoded[0];
            } catch {
              throw new Error(`V4 quoter data decode failed for ${token.symbol}/ETH. Falling back to V3.`);
            }
          } else {
            throw new Error(`V4 pool found but quoter failed for ${token.symbol}/ETH. Falling back to V3.`);
          }
        }

        const outputAmount = ethers.utils.formatUnits(quotedAmount, tokenOut.decimals);
        const slippageAmount = (parseFloat(outputAmount) * (DEFAULT_SLIPPAGE / 10000));
        const minimumReceived = (parseFloat(outputAmount) - slippageAmount).toFixed(6);

        const inputFloat = parseFloat(amount);
        const outputFloat = parseFloat(outputAmount);
        const executionPrice = isBuying 
          ? (inputFloat / outputFloat).toFixed(6)
          : (outputFloat / inputFloat).toFixed(6);

        const priceImpact = '0.00';
        
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
    ): Promise<ethers.providers.TransactionReceipt> => {
      if (!signer || !poolInfo || !route) {
        throw new Error('Wallet not connected or trade not calculated');
      }

      const { executeV4Swap } = await import('@/utils/v4UniversalRouter');

      const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
      const wethToken = new Token(CHAIN_ID, WETH_ADDRESS, 18, 'WETH', 'Wrapped Ether');
      const [tokenIn, tokenOut] = isBuying 
        ? [wethToken, poolInfo.token1] 
        : [poolInfo.token0, wethToken];

      const slippageBips = Math.floor(slippage * 100);
      const amountOutBN = ethers.utils.parseUnits(route.outputAmount, tokenOut.decimals);
      const minAmountOut = amountOutBN.mul(10000 - slippageBips).div(10000);

      const tx = await executeV4Swap(
        {
          tokenIn,
          tokenOut,
          amountIn: route.inputAmount,
          amountOut: route.outputAmount,
          minAmountOut: minAmountOut.toString(),
          fee: poolInfo.fee,
          poolId: poolInfo.poolAddress,
          isBuying,
          deadline: Math.floor(Date.now() / 1000) + (deadline * 60),
        },
        signer
      );

      const receipt = await tx.wait();
      return receipt;
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
