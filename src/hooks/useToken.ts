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
      // Handle Native ETH (address zero) - not an ERC20 contract
      const NATIVE_ETH = '0x0000000000000000000000000000000000000000';
      if (tokenAddress.toLowerCase() === NATIVE_ETH.toLowerCase()) {
        const token = new Token(CHAIN_ID, NATIVE_ETH, 18, 'ETH', 'Ethereum');
        setTokenInfo({
          token,
          name: 'Ethereum',
          symbol: 'ETH',
          decimals: 18,
          hasLiquidity: true,
          isLoading: false,
          error: null,
        });
        return;
      }

      // Basic address validation - fail fast for invalid addresses
      if (!ethers.utils.isAddress(tokenAddress)) {
        throw new Error('Invalid token address format. Please check the address and try again.');
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, defaultProvider);
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Token info request timed out after 5 seconds')), 5000)
      );

      let name, symbol, decimals;
      let attempts = 0;
      const maxAttempts = 1; // Fast fail - if it times out once, the token is likely invalid
      
      while (attempts < maxAttempts) {
        try {
          [name, symbol, decimals] = await Promise.race([
            Promise.all([
              tokenContract.name().catch(() => { throw new Error('Failed to fetch token name'); }),
              tokenContract.symbol().catch(() => { throw new Error('Failed to fetch token symbol'); }),
              tokenContract.decimals().catch(() => { throw new Error('Failed to fetch token decimals'); })
            ]),
            timeoutPromise.then(() => {
              throw new Error('Token info request timed out after 5 seconds');
            })
          ]);
          break; // Success, exit retry loop
        } catch (raceError: any) {
          attempts++;
          if (attempts >= maxAttempts) {
            if (raceError.message.includes('timed out')) {
              throw new Error('Token address appears to be invalid or the contract is not responding. Please check the token address and try again.');
            }
            throw raceError;
          }
          // Wait a bit before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

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
        errorMessage = 'Contract does not exist or is not a valid ERC20 token.\n\nPlease verify:\n• Token address is correct\n• Contract exists on this network\n• Token follows ERC20 standard';
      } else if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection and try again';
      } else if (error.message?.includes('timed out')) {
        errorMessage = error.message; // Use the detailed timeout message we created
      } else if (error.message?.includes('Invalid token')) {
        errorMessage = error.message;
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = `Unable to read token contract data.\n\nThis usually means:\n• Invalid token address\n• Contract on wrong network\n• Token contract is not accessible\n\nPlease check the token address and try again.`;
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
  }, [provider, readOnlyProvider]);

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
