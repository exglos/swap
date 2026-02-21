import { ChainId } from '@uniswap/sdk-core';

export const CHAIN_ID = ChainId.MAINNET;

export const ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
export const FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
export const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

export const DEFAULT_SLIPPAGE = 50; // 0.5% in basis points
export const DEFAULT_DEADLINE = 20 * 60; // 20 minutes in seconds

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export const ROUTER_ABI = [
  'function WETH() pure returns (address)',
  'function factory() pure returns (address)',
  'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
];

export const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) view returns (address pair)',
];

export const PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
];
