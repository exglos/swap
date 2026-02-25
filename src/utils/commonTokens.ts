import { Token } from '@uniswap/sdk-core';
import { ChainId } from '@uniswap/sdk-core';

/**
 * Common tokens for quick selection and validation
 * These are well-known tokens with verified addresses
 */

export const COMMON_TOKENS: Token[] = [
  // Ethereum
  new Token(ChainId.MAINNET, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether'),
  
  // Stablecoins
  new Token(ChainId.MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin'),
  new Token(ChainId.MAINNET, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'USDT', 'Tether USD'),
  new Token(ChainId.MAINNET, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'Dai Stablecoin'),
  new Token(ChainId.MAINNET, '0x4Fabb145d64652a948D72533023f6E7A623C7C53', 18, 'BUSD', 'Binance USD'),
  
  // Major DeFi Tokens
  new Token(ChainId.MAINNET, '0x514910771AF9Ca656af840dff83E8264EcF986CA', 18, 'LINK', 'ChainLink Token'),
  new Token(ChainId.MAINNET, '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, 'UNI', 'Uniswap Token'),
  new Token(ChainId.MAINNET, '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18, 'AAVE', 'Aave Token'),
  new Token(ChainId.MAINNET, '0xC011a73a8540C674C7771DbB9D7a3f3F0c7B5c46', 18, 'SNX', 'Synthetix Network Token'),
  new Token(ChainId.MAINNET, '0xD533a949740bb3306d119CC777fa900bA034cd52', 18, 'CRV', 'Curve DAO Token'),
  new Token(ChainId.MAINNET, '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 8, 'WBTC', 'Wrapped Bitcoin'),
  
  // Gaming & NFT Tokens
  new Token(ChainId.MAINNET, '0x3845badAde8e6dFFA943578D8891A80A7C9a9eDf', 18, 'SAND', 'The Sandbox'),
  new Token(ChainId.MAINNET, '0xF629C45dD377d1F0338F9646e7d357B786d0Aa96', 18, 'MANA', 'Decentraland'),
  new Token(ChainId.MAINNET, '0x2E3D86072119b6c5EAe7b9a5079C3637b6A6Aa0A', 18, 'AXS', 'Axie Infinity'),
  new Token(ChainId.MAINNET, '0x99e92123eB77Bc8db4d6130F5AB26B9cA1dF7d64', 18, 'ENJ', 'Enjin Coin'),
  
  // Layer 2 Tokens
  new Token(ChainId.MAINNET, '0xA0b73E1Ff0B80914AB6fe0444E65D68223686B82', 18, 'ARB', 'Arbitrum Token'),
  new Token(ChainId.MAINNET, '0x4200000000000000000000000000000000000006', 18, 'OPT', 'Optimism'),
  new Token(ChainId.MAINNET, '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', 18, 'WMATIC', 'Wrapped Matic'),
  
  // Meme Tokens (popular but higher risk)
  new Token(ChainId.MAINNET, '0x6982508985B34BfA1AE8Aa2194f6B94508680003', 18, 'PEPE', 'Pepe'),
  new Token(ChainId.MAINNET, '0x95aD61b0a150d79dc191aF1CaC14d702722d2E6B', 18, 'SHIB', 'Shiba Inu'),
  new Token(ChainId.MAINNET, '0x3ee2200efb3400aebb4ffcfb8c0951255f5bb40e', 18, 'FLOKI', 'FLOKI'),
  
  // Oracle & Data Tokens
  new Token(ChainId.MAINNET, '0x5d3a536E4D6DbE1d9E42A157bF13d3d9D7F11C0E', 18, 'COMP', 'Compound'),
  new Token(ChainId.MAINNET, '0x9BE89D2A3d8886dA418C0A1Dca4C8C5D534B5C81', 18, 'MKR', 'Maker'),
  new Token(ChainId.MAINNET, '0x198336f917a3716E9ca41249d7F8A93e9DC9e4d9', 18, 'YFI', 'yearn.finance'),
];

export const TOKEN_CATEGORIES = {
  ETHEREUM: 'Ethereum',
  STABLECOIN: 'Stablecoins',
  DEFI: 'DeFi Tokens',
  GAMING: 'Gaming & NFT',
  LAYER2: 'Layer 2 Tokens',
  MEME: 'Meme Tokens',
  ORACLE: 'Oracle & Data',
} as const;

export const CATEGORIZED_TOKENS = {
  [TOKEN_CATEGORIES.ETHEREUM]: COMMON_TOKENS.filter(t => t.symbol === 'WETH'),
  [TOKEN_CATEGORIES.STABLECOIN]: COMMON_TOKENS.filter(t => 
    ['USDC', 'USDT', 'DAI', 'BUSD'].includes(t.symbol || '')
  ),
  [TOKEN_CATEGORIES.DEFI]: COMMON_TOKENS.filter(t => 
    ['LINK', 'UNI', 'AAVE', 'SNX', 'CRV', 'WBTC', 'COMP', 'MKR', 'YFI'].includes(t.symbol || '')
  ),
  [TOKEN_CATEGORIES.GAMING]: COMMON_TOKENS.filter(t => 
    ['SAND', 'MANA', 'AXS', 'ENJ'].includes(t.symbol || '')
  ),
  [TOKEN_CATEGORIES.LAYER2]: COMMON_TOKENS.filter(t => 
    ['ARB', 'OPT', 'WMATIC'].includes(t.symbol || '')
  ),
  [TOKEN_CATEGORIES.MEME]: COMMON_TOKENS.filter(t => 
    ['PEPE', 'SHIB', 'FLOKI'].includes(t.symbol || '')
  ),
  [TOKEN_CATEGORIES.ORACLE]: COMMON_TOKENS.filter(t => 
    ['COMP', 'MKR', 'YFI'].includes(t.symbol || '')
  ),
};

/**
 * Check if a token address is in the common tokens list
 */
export function isCommonToken(address: string): boolean {
  return COMMON_TOKENS.some(token => 
    token.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Get token by address from common tokens
 */
export function getCommonToken(address: string): Token | undefined {
  return COMMON_TOKENS.find(token => 
    token.address.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Search common tokens by symbol or name
 */
export function searchCommonTokens(query: string): Token[] {
  const lowerQuery = query.toLowerCase();
  return COMMON_TOKENS.filter(token => 
    (token.symbol?.toLowerCase() || '').includes(lowerQuery) ||
    (token.name?.toLowerCase() || '').includes(lowerQuery)
  );
}
