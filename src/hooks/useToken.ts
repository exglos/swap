import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { CHAIN_ID, ERC20_ABI } from '@/utils/constants';

interface TokenInfo {
  token: Token | null;
  name: string;
  symbol: string;
  decimals: number;
  hasLiquidity: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useToken = (provider: ethers.providers.Web3Provider | null, readOnlyProvider: ethers.providers.JsonRpcProvider) => {

  const [tokenInfo, setTokenInfo] = useState<TokenInfo>({
    token: null,
    name: '',
    symbol: '',
    decimals: 0,
    hasLiquidity: true,
    isLoading: false,
    error: null,
  });

  const fetchTokenInfo = useCallback(async (tokenAddress: string) => {
    // use a readonly provider for when injected provider is not available yet to handle token info display
    const defaultProvider = !provider ? readOnlyProvider : provider

    if (!ethers.utils.isAddress(tokenAddress)) {
      setTokenInfo(prev => ({ 
        ...prev, 
        error: 'Invalid token address format. Please check the address and try again.',
        isLoading: false 
      }));
      return;
    }

    setTokenInfo(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, defaultProvider);
      
      // Add timeout to prevent hanging requests
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Token info request timed out')), 10000)
      );

      // Fetch token info with timeout
      const [name, symbol, decimals] = await Promise.race([
        Promise.all([
          tokenContract.name(),
          tokenContract.symbol(),
          tokenContract.decimals()
        ]),
        timeoutPromise.then(() => {
          throw new Error('Token info request timed out');
        })
      ]);

      // Validate decimals
      const decimalsNum = Number(decimals);
      if (isNaN(decimalsNum) || decimalsNum < 0 || decimalsNum > 255) {
        throw new Error('Invalid token decimals');
      }

      // Validate symbol and name
      if (!symbol || typeof symbol !== 'string') {
        throw new Error('Invalid token symbol');
      }

      if (!name || typeof name !== 'string') {
        throw new Error('Invalid token name');
      }

      // Create token object
      const token = new Token(CHAIN_ID, tokenAddress, decimalsNum, symbol, name);

      setTokenInfo({
        token,
        name,
        symbol,
        decimals: decimalsNum,
        hasLiquidity: true,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      console.error('Error fetching token info:', error);
      
      let errorMessage = 'Failed to fetch token information';
      
      // Provide specific error messages based on common issues
      if (error.code === 'CALL_EXCEPTION') {
        errorMessage = 'Contract does not exist or is not a valid ERC20 token';
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection and try again';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. The token contract might be unresponsive';
      } else if (error.message?.includes('Invalid token')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setTokenInfo(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        token: null,
        name: '',
        symbol: '',
        decimals: 0,
      }));
    }
  }, [provider]);

  const clearTokenInfo = useCallback(() => {
    setTokenInfo({
      token: null,
      name: '',
      symbol: '',
      decimals: 0,
      hasLiquidity: true,
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
