import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Token, CurrencyAmount } from '@uniswap/sdk-core';
import { Pair } from '@uniswap/v2-sdk';
import { CHAIN_ID, ERC20_ABI, FACTORY_ABI, PAIR_ABI, FACTORY_ADDRESS, WETH_ADDRESS } from '@/utils/constants';

interface TokenInfo {
  token: Token | null;
  name: string;
  symbol: string;
  decimals: number;
  hasLiquidity: boolean;
  pair: Pair | null;
  liquidityETH?: string;
  liquidityToken?: string;
  isLoading: boolean;
  error: string | null;
}

export const useToken = (provider: ethers.BrowserProvider | null) => {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    token: null,
    name: '',
    symbol: '',
    decimals: 0,
    hasLiquidity: false,
    pair: null,
    isLoading: false,
    error: null,
  });

  const fetchTokenInfo = useCallback(async (tokenAddress: string) => {
    if (!provider || !ethers.isAddress(tokenAddress)) {
      setTokenInfo(prev => ({ ...prev, error: 'Invalid token address' }));
      return;
    }

    setTokenInfo(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
      ]);

      const token = new Token(CHAIN_ID, tokenAddress, Number(decimals), symbol, name);

      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const pairAddress = await factoryContract.getPair(tokenAddress, WETH_ADDRESS);
      
      const hasLiquidity = pairAddress !== ethers.ZeroAddress;
      let pair: Pair | null = null;

      let liquidityETH: string | undefined;
      let liquidityToken: string | undefined;

      if (hasLiquidity) {
        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
        const [reserves, token0Address] = await Promise.all([
          pairContract.getReserves(),
          pairContract.token0(),
        ]);

        const wethToken = new Token(CHAIN_ID, WETH_ADDRESS, 18, 'WETH', 'Wrapped Ether');
        const [token0, token1] = token0Address.toLowerCase() === tokenAddress.toLowerCase()
          ? [token, wethToken]
          : [wethToken, token];

        const reserve0 = CurrencyAmount.fromRawAmount(token0, reserves[0].toString());
        const reserve1 = CurrencyAmount.fromRawAmount(token1, reserves[1].toString());

        pair = new Pair(reserve0, reserve1);

        // Calculate liquidity amounts for display
        const isToken0 = token0Address.toLowerCase() === tokenAddress.toLowerCase();
        liquidityToken = isToken0 
          ? ethers.formatUnits(reserves[0], Number(decimals))
          : ethers.formatUnits(reserves[1], Number(decimals));
        liquidityETH = isToken0
          ? ethers.formatUnits(reserves[1], 18)
          : ethers.formatUnits(reserves[0], 18);
      }

      setTokenInfo({
        token,
        name,
        symbol,
        decimals: Number(decimals),
        hasLiquidity,
        pair,
        liquidityETH,
        liquidityToken,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Error fetching token info:', error);
      setTokenInfo(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to fetch token information',
      }));
    }
  }, [provider]);

  const clearTokenInfo = useCallback(() => {
    setTokenInfo({
      token: null,
      name: '',
      symbol: '',
      decimals: 0,
      hasLiquidity: false,
      pair: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    ...tokenInfo,
    fetchTokenInfo,
    clearTokenInfo,
  };
};
