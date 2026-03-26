import { toast } from 'sonner';

const getErrorMessage = (err: unknown) => {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;

  const errorLike = err as {
    message?: string;
    reason?: string;
    shortMessage?: string;
    data?: { message?: string };
    error?: { message?: string; reason?: string };
  };

  return (
    errorLike.shortMessage ||
    errorLike.reason ||
    errorLike.message ||
    errorLike.data?.message ||
    errorLike.error?.reason ||
    errorLike.error?.message ||
    ''
  );
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const formatBalanceToast = (message: string) => {
  const compactMessage = normalizeWhitespace(message);
  const shortageMatch = compactMessage.match(/Shortage:\s*([0-9.,]+)\s*([A-Z0-9]+)/i);
  const haveNeedMatch = compactMessage.match(/Have:\s*([0-9.,]+)\s*([A-Z0-9]+),\s*Need:\s*([0-9.,]+)\s*([A-Z0-9]+)/i);
  const insufficientMatch = compactMessage.match(/Insufficient\s+([A-Z0-9]+)\s+balance/i);

  if (shortageMatch && insufficientMatch) {
    const [, shortageAmount, shortageSymbol] = shortageMatch;
    const [, tokenSymbol] = insufficientMatch;
    return `Insufficient ${tokenSymbol} balance. Need ${shortageAmount} more ${shortageSymbol}.`;
  }

  if (haveNeedMatch && insufficientMatch) {
    const [, haveAmount, haveSymbol, needAmount, needSymbol] = haveNeedMatch;
    const symbol = insufficientMatch[1];
    return `Insufficient ${symbol} balance. Have ${haveAmount} ${haveSymbol}, need ${needAmount} ${needSymbol}.`;
  }

  if (compactMessage.includes('Insufficient ETH balance')) {
    return 'Insufficient ETH balance for this swap and gas.';
  }

  return insufficientMatch
    ? `Insufficient ${insufficientMatch[1]} balance.`
    : 'Insufficient balance for this swap.';
};

const formatTransactionError = (err: unknown) => {
  const message = getErrorMessage(err);
  const compactMessage = normalizeWhitespace(message);
  const lowerMessage = compactMessage.toLowerCase();

  if (lowerMessage.includes('user rejected') || lowerMessage.includes('user denied')) {
    return 'Transaction cancelled';
  }

  if (lowerMessage.includes('insufficient') && lowerMessage.includes('balance')) {
    return formatBalanceToast(compactMessage);
  }

  if (lowerMessage.includes('insufficient funds')) {
    return 'Insufficient ETH for gas.';
  }

  if (lowerMessage.includes('execution reverted')) {
    return 'Swap reverted. Try a smaller amount or higher slippage.';
  }

  if (lowerMessage.includes('nonce')) {
    return 'Nonce error. Retry the transaction.';
  }

  if (lowerMessage.includes('gas')) {
    return 'Gas estimation failed. Retry in a moment.';
  }

  if (lowerMessage.includes('balance check failed')) {
    return 'Could not verify wallet balance. Retry in a moment.';
  }

  return compactMessage || 'Transaction failed';
};

export const showTransactionToast = (promise: Promise<any>, description?: string) => {
  return toast.promise(promise, {
    loading: description ? `Sending transaction: ${description}` : 'Sending transaction...',
    success: (tx: any) => {
      if (!tx || (!tx.hash && !tx.transactionHash)) {
        return 'Transaction Confirmed!';
      }
      // TransactionReceipt uses transactionHash, ContractTransaction uses hash
      const hash = (tx.transactionHash || tx.hash).slice(0, 10) + '...' + (tx.transactionHash || tx.hash).slice(-8);
      return `Transaction Confirmed! ${hash} - View on Etherscan`;
    },
    error: (err: any) => {
      console.error('Transaction error:', err);
      return formatTransactionError(err);
    },
  });
};

export const showWrapToast = (promise: Promise<any>, amount: string, operation: 'wrap' | 'unwrap') => {
  const operationText = operation === 'wrap' ? 'Wrapping' : 'Unwrapping';
  
  return toast.promise(promise, {
    loading: `${operationText} ${amount} ETH...`,
    success: (tx: any) => {
      if (!tx || (!tx.hash && !tx.transactionHash)) {
        return `${operationText} Successful! ${amount} ETH → ${amount} ${operation === 'wrap' ? 'WETH' : 'ETH'}`;
      }
      // TransactionReceipt uses transactionHash, ContractTransaction uses hash
      const hash = (tx.transactionHash || tx.hash).slice(0, 10) + '...' + (tx.transactionHash || tx.hash).slice(-8);
      return `${operationText} Successful! ${amount} ETH → ${amount} ${operation === 'wrap' ? 'WETH' : 'ETH'} - ${hash}`;
    },
    error: (err: any) => {
      console.error('Wrap error:', err);

      const message = getErrorMessage(err).toLowerCase();
      if (message.includes('user rejected')) {
        return `${operationText} cancelled`;
      }

      if (message.includes('insufficient funds')) {
        return 'Insufficient ETH for gas.';
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
