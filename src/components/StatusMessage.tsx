import { AlertCircle, CheckCircle, Info, Loader2 } from 'lucide-react';

interface StatusMessageProps {
  type: 'info' | 'success' | 'error' | 'loading';
  message: string;
}

export const StatusMessage = ({ type, message }: StatusMessageProps) => {
  const icons = {
    info: <Info className="h-4 w-4" />,
    success: <CheckCircle className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
    loading: <Loader2 className="h-4 w-4 animate-spin" />,
  };

  const styles = {
    info: 'text-uni-text3 bg-uni-text3/10 border-uni-text3/20',
    success: 'text-uni-pink bg-uni-pink/10 border-uni-pink/20',
    error: 'text-uni-pink-hover bg-uni-pink-hover/10 border-uni-pink-hover/20',
    loading: 'text-uni-text2 bg-uni-surface3 border-uni-surface3',
  };

  const isBalanceError = message.toLowerCase().includes('balance') || 
                         message.toLowerCase().includes('insufficient');

  return (
    <div className={`flex items-start gap-3 rounded-2xl p-4 border ${
      type === 'error' && isBalanceError 
        ? 'bg-uni-pink-hover/15 border-uni-pink-hover/30 text-uni-pink-hover' 
        : styles[type]
    }`}>
      <div className={`mt-0.5 ${
        type === 'error' && isBalanceError ? 'text-uni-pink-hover' : ''
      }`}>
        {icons[type]}
      </div>
      <div className="flex-1 min-w-0">
        {message.includes('\n') ? (
          // Multi-line message (like balance errors)
          <div className={`text-sm font-medium whitespace-pre-line ${
            type === 'error' && isBalanceError ? 'text-uni-pink-hover' : ''
          }`}>
            {message}
          </div>
        ) : (
          // Single line message
          <p className={`text-sm font-medium ${
            type === 'error' && isBalanceError ? 'text-uni-pink-hover' : ''
          }`}>
            {message}
          </p>
        )}
        {type === 'error' && isBalanceError && (
          <div className="mt-2 space-y-1">
            <p className="text-xs text-uni-text2">
              <strong>Suggestions:</strong>
            </p>
            <ul className="text-xs text-uni-text2 list-disc list-inside space-y-1">
              <li>Add ETH to your wallet</li>
              <li>Try a smaller amount (0.01 ETH or less)</li>
              <li>Check your wallet network is Mainnet</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
