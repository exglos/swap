import { ethers } from 'ethers';
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Pool, Route, Trade, SwapRouter, FeeAmount } from '@uniswap/v3-sdk';
import {
  V3_FACTORY_ADDRESS,
  V3_SWAP_ROUTER_ADDRESS,
  V3_FACTORY_ABI,
  V3_POOL_ABI,
  DEFAULT_SLIPPAGE,
} from './constants';
import { calculateDeadline } from './helpers';

/**
 * V3 Advanced Routing Helper
 * 
 * Implements multi-pool routing and best path selection for V3 swaps.
 * Finds optimal routes across multiple pools to minimize slippage and gas costs.
 */

interface V3PoolInfo {
  pool: Pool;
  poolAddress: string;
  fee: number;
  liquidity: string;
  token0: Token;
  token1: Token;
}

interface V3Route {
  route: Route<Token, Token>;
  trade: Trade<Token, Token, TradeType>;
  pools: V3PoolInfo[];
  expectedOutput: string;
  priceImpact: string;
  gasEstimate: bigint;
  score: number; // Combined score for ranking routes
}

/**
 * Find all possible routes between two tokens
 * 
 * Searches through multiple fee tiers and intermediate tokens
 * to find the best possible route
 */
export async function findAllV3Routes(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: CurrencyAmount<Token>,
  provider: ethers.providers.Provider,
  maxHops: number = 3
): Promise<V3Route[]> {
  const routes: V3Route[] = [];
  const factory = new ethers.Contract(V3_FACTORY_ADDRESS, V3_FACTORY_ABI, provider);
  
  const feeTiers = [FeeAmount.LOWEST, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];

  // Direct routes (single hop)
  for (const fee of feeTiers) {
    try {
      const poolAddress = await factory.getPool(tokenIn.address, tokenOut.address, fee);
      
      if (poolAddress === ethers.constants.AddressZero) continue;

      const poolInfo = await getV3PoolInfo(poolAddress, tokenIn, tokenOut, provider);
      if (!poolInfo) continue;

      const route = new Route([poolInfo.pool], tokenIn, tokenOut);
      const trade = await Trade.fromRoute(route, amountIn, TradeType.EXACT_INPUT);

      const gasEstimate = estimateGasCost(1); // Single hop
      const score = calculateRouteScore(trade, gasEstimate);

      routes.push({
        route,
        trade,
        pools: [poolInfo],
        expectedOutput: trade.outputAmount.toSignificant(6),
        priceImpact: trade.priceImpact.toSignificant(2),
        gasEstimate,
        score,
      });
    } catch (error) {
      continue;
    }
  }

  // Multi-hop routes (if maxHops > 1)
  if (maxHops > 1) {
    // Common intermediate tokens for routing
    const intermediateTokens = await getCommonIntermediateTokens(tokenIn, tokenOut);

    for (const intermediateToken of intermediateTokens) {
      // Try tokenIn → intermediate → tokenOut
      for (const fee1 of feeTiers) {
        for (const fee2 of feeTiers) {
          try {
            const pool1Address = await factory.getPool(tokenIn.address, intermediateToken.address, fee1);
            const pool2Address = await factory.getPool(intermediateToken.address, tokenOut.address, fee2);

            if (pool1Address === ethers.constants.AddressZero || pool2Address === ethers.constants.AddressZero) continue;

            const pool1Info = await getV3PoolInfo(pool1Address, tokenIn, intermediateToken, provider);
            const pool2Info = await getV3PoolInfo(pool2Address, intermediateToken, tokenOut, provider);

            if (!pool1Info || !pool2Info) continue;

            const route = new Route([pool1Info.pool, pool2Info.pool], tokenIn, tokenOut);
            const trade = await Trade.fromRoute(route, amountIn, TradeType.EXACT_INPUT);

            const gasEstimate = estimateGasCost(2); // Two hops
            const score = calculateRouteScore(trade, gasEstimate);

            routes.push({
              route,
              trade,
              pools: [pool1Info, pool2Info],
              expectedOutput: trade.outputAmount.toSignificant(6),
              priceImpact: trade.priceImpact.toSignificant(2),
              gasEstimate,
              score,
            });
          } catch (error) {
            continue;
          }
        }
      }
    }
  }

  return routes;
}

