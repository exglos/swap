import { Token, TradeType } from '@uniswap/sdk-core';
import { Pool as V3Pool } from '@uniswap/v3-sdk';
import { Trade as V3Trade } from '@uniswap/v3-sdk';

export type UniswapVersion = 'V3' | 'V4';

export interface V3PoolInfo {
  pool: V3Pool;
  token0: Token;
  token1: Token;
  fee: number;
  liquidity: string;
  sqrtPriceX96: string;
  tick: number;
}

export interface V4PoolInfo {
  poolAddress: string;
  token0: Token;
  token1: Token;
  fee: number;
  liquidity: string;
  hookData?: string;
}

export interface TradeRoute {
  version: UniswapVersion;
  inputAmount: string;
  outputAmount: string;
  executionPrice: string;
  priceImpact: string;
  minimumReceived: string;
  fee: number;
  feeTier: string;
  path: string[];
  gasEstimate?: string;
}

export interface V3TradeResult {
  trade: V3Trade<Token, Token, TradeType>;
  route: TradeRoute;
  pool: V3Pool;
}

export interface V4TradeResult {
  inputAmount: string;
  outputAmount: string;
  route: TradeRoute;
  poolAddress: string;
}

export interface MultiVersionTradeState {
  primaryRoute: TradeRoute | null;
  fallbackRoute: TradeRoute | null;
  selectedRoute: TradeRoute | null;
  isCalculating: boolean;
  error: string | null;
  version: UniswapVersion | null;
}

export interface PoolDiscoveryResult {
  version: UniswapVersion;
  poolExists: boolean;
  poolInfo?: V3PoolInfo | V4PoolInfo;
  error?: string;
}

export interface QuoteParams {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  fee?: number;
}

export interface SwapParams {
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOutMinimum: string;
  recipient: string;
  deadline: number;
  fee: number;
}

export const FEE_AMOUNT = {
  LOWEST: 100,
  LOW: 500,
  MEDIUM: 3000,
  HIGH: 10000,
} as const;

export type FeeAmount = typeof FEE_AMOUNT[keyof typeof FEE_AMOUNT];
