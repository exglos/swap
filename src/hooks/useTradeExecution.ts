import { useState } from 'react';
import type { ContractTransactionResponse } from 'ethers';

type TxStatus = { type: 'info' | 'success' | 'error' | 'loading'; message: string } | null;

interface TradeExecutionState {
  txStatus: TxStatus;
  setTxStatus: (status: TxStatus) => void;
  executeTrade: (
    trade: any,
    account: string,
    isBuying: boolean,
    executeTradeCallback: (trade: any, account: string, isBuying: boolean) => Promise<ContractTransactionResponse>,
    onSuccess: () => void
  ) => Promise<void>;
}

export const useTradeExecution = (): TradeExecutionState => {
  const [txStatus, setTxStatus] = useState<TxStatus>(null);

  const executeTrade = async (
    trade: any,
    account: string,
    isBuying: boolean,
    executeTradeCallback: (trade: any, account: string, isBuying: boolean) => Promise<ContractTransactionResponse>,
    onSuccess: () => void
  ) => {
    setTxStatus({ type: 'loading', message: 'Preparing transaction...' });

    try {
      const tx = await executeTradeCallback(trade, account, isBuying);
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