/**
 * Select the best route from available options
 * 
 * Considers output amount, price impact, and gas costs
 */
export function selectBestRoute(routes: V3Route[]): V3Route | null {
  if (routes.length === 0) return null;

  // Sort by score (higher is better)
  routes.sort((a, b) => b.score - a.score);

  return routes[0];
}

/**
 * Calculate route score for ranking
 * 
 * Combines output amount, price impact, and gas cost into a single score
 */
function calculateRouteScore(
  trade: Trade<Token, Token, TradeType>,
  gasEstimate: bigint
): number {
  const outputAmount = parseFloat(trade.outputAmount.toSignificant(6));
  const priceImpact = parseFloat(trade.priceImpact.toSignificant(6));
  const gasCost = Number(gasEstimate) / 1e18; // Convert to ETH

  // Score formula: prioritize output amount, penalize price impact and gas
  // Weights: 70% output, 20% price impact, 10% gas
  const score = (outputAmount * 0.7) - (priceImpact * 0.2) - (gasCost * 0.1);

  return score;
}

/**
 * Estimate gas cost for a route
 */
function estimateGasCost(hops: number): bigint {
  // Rough estimates based on hop count
  const baseGas = 150000n; // Base swap gas
  const hopGas = 100000n;  // Additional gas per hop

  return baseGas + (hopGas * BigInt(hops - 1));
}

/**
 * Get common intermediate tokens for routing
 */
async function getCommonIntermediateTokens(
  tokenIn: Token,
  tokenOut: Token
): Promise<Token[]> {
  const intermediates: Token[] = [];

  // Common routing tokens on mainnet
  const WETH = new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether');
  const USDC = new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin');
  const USDT = new Token(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'USDT', 'Tether USD');
  const DAI = new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'Dai Stablecoin');

  // Don't use tokenIn or tokenOut as intermediates
  const commonTokens = [WETH, USDC, USDT, DAI];
  
  for (const token of commonTokens) {
    if (token.address !== tokenIn.address && token.address !== tokenOut.address) {
      intermediates.push(token);
    }
  }

  return intermediates;
}

/**
 * Get V3 pool information
 */
async function getV3PoolInfo(
  poolAddress: string,
  token0: Token,
  token1: Token,
  provider: ethers.providers.Provider
): Promise<V3PoolInfo | null> {
  try {
    const poolContract = new ethers.Contract(poolAddress, V3_POOL_ABI, provider);

    const [actualToken0, , liquidity, slot0] = await Promise.all([
      poolContract.token0(),
      poolContract.token1(),
      poolContract.liquidity(),
      poolContract.slot0(),
    ]);

    if (liquidity === 0n) return null;

    const [sqrtPriceX96, tick] = slot0;
    const fee = await poolContract.fee();

    // Ensure token order matches pool
    const [poolToken0, poolToken1] = actualToken0.toLowerCase() === token0.address.toLowerCase()
      ? [token0, token1]
      : [token1, token0];

    const pool = new Pool(
      poolToken0,
      poolToken1,
      fee,
      sqrtPriceX96.toString(),
      liquidity.toString(),
      Number(tick)
    );

    return {
      pool,
      poolAddress,
      fee,
      liquidity: liquidity.toString(),
      token0: poolToken0,
      token1: poolToken1,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Execute a V3 trade with the best route
 */
export async function executeV3AdvancedTrade(
  route: V3Route,
  account: string,
  signer: ethers.Signer
): Promise<ethers.ContractTransaction> {
  const slippageTolerance = new Percent(DEFAULT_SLIPPAGE, 10000);
  const deadline = calculateDeadline(20);

  const methodParameters = SwapRouter.swapCallParameters([route.trade], {
    slippageTolerance,
    recipient: account,
    deadline,
  });

  const routerContract = new ethers.Contract(
    V3_SWAP_ROUTER_ADDRESS,
    ['function multicall(uint256 deadline, bytes[] calldata data) payable returns (bytes[] memory)'],
    signer
  );

  const isETHInput = route.trade.inputAmount.currency.isNative;
  const value = isETHInput ? ethers.utils.parseEther(route.trade.inputAmount.toExact()) : 0;

  const tx = await routerContract.multicall(deadline, [methodParameters.calldata], { value });

  return tx;
}
