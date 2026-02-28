import { toast } from 'sonner';

export const showTransactionToast = (promise: Promise<any>, description?: string) => {
  return toast.promise(promise, {
    loading: description ? `Sending transaction: ${description}` : 'Sending transaction...',
    success: (tx: any) => {
      const hash = tx.hash.slice(0, 10) + '...' + tx.hash.slice(-8);
      return `Transaction Confirmed! ${hash} - View on Etherscan`;
    },
    error: (err: any) => {
      console.error('Transaction error:', err);
      
      // Handle specific error types
      if (err.message?.includes('user rejected') || err.message?.includes('user denied')) {
        return 'Transaction cancelled by user';
      } else if (err.message?.includes('insufficient funds')) {
        return 'Insufficient funds for gas';
      } else if (err.message?.includes('execution reverted')) {
        return 'Transaction reverted - check slippage settings';
      } else if (err.message?.includes('nonce')) {
        return 'Nonce error - try again';
      } else if (err.message?.includes('gas')) {
        return 'Gas estimation failed - network may be congested';
      }
      
      return 'Transaction failed';
    },
  });
};

export const showWrapToast = (promise: Promise<any>, amount: string, operation: 'wrap' | 'unwrap') => {
  const operationText = operation === 'wrap' ? 'Wrapping' : 'Unwrapping';
  
  return toast.promise(promise, {
    loading: `${operationText} ${amount} ETH...`,
    success: (tx: any) => {
      const hash = tx.hash.slice(0, 10) + '...' + tx.hash.slice(-8);
      return `${operationText} Successful! ${amount} ETH → ${amount} ${operation === 'wrap' ? 'WETH' : 'ETH'} - ${hash}`;
    },
    error: (err: any) => {
      console.error('Wrap error:', err);
      
      if (err.message?.includes('user rejected')) {
        return `${operationText} cancelled`;
      }
      
      return `${operationText} failed`;
    },
  });
};

export const showNotification = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
  return toast(message, {
    description: type === 'warning' ? 'Please review your settings' : undefined,
  });
};
