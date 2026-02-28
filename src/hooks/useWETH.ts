import { useCallback, useState } from 'react';
import { ethers } from 'ethers';
import { WETH_ADDRESS } from '@/utils/constants';

const WETH_ABI = [
  "function deposit() public payable",
  "function withdraw(uint wad) public",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint value) public returns (bool)"
];

interface WrapState {
  loading: boolean;
  error: string | null;
  txHash: string | null;
}

export const useWETH = (signer: ethers.Signer | null) => {
  const [wrapState, setWrapState] = useState<WrapState>({
    loading: false,
    error: null,
    txHash: null
  });

  const wrap = useCallback(async (amountInEther: string) => {
    if (!signer) {
      setWrapState({ loading: false, error: 'Wallet not connected', txHash: null });
      return;
    }

    setWrapState({ loading: true, error: null, txHash: null });

    try {
      const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
      const tx = await wethContract.deposit({
        value: ethers.utils.parseEther(amountInEther)
      });

setWrapState({ loading: true, error: null, txHash: tx.hash });

      const receipt = await tx.wait();
      setWrapState({ loading: false, error: null, txHash: receipt.transactionHash });
      return receipt;
    } catch (error: any) {
      console.error('Wrap failed:', error);
      const errorMessage = error.message || 'Failed to wrap ETH';
      setWrapState({ loading: false, error: errorMessage, txHash: null });
      throw error;
    }
  }, [signer]);

  const unwrap = useCallback(async (amountInEther: string) => {
    if (!signer) {
      setWrapState({ loading: false, error: 'Wallet not connected', txHash: null });
      return;
    }

    setWrapState({ loading: true, error: null, txHash: null });

    try {
      const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
      const tx = await wethContract.withdraw(ethers.utils.parseEther(amountInEther));

setWrapState({ loading: true, error: null, txHash: tx.hash });

      const receipt = await tx.wait();
      setWrapState({ loading: false, error: null, txHash: receipt.transactionHash });
      return receipt;
    } catch (error: any) {
      console.error('Unwrap failed:', error);
      const errorMessage = error.message || 'Failed to unwrap WETH';
      setWrapState({ loading: false, error: errorMessage, txHash: null });
      throw error;
    }
  }, [signer]);

  const reset = useCallback(() => {
    setWrapState({ loading: false, error: null, txHash: null });
  }, []);

  return {
    wrap,
    unwrap,
    reset,
    ...wrapState
  };
};
