import { useState } from 'react';
import type { ContractTransaction } from 'ethers';

type TxStatus = { type: 'info' | 'success' | 'error' | 'loading'; message: string } | null;

interface TradeExecutionState {
  txStatus: TxStatus;
  setTxStatus: (status: TxStatus) => void;
  executeTrade: (
    account: string,
    isBuying: boolean,
    executeTradeCallback: (account: string, isBuying: boolean, slippage: number, deadline: number) => Promise<ContractTransaction>,
    onSuccess: () => void,
    slippage: number,
    deadline: number
  ) => Promise<void>;
}

export const useTradeExecution = (): TradeExecutionState => {
  const [txStatus, setTxStatus] = useState<TxStatus>(null);

  const executeTrade = async (
    account: string,
    isBuying: boolean,
    executeTradeCallback: (account: string, isBuying: boolean, slippage: number, deadline: number) => Promise<ContractTransaction>,
    onSuccess: () => void,
    slippage: number,
    deadline: number
  ) => {
    setTxStatus({ type: 'loading', message: 'Preparing transaction...' });

    try {
      const tx = await executeTradeCallback(account, isBuying, slippage, deadline);
      setTxStatus({ type: 'loading', message: `Transaction submitted: ${tx.hash.slice(0, 10)}...` });
      
      await tx.wait();
      setTxStatus({ type: 'success', message: 'Transaction successful!' });
      
      onSuccess();
      
      setTimeout(() => setTxStatus(null), 5000);
    } catch (error: unknown) {
      console.error('Trade error:', error);
      const message = error instanceof Error ? error.message : 'Transaction failed';
      setTxStatus({ type: 'error', message });
    }
  };

  return { txStatus, setTxStatus, executeTrade };
};
