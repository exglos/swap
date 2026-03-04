/**
 * Pre-computed V4 Pool Registry
 * 
 * Maps common token pairs to their known V4 pool parameters.
 * This bypasses expensive event scanning for popular pairs.
 * 
 * Key format: "tokenA-tokenB" (sorted by address, lowercase)
 */

export const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface V4PoolConfig {
  fee: number;
  tickSpacing: number;
  hooks: string;
  description?: string;
}

export const V4_CORE_REGISTRY: Record<string, V4PoolConfig> = {
  // ETH / USDC (0.05% fee, 10 tick spacing - High Volume)
  '0x0000000000000000000000000000000000000000-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
    fee: 500,
    tickSpacing: 10,
    hooks: '0x0000000000000000000000000000000000000000',
    description: 'ETH/USDC 0.05%',
  },
  // ETH / DAI (0.3% fee, 60 tick spacing)
  '0x0000000000000000000000000000000000000000-0x6b175474e89094c44da98b954eedeac495271d0f': {
    fee: 3000,
    tickSpacing: 60,
    hooks: '0x0000000000000000000000000000000000000000',
    description: 'ETH/DAI 0.3%',
  },
  // ETH / WBTC (0.3% fee, 60 tick spacing)
  '0x0000000000000000000000000000000000000000-0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': {
    fee: 3000,
    tickSpacing: 60,
    hooks: '0x0000000000000000000000000000000000000000',
    description: 'ETH/WBTC 0.3%',
  },
};

/**
 * Get registry key for a token pair
 */
export function getRegistryKey(tokenA: string, tokenB: string): string {
  const [addr0, addr1] = [tokenA.toLowerCase(), tokenB.toLowerCase()].sort();
  return `${addr0}-${addr1}`;
}

/**
 * Check if a pool configuration exists in the registry
 */
export function getPoolConfig(tokenA: string, tokenB: string): V4PoolConfig | null {
  const key = getRegistryKey(tokenA, tokenB);
  return V4_CORE_REGISTRY[key] || null;
}
