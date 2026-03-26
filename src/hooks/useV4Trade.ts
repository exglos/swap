import { useState, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { FeeAmount } from '@uniswap/v3-sdk';
import { Pool } from '@uniswap/v4-sdk';
import type { RouteDebugStep, V4PoolInfo, TradeRoute, V4TradeResult } from '../types/uniswap';
import { V4_POOL_MANAGER_ADDRESS, V4_QUOTER_ADDRESS, V4_STATE_VIEW_ADDRESS, WETH_ADDRESS, CHAIN_ID, V4_STATE_VIEW_ABI } from '../utils/constants';
import { NATIVE_ETH_ADDRESS, getPoolConfig } from '../utils/v4PoolRegistry';
import { getRouteBridgeTokens } from '../utils/routeTokens';

// Common V4 Configurations for March 2026
const COMMON_TIERS = [
  { fee: 3000, tickSpacing: 60 }, // 0.3%
  { fee: 500, tickSpacing: 10 },  // 0.05%
  { fee: 10000, tickSpacing: 200 },// 1%
  { fee: 100, tickSpacing: 1 }     // 0.01%
];

const HOOKLESS = '0x0000000000000000000000000000000000000000';

// Multicall3 Address
const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL_ABI = [
  'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)'
];

const DEFAULT_SLIPPAGE = 50; // 0.5%
const V4_EVENT_LOOKBACK_BLOCKS = 2_500_000;
const V4_ROUTE_TIMEOUT_MS = 9000;
const V4_MAX_DIRECT_POOLS = 8;
const V4_MAX_BRIDGES = 4;
const V4_EVENT_BLOCK_WINDOW = 200_000;
const V4_MAX_EVENT_WINDOWS = 4;
const V4_EVENT_SCAN_TIMEOUT_MS = 3500;

// Persistent cache outside hook to prevent redundant RPC calls
const POOL_CACHE: Record<string, V4PoolInfo | null> = {};
const NOT_FOUND_CACHE: Record<string, number> = {};
const EVENT_POOL_CACHE: Record<string, V4PoolInfo[]> = {};

// Helper to create cache key
const getCacheKey = (a: string, b: string) => 
  [a.toLowerCase(), b.toLowerCase()].sort().join('-');

const dedupePools = (pools: V4PoolInfo[]): V4PoolInfo[] => {
  const seen = new Set<string>();
  return pools.filter(pool => {
    const key = pool.poolAddress.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const INITIALIZE_EVENT_ABI = [
  'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)'
];

// V4 Speed-Daemon Discovery - finds active pools via Multicall
const findActiveV4Pool = async (
  tokenA: Token, 
  tokenB: Token, 
  provider: ethers.providers.Provider
): Promise<V4PoolInfo | null> => {
  // Early exit for pairs not known to have V4 pools
  try {
    // Check if Multicall3 exists first
    const multicall = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, provider);
    await multicall.aggregate([]); // Test call
    
    const stateView = new ethers.Contract(V4_STATE_VIEW_ADDRESS, V4_STATE_VIEW_ABI, provider);
    
    // Sort currencies (V4 requirement: currency0 < currency1)
    const [c0, c1] = tokenA.address.toLowerCase() < tokenB.address.toLowerCase() 
      ? [tokenA, tokenB] 
      : [tokenB, tokenA];

    // Prepare PoolKeys and encode calls for getSlot0
    const poolKeys = COMMON_TIERS.map(tier => ({
      currency0: c0.address,
      currency1: c1.address,
      fee: tier.fee,
      tickSpacing: tier.tickSpacing,
      hooks: HOOKLESS
    }));

    const calls = poolKeys.map(key => {
      const poolId = Pool.getPoolId(
        key.currency0 < key.currency1 ? c0 : c1,
        key.currency0 < key.currency1 ? c1 : c0,
        key.fee,
        key.tickSpacing,
        key.hooks
      );
      return {
        target: V4_STATE_VIEW_ADDRESS,
        callData: stateView.interface.encodeFunctionData('getSlot0', [poolId])
      };
    });

    // Batch request - check all fee tiers in one call
    const [, returnData] = await multicall.aggregate(calls);

    // Decode and find first valid pool
    for (let i = 0; i < returnData.length; i++) {
      try {
        const slot0 = stateView.interface.decodeFunctionResult('getSlot0', returnData[i]);
        
        // In V4, if sqrtPriceX96 is non-zero, the pool is initialized and ready
        if (slot0.sqrtPriceX96.gt(0)) {
          const tier = COMMON_TIERS[i];
          const poolId = Pool.getPoolId(
            poolKeys[i].currency0 < poolKeys[i].currency1 ? c0 : c1,
            poolKeys[i].currency0 < poolKeys[i].currency1 ? c1 : c0,
            tier.fee,
            tier.tickSpacing,
            HOOKLESS
          );
          
          // Get liquidity to confirm pool is active
          const liquidity = await stateView.getLiquidity(poolId);
          
          if (liquidity.gt(0)) {      
            return {
              poolAddress: poolId,
              token0: c0,
              token1: c1,
              fee: tier.fee,
              tickSpacing: tier.tickSpacing,
              hooks: HOOKLESS,
              liquidity: liquidity.toString(),
              hookData: '0x',
            };
          }
        }
      } catch (e) {
        // This fee tier isn't initialized; continue
        continue;
      }
    }
  } catch (multicallError: any) {
    // Fallback to individual calls if Multicall fails
    return null; // Let the existing logic handle fallback
  }
  
  return null; // No active V4 pools found
};

interface V4TradeState {
  poolPath: V4PoolInfo[];
  route: TradeRoute | null;
  isCalculating: boolean;
  error: string | null;
  debugSteps: RouteDebugStep[];
}

interface V4RouteCandidate {
  poolPath: V4PoolInfo[];
  pathTokens: Token[];
  amountOut: ethers.BigNumber;
}

const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

export const useV4Trade = (
  provider: ethers.providers.Web3Provider | null,
  signer: ethers.Signer | null,
  readOnlyProvider: ethers.providers.JsonRpcProvider
) => {
  const [tradeState, setTradeState] = useState<V4TradeState>({
    poolPath: [],
    route: null,
    isCalculating: false,
    error: null,
    debugSteps: [],
  });
  const debugStepsRef = useRef<RouteDebugStep[]>([]);

  const pushDebugStep = useCallback((step: RouteDebugStep) => {
    debugStepsRef.current = [...debugStepsRef.current, step];
    setTradeState(prev => ({
      ...prev,
      debugSteps: [...debugStepsRef.current],
    }));
  }, []);

  const findPoolsByInitializeEvent = useCallback(
    async (tokenA: Token, tokenB: Token): Promise<V4PoolInfo[]> => {
      const quoteProvider = provider ?? readOnlyProvider;
      if (!quoteProvider) return [];

      const cacheKey = getCacheKey(tokenA.address, tokenB.address);
      if (EVENT_POOL_CACHE[cacheKey]) {
        return EVENT_POOL_CACHE[cacheKey];
      }

      try {
        const iface = new ethers.utils.Interface(INITIALIZE_EVENT_ABI);
        const latestBlock = await quoteProvider.getBlockNumber();
        const fromBlock = Math.max(latestBlock - V4_EVENT_LOOKBACK_BLOCKS, 0);
        const [currency0, currency1] = tokenA.address.toLowerCase() < tokenB.address.toLowerCase()
          ? [tokenA.address, tokenB.address]
          : [tokenB.address, tokenA.address];
        const allLogs: ethers.providers.Log[] = [];
        let windowsScanned = 0;
        for (let end = latestBlock; end >= fromBlock && windowsScanned < V4_MAX_EVENT_WINDOWS; end -= V4_EVENT_BLOCK_WINDOW) {
          const start = Math.max(fromBlock, end - V4_EVENT_BLOCK_WINDOW + 1);
          const chunkLogs = await quoteProvider.getLogs({
            address: V4_POOL_MANAGER_ADDRESS,
            fromBlock: start,
            toBlock: end,
            topics: [
              iface.getEventTopic('Initialize'),
              null,
              ethers.utils.hexZeroPad(currency0, 32),
              ethers.utils.hexZeroPad(currency1, 32),
            ],
          });
          allLogs.push(...chunkLogs);
          windowsScanned += 1;
          if (chunkLogs.length > 0) {
            break;
          }
        }

        const stateView = new ethers.Contract(V4_STATE_VIEW_ADDRESS, V4_STATE_VIEW_ABI, quoteProvider);
        const discoveredPools: V4PoolInfo[] = [];

        for (const log of allLogs) {
          try {
            const parsed = iface.parseLog(log);
            const poolId = parsed.args.id;
            const liquidity = await stateView.getLiquidity(poolId);
            if (!liquidity.gt(0)) {
              continue;
            }

            discoveredPools.push({
              poolAddress: poolId,
              token0: currency0.toLowerCase() === tokenA.address.toLowerCase() ? tokenA : tokenB,
              token1: currency1.toLowerCase() === tokenB.address.toLowerCase() ? tokenB : tokenA,
              fee: parsed.args.fee,
              tickSpacing: parsed.args.tickSpacing,
              hooks: parsed.args.hooks,
              liquidity: liquidity.toString(),
              hookData: '0x',
            });
          } catch {
            continue;
          }
        }

        const uniquePools = dedupePools(discoveredPools);
        uniquePools.sort((a, b) => {
          const aLiquidity = BigInt(a.liquidity);
          const bLiquidity = BigInt(b.liquidity);
          if (aLiquidity === bLiquidity) return 0;
          return aLiquidity > bLiquidity ? -1 : 1;
        });

        EVENT_POOL_CACHE[cacheKey] = uniquePools;
        return uniquePools;
      } catch {
        return [];
      }
    },
    [provider, readOnlyProvider]
  );

  const findDirectV4Pools = useCallback(
    async (tokenA: Token, tokenB: Token): Promise<V4PoolInfo[]> => {
      const quoteProvider = provider ?? readOnlyProvider;
      if (!quoteProvider) return [];

      const cacheKey = getCacheKey(tokenA.address, tokenB.address);
      if (cacheKey in POOL_CACHE) {
        return POOL_CACHE[cacheKey] ? [POOL_CACHE[cacheKey] as V4PoolInfo] : [];
      }

      try {
        const speedDaemonResult = await findActiveV4Pool(tokenA, tokenB, quoteProvider as ethers.providers.Web3Provider);
        if (speedDaemonResult) {
          POOL_CACHE[cacheKey] = speedDaemonResult;
          return [speedDaemonResult];
        }

        const stateView = new ethers.Contract(V4_STATE_VIEW_ADDRESS, V4_STATE_VIEW_ABI, quoteProvider);
        const [sorted0, sorted1] = tokenA.address.toLowerCase() < tokenB.address.toLowerCase()
          ? [tokenA, tokenB]
          : [tokenB, tokenA];
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
              return [poolInfo];
            }
          } catch {
          }
        }

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
              return [poolInfo];
            }
          } catch {
            continue;
          }
        }

        if (tokenA.address.toLowerCase() === WETH_ADDRESS.toLowerCase() || 
            tokenB.address.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
          const nativeToken = new Token(CHAIN_ID, NATIVE_ETH_ADDRESS, 18, 'ETH', 'Ethereum');
          const otherToken = tokenA.address.toLowerCase() === WETH_ADDRESS.toLowerCase() ? tokenB : tokenA;
          const nativePools = await findDirectV4Pools(nativeToken, otherToken);
          if (nativePools.length > 0) {
            POOL_CACHE[cacheKey] = nativePools[0];
            return nativePools;
          }
        }

        const eventPools = await withTimeout(
          findPoolsByInitializeEvent(tokenA, tokenB),
          V4_EVENT_SCAN_TIMEOUT_MS,
          `V4 event scan timed out for ${tokenA.symbol}/${tokenB.symbol}.`
        ).catch(() => []);
        if (eventPools.length > 0) {
          POOL_CACHE[cacheKey] = eventPools[0];
          return eventPools;
        }

        NOT_FOUND_CACHE[cacheKey] = Date.now();
        POOL_CACHE[cacheKey] = null;
        return [];
      } catch {
        NOT_FOUND_CACHE[cacheKey] = Date.now();
        return [];
      }
    },
    [provider, readOnlyProvider, findPoolsByInitializeEvent]
  );

  const quoteV4Hop = useCallback(
    async (
      poolInfo: V4PoolInfo,
      tokenIn: Token,
      tokenOut: Token,
      amountIn: ethers.BigNumber
    ): Promise<ethers.BigNumber> => {
      const V4_QUOTER_ABI = [
        'function quoteExactInputSingle(((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData)) external returns (uint256 amountOut, uint256 gasEstimate)'
      ];

      const quoteProvider = provider ?? readOnlyProvider;
      if (!quoteProvider) {
        throw new Error('Provider not available for V4 quoting.');
      }

      const quoter = new ethers.Contract(V4_QUOTER_ADDRESS, V4_QUOTER_ABI, quoteProvider);
      try {
        const result = await quoter.callStatic.quoteExactInputSingle({
          poolKey: {
            currency0: tokenIn.address < tokenOut.address ? tokenIn.address : tokenOut.address,
            currency1: tokenIn.address < tokenOut.address ? tokenOut.address : tokenIn.address,
            fee: poolInfo.fee,
            tickSpacing: poolInfo.tickSpacing,
            hooks: poolInfo.hooks,
          },
          zeroForOne: tokenIn.address < tokenOut.address,
          exactAmount: amountIn,
          hookData: poolInfo.hookData || '0x',
        });
        return result.amountOut ?? result[0];
      } catch (quoterError: any) {
        throw new Error(
          quoterError?.reason ||
          quoterError?.errorName ||
          quoterError?.message ||
          `V4 quoter failed for ${tokenIn.symbol}/${tokenOut.symbol}.`
        );
      }
    },
    [provider, readOnlyProvider]
  );

  const calculateTrade = useCallback(
    async (
      inputToken: Token,
      outputToken: Token,
      amount: string
    ): Promise<V4TradeResult | null> => {
      if (!(provider || readOnlyProvider) || !amount || parseFloat(amount) <= 0) {
        return null;
      }

      setTradeState(prev => ({ ...prev, isCalculating: true, error: null }));
      debugStepsRef.current = [];
      setTradeState(prev => ({ ...prev, debugSteps: [] }));
      const debugSteps: RouteDebugStep[] = [];
      const addDebugStep = (step: RouteDebugStep) => {
        debugSteps.push(step);
        pushDebugStep(step);
      };

      try {
        if (inputToken.address.toLowerCase() === outputToken.address.toLowerCase()) {
          throw new Error('Input and output tokens must be different.');
        }

        const isWrapPair =
          (inputToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase() &&
            outputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) ||
          (inputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase() &&
            outputToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase());

        if (isWrapPair) {
          throw new Error('ETH/WETH is a wrap operation, not a swap. Use wrap or unwrap instead.');
        }

        const bridges = getRouteBridgeTokens(inputToken, outputToken).slice(0, 7);
        const candidates: V4RouteCandidate[] = [];
        addDebugStep({
          label: 'V4 direct discovery',
          status: 'info',
          details: `Scanning direct pools for ${inputToken.symbol}/${outputToken.symbol}`,
        });
        const directPools = await withTimeout(
          findDirectV4Pools(inputToken, outputToken),
          V4_ROUTE_TIMEOUT_MS,
          `V4 discovery timed out for ${inputToken.symbol}/${outputToken.symbol}.`
        );
        addDebugStep({
          label: 'V4 direct discovery',
          status: directPools.length > 0 ? 'success' : 'error',
          details: `Found ${directPools.length} direct pool candidate(s)`,
        });

        if (directPools.length > 0) {
          const amountIn = ethers.utils.parseUnits(amount, inputToken.decimals);
          for (const pool of directPools.slice(0, V4_MAX_DIRECT_POOLS)) {
            try {
              const amountOut = await quoteV4Hop(pool, inputToken, outputToken, amountIn);
              addDebugStep({
                label: 'V4 direct quote',
                status: 'success',
                details: `Quoted direct pool fee=${pool.fee} tickSpacing=${pool.tickSpacing} hooks=${pool.hooks} amountOut=${ethers.utils.formatUnits(amountOut, outputToken.decimals)}`,
              });
              candidates.push({
                poolPath: [pool],
                pathTokens: [inputToken, outputToken],
                amountOut,
              });
            } catch {
              addDebugStep({
                label: 'V4 direct quote',
                status: 'error',
                details: `Quote failed for fee=${pool.fee} tickSpacing=${pool.tickSpacing} hooks=${pool.hooks}`,
              });
              continue;
            }
          }
        }

        if (candidates.length === 0) {
          const limitedBridges = bridges.slice(0, V4_MAX_BRIDGES);
          addDebugStep({
            label: 'V4 bridge discovery',
            status: 'info',
            details: `Trying ${limitedBridges.length} bridge token(s): ${limitedBridges.map(token => token.symbol).join(', ')}`,
          });
          const oneHopPaths = limitedBridges.map(bridge => [inputToken, bridge, outputToken]);

          for (const pathTokens of oneHopPaths) {
            const poolPath: V4PoolInfo[] = [];
            let currentAmount = ethers.utils.parseUnits(amount, pathTokens[0].decimals);
            let pathValid = true;

            for (let i = 0; i < pathTokens.length - 1; i++) {
              let discoveredPools: V4PoolInfo[] = [];
              try {
                discoveredPools = await withTimeout(
                  findDirectV4Pools(pathTokens[i], pathTokens[i + 1]),
                  Math.floor(V4_ROUTE_TIMEOUT_MS / 2),
                  `V4 hop discovery timed out for ${pathTokens[i].symbol}/${pathTokens[i + 1].symbol}.`
                );
              } catch {
                pathValid = false;
                break;
              }

              if (discoveredPools.length === 0) {
                addDebugStep({
                  label: 'V4 bridge hop',
                  status: 'error',
                  details: `No pools for ${pathTokens[i].symbol}/${pathTokens[i + 1].symbol}`,
                });
                pathValid = false;
                break;
              }

              let bestPoolForHop: V4PoolInfo | null = null;
              let bestAmountForHop: ethers.BigNumber | null = null;

              for (const pool of discoveredPools.slice(0, 4)) {
                try {
                  const quoted = await quoteV4Hop(pool, pathTokens[i], pathTokens[i + 1], currentAmount);
                  if (!bestAmountForHop || quoted.gt(bestAmountForHop)) {
                    bestAmountForHop = quoted;
                    bestPoolForHop = pool;
                  }
                } catch {
                  continue;
                }
              }

              if (!bestPoolForHop || !bestAmountForHop) {
                addDebugStep({
                  label: 'V4 bridge hop',
                  status: 'error',
                  details: `Quotes failed for ${pathTokens[i].symbol}/${pathTokens[i + 1].symbol}`,
                });
                pathValid = false;
                break;
              }

              currentAmount = bestAmountForHop;
              poolPath.push(bestPoolForHop);
            }

            if (pathValid && poolPath.length > 0) {
              addDebugStep({
                label: 'V4 bridge route',
                status: 'success',
                details: `Built route ${pathTokens.map(token => token.symbol).join(' -> ')}`,
              });
              candidates.push({
                poolPath,
                pathTokens,
                amountOut: currentAmount,
              });
            }
          }
        }

        if (candidates.length === 0) {
          addDebugStep({
            label: 'V4 result',
            status: 'error',
            details: `No v4 route candidates survived discovery or quoting`,
          });
          throw new Error(`No V4 pool found for ${inputToken.symbol}/${outputToken.symbol}. Falling back to V3.`);
        }

        candidates.sort((a, b) => {
          if (!a.amountOut.eq(b.amountOut)) {
            return a.amountOut.gt(b.amountOut) ? -1 : 1;
          }

          if (a.poolPath.length !== b.poolPath.length) {
            return a.poolPath.length - b.poolPath.length;
          }

          const aLiquidity = a.poolPath.reduce((sum, pool) => sum + BigInt(pool.liquidity), 0n);
          const bLiquidity = b.poolPath.reduce((sum, pool) => sum + BigInt(pool.liquidity), 0n);
          if (aLiquidity === bLiquidity) return 0;
          return aLiquidity > bLiquidity ? -1 : 1;
        });

        const bestCandidate = candidates[0];
        addDebugStep({
          label: 'V4 candidate selection',
          status: 'success',
          details: `Selected best candidate ${bestCandidate.pathTokens.map(token => token.symbol).join(' -> ')} amountOut=${ethers.utils.formatUnits(bestCandidate.amountOut, outputToken.decimals)}`,
        });
        const poolPath = bestCandidate.poolPath;
        const pathTokens = bestCandidate.pathTokens;
        const quotedAmount = bestCandidate.amountOut;

        const outputAmount = ethers.utils.formatUnits(quotedAmount, outputToken.decimals);
        const slippageAmount = (parseFloat(outputAmount) * (DEFAULT_SLIPPAGE / 10000));
        const minimumReceived = (parseFloat(outputAmount) - slippageAmount).toFixed(6);

        const inputFloat = parseFloat(amount);
        const outputFloat = parseFloat(outputAmount);
        const executionPrice = outputFloat > 0
          ? (outputFloat / inputFloat).toFixed(6)
          : '0';

        const priceImpact = '0.00';
        
        const feeTier = poolPath
          .map(poolInfo => poolInfo.fee === FeeAmount.LOWEST ? '0.01%'
            : poolInfo.fee === FeeAmount.LOW ? '0.05%'
            : poolInfo.fee === FeeAmount.MEDIUM ? '0.3%'
            : '1%')
          .join(' -> ');

        const tradeRoute: TradeRoute = {
          version: 'V4',
          inputAmount: amount,
          outputAmount,
          inputAddress: inputToken.address,
          outputAddress: outputToken.address,
          inputSymbol: inputToken.symbol || 'TOKEN',
          outputSymbol: outputToken.symbol || 'TOKEN',
          executionPrice,
          priceImpact,
          minimumReceived,
          fee: poolPath.reduce((total, pool) => total + pool.fee, 0),
          feeTier,
          path: pathTokens.map(token => token.address),
          pathSymbols: pathTokens.map(token => token.symbol || 'TOKEN'),
          isNativeInput: inputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase(),
          isNativeOutput: outputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase(),
          isMultiHop: poolPath.length > 1,
        };

        setTradeState({
          poolPath,
          route: tradeRoute,
          isCalculating: false,
          error: null,
          debugSteps: [
            ...debugSteps,
            {
              label: 'V4 result',
              status: 'success',
              details: `Selected route ${pathTokens.map(token => token.symbol).join(' -> ')} using ${poolPath.length} pool(s); top pool fee=${poolPath[0]?.fee} tickSpacing=${poolPath[0]?.tickSpacing} hooks=${poolPath[0]?.hooks}`,
            },
          ],
        });

        return {
          inputAmount: amount,
          outputAmount,
          route: tradeRoute,
          poolAddress: poolPath[0].poolAddress,
          poolPath,
          debugSteps: debugSteps,
        };
      } catch (error: any) {
        const finalError = error.message || 'Failed to calculate V4 trade';
        const hasTerminalError = debugStepsRef.current.some(
          step => step.label === 'V4 result' && step.status === 'error' && step.details === finalError
        );
        if (!hasTerminalError) {
          pushDebugStep({
            label: 'V4 result',
            status: 'error',
            details: finalError,
          });
        }
        setTradeState(prev => ({
          ...prev,
          isCalculating: false,
          error: finalError,
          debugSteps: [...debugStepsRef.current],
        }));
        return null;
      }
    },
    [provider, readOnlyProvider, findDirectV4Pools, quoteV4Hop]
  );

  const executeTrade = useCallback(
    async (
      poolPath: V4PoolInfo[],
      route: TradeRoute,
      _account: string,
      slippage: number,
      deadline: number
    ): Promise<ethers.providers.TransactionReceipt> => {
      if (!signer || !poolPath.length || !route) {
        throw new Error('Wallet not connected or trade not calculated');
      }

      const { executeV4Swap } = await import('@/utils/v4UniversalRouter');

      const ethToken = new Token(CHAIN_ID, NATIVE_ETH_ADDRESS, 18, 'ETH', 'Ethereum');
      const tokenIn = route.inputAddress.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()
        ? ethToken
        : poolPath[0].token0.address.toLowerCase() === route.inputAddress.toLowerCase()
        ? poolPath[0].token0
        : poolPath[0].token1;
      const tokenOut = route.outputAddress.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()
        ? ethToken
        : poolPath[poolPath.length - 1].token0.address.toLowerCase() === route.outputAddress.toLowerCase()
        ? poolPath[poolPath.length - 1].token0
        : poolPath[poolPath.length - 1].token1;
      const pathTokens = [tokenIn];

      for (const pool of poolPath) {
        const previous = pathTokens[pathTokens.length - 1];
        const nextToken =
          pool.token0.address.toLowerCase() === previous.address.toLowerCase()
            ? pool.token1
            : pool.token0;
        pathTokens.push(nextToken);
      }

      const slippageBips = Math.floor(slippage * 100);
      const amountOutBN = ethers.utils.parseUnits(route.outputAmount, tokenOut.decimals);
      const minAmountOut = amountOutBN.mul(10000 - slippageBips).div(10000);

      const tx = await executeV4Swap(
        {
          tokenIn,
          tokenOut,
          pathTokens,
          amountIn: route.inputAmount,
          amountOut: route.outputAmount,
          minAmountOut: minAmountOut.toString(),
          fee: poolPath[0].fee,
          poolId: poolPath[0].poolAddress,
          poolPath,
          useNativeInput: route.isNativeInput,
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
      poolPath: [],
      route: null,
      isCalculating: false,
      error: null,
      debugSteps: [],
    });
    debugStepsRef.current = [];
  }, []);

  return {
    ...tradeState,
    calculateTrade,
    executeTrade,
    clearTrade,
    getDebugSteps: () => [...debugStepsRef.current],
    findV4Pool: async (tokenA: Token, tokenB: Token) => {
      const pools = await findDirectV4Pools(tokenA, tokenB);
      return pools[0] ?? null;
    },
  };
};
