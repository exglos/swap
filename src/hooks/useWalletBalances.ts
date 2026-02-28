import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { WETH_ADDRESS, ERC20_ABI } from '@/utils/constants';

interface WalletBalances {
  eth: string;
  weth: string;
  loading: boolean;
}

export const useWalletBalances = (provider: ethers.providers.Web3Provider | null, account: string | null) => {
  const [balances, setBalances] = useState<WalletBalances>({ eth: '0', weth: '0', loading: true });

  const fetchBalances = async () => {
    if (!provider || !account) {
      setBalances({ eth: '0', weth: '0', loading: false });
      return;
    }

    try {
      // Get native ETH balance
      const ethBalance = await provider.getBalance(account);
      const ethFormatted = ethers.utils.formatEther(ethBalance);
      
      // Get WETH balance
      const wethContract = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, provider);
      const wethBalance = await wethContract.balanceOf(account);
      const wethFormatted = ethers.utils.formatEther(wethBalance);

      
      setBalances({
        eth: ethFormatted,
        weth: wethFormatted,
        loading: false
      });
    } catch (error: any) {
      setBalances({ eth: '0', weth: '0', loading: false });
    }
  };

  useEffect(() => {
    fetchBalances();
  }, [provider, account]);

  const refresh = () => {
    setBalances(prev => ({ ...prev, loading: true }));
    fetchBalances();
  };

  return { ...balances, refresh };
};
