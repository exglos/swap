import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { CHAIN_ID, ERC20_ABI } from '@/utils/constants';

// Multicall3 Address is the same on almost all chains: 0xcA11bde05977b3631167028862bE2a173976CA11
const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL_ABI = [
  'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)'
];
const TOKEN_METADATA_TIMEOUT_MS = 12000;

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
    decimals: 18,
    hasLiquidity: false,
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
      if (tokenAddress === ethers.constants.AddressZero) {
        const token = new Token(CHAIN_ID, tokenAddress, 18, 'ETH', 'Ethereum');
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

      const erc20Interface = new ethers.utils.Interface(ERC20_ABI);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, defaultProvider);

      const readTokenMetadata = async () => {
        const multicall = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, defaultProvider);
        const calls = [
          { target: tokenAddress, callData: erc20Interface.encodeFunctionData('name') },
          { target: tokenAddress, callData: erc20Interface.encodeFunctionData('symbol') },
          { target: tokenAddress, callData: erc20Interface.encodeFunctionData('decimals') },
        ];

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Multicall timed out')), TOKEN_METADATA_TIMEOUT_MS)
        );

        try {
          const [, returnData] = await Promise.race([
            multicall.aggregate(calls),
            timeoutPromise
          ]) as [any, string[]];

          return {
            name: erc20Interface.decodeFunctionResult('name', returnData[0])[0],
            symbol: erc20Interface.decodeFunctionResult('symbol', returnData[1])[0],
            decimals: erc20Interface.decodeFunctionResult('decimals', returnData[2])[0],
          };
        } catch (multicallError) {
          console.warn('Token multicall failed, falling back to direct ERC20 reads:', multicallError);
          const [name, symbol, decimals] = await Promise.all([
            tokenContract.name(),
            tokenContract.symbol(),
            tokenContract.decimals(),
          ]);

          return { name, symbol, decimals };
        }
      };

      const { name, symbol, decimals } = await readTokenMetadata();

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
      console.error('Token metadata error:', error);
      setTokenInfo(prev => ({
        ...prev,
        isLoading: false,
        error: `Failed to fetch token. Ensure you are on the correct network. ${error.message || error}`,
        token: null,
      }));
    }
  }, [provider, readOnlyProvider]);

  const clearTokenInfo = useCallback(() => {
    setTokenInfo({
      token: null,
      name: '',
      symbol: '',
      decimals: 18,
      hasLiquidity: false,
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
