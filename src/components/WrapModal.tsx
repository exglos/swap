import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface WrapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: string) => Promise<void>;
  amount: string;
  loading?: boolean;
  error?: string | null;
  txHash?: string | null;
}

export const WrapModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  amount, 
  loading = false, 
  error = null, 
  txHash = null 
}: WrapModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleWrap = async () => {
    setIsProcessing(true);
    try {
      await onConfirm(amount);
      // Don't close immediately - let user see success
      setTimeout(() => {
        onClose();
        setIsProcessing(false);
      }, 2000);
    } catch (e) {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!loading && !isProcessing) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1b1f] border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Wrap ETH for V3 Trading</h2>
            <p className="text-gray-400 text-sm">Uniswap V3 requires WETH tokens</p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-300 text-sm leading-relaxed">
              The best price was found on Uniswap V3, which requires <span className="text-blue-400 font-semibold">WETH</span> (Wrapped ETH). 
              Would you like to wrap <span className="text-white font-bold">{amount} ETH</span> to continue?
            </p>
          </div>

          {/* Transaction Info */}
          <div className="bg-gray-800/30 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Amount to wrap:</span>
              <span className="text-white font-medium">{amount} ETH</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">You will receive:</span>
              <span className="text-green-400 font-medium">{amount} WETH</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Gas estimate:</span>
              <span className="text-gray-300">~0.002 ETH</span>
            </div>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {txHash && !error && (
            <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-3">
              <p className="text-green-400 text-sm">
                ✅ Wrap successful! Transaction: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleWrap}
              disabled={loading || isProcessing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/50 disabled:cursor-not-allowed py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2"
            >
              {(loading || isProcessing) ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {txHash ? 'Processing...' : 'Wrapping...'}
                </>
              ) : (
                `Wrap ${amount} ETH`
              )}
            </button>
            
            <button
              onClick={handleClose}
              disabled={loading || isProcessing}
              className="px-6 bg-transparent hover:bg-gray-800 disabled:cursor-not-allowed py-3 rounded-xl text-gray-400 hover:text-white transition-all border border-gray-700 hover:border-gray-600"
            >
              Cancel
            </button>
          </div>

          {/* Info Note */}
          <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
            <p>💡 WETH is wrapped ETH that represents 1:1 with native ETH and can be used in V3 pools.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
