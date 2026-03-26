// V4 Pool Configuration
// This file manages which token pairs have V4 pools available
// Update this list as V4 adoption grows

export interface V4PairConfig {
  symbol: string;
  address: string;
  decimals: number;
  hasV4Pool: boolean;
  feeTiers?: number[];
}

// Known tokens with their addresses
export const KNOWN_TOKENS: Record<string, V4PairConfig> = {
  ETH: {
    symbol: 'ETH',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    hasV4Pool: false,
  },
  USDC: {
    symbol: 'USDC',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
    hasV4Pool: false, // Change to true when V4 pool is available
  },
  USDT: {
    symbol: 'USDT',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
    hasV4Pool: false, // Change to true when V4 pool is available
  },
  WBTC: {
    symbol: 'WBTC',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    hasV4Pool: false, // Change to true when V4 pool is available
  },
  DAI: {
    symbol: 'DAI',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    hasV4Pool: false, // Change to true when V4 pool is available
  },
  UNI: {
    symbol: 'UNI',
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    decimals: 18,
    hasV4Pool: false, // Change to true when V4 pool is available
  },
  WETH: {
    symbol: 'WETH',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    hasV4Pool: false, // Change to true when V4 pool is available
  },
};

// Generate known V4 pairs list
export const getKnownV4Pairs = (): Set<string> => {
  const pairs = new Set<string>();
  
  Object.entries(KNOWN_TOKENS).forEach(([symbolA, configA]) => {
    Object.entries(KNOWN_TOKENS).forEach(([symbolB, configB]) => {
      if (symbolA !== symbolB && configA.hasV4Pool && configB.hasV4Pool) {
        pairs.add(`${symbolA}/${symbolB}`);
        pairs.add(`${symbolB}/${symbolA}`);
      }
    });
  });
  
  return pairs;
};

// Check if a pair has V4 support
export const hasV4Support = (tokenASymbol: string, tokenBSymbol: string): boolean => {
  const configA = KNOWN_TOKENS[tokenASymbol];
  const configB = KNOWN_TOKENS[tokenBSymbol];
  
  return configA?.hasV4Pool && configB?.hasV4Pool;
};

// Utility to enable V4 for a token
export const enableV4ForToken = (symbol: string) => {
  if (KNOWN_TOKENS[symbol]) {
    KNOWN_TOKENS[symbol].hasV4Pool = true;
    console.log(`✅ Enabled V4 for ${symbol}`);
  }
};

// Utility to enable V4 for a pair
export const enableV4ForPair = (symbolA: string, symbolB: string) => {
  enableV4ForToken(symbolA);
  enableV4ForToken(symbolB);
  console.log(`✅ Enabled V4 for ${symbolA}/${symbolB} pair`);
};
