import { Token } from '@uniswap/sdk-core';
import { CHAIN_ID, WETH_ADDRESS } from './constants';
import { NATIVE_ETH_ADDRESS } from './v4PoolRegistry';

export const MAINNET_ROUTE_TOKENS: Token[] = [
  new Token(CHAIN_ID, NATIVE_ETH_ADDRESS, 18, 'ETH', 'Ethereum'),
  new Token(CHAIN_ID, WETH_ADDRESS, 18, 'WETH', 'Wrapped Ether'),
  new Token(CHAIN_ID, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin'),
  new Token(CHAIN_ID, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'USDT', 'Tether'),
  new Token(CHAIN_ID, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'Dai Stablecoin'),
  new Token(CHAIN_ID, '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 8, 'WBTC', 'Wrapped Bitcoin'),
  new Token(CHAIN_ID, '0x514910771AF9Ca656af840dff83E8264EcF986CA', 18, 'LINK', 'Chainlink'),
  new Token(CHAIN_ID, '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, 'UNI', 'Uniswap'),
  new Token(CHAIN_ID, '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18, 'AAVE', 'Aave'),
];

export function getRouteBridgeTokens(tokenA: Token, tokenB: Token): Token[] {
  const blocked = new Set([
    tokenA.address.toLowerCase(),
    tokenB.address.toLowerCase(),
  ]);

  return MAINNET_ROUTE_TOKENS.filter(token => !blocked.has(token.address.toLowerCase()));
}
