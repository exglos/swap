import { useEffect, useState } from 'react';
import { detectWallets, type WalletType, type DetectedWallet } from '@/hooks/useWeb3';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletType: WalletType) => void;
  isConnecting: boolean;
}

const STATIC_WALLETS = [
  { type: 'walletconnect' as const, name: 'WalletConnect', icon: '🔗', installUrl: 'https://walletconnect.com/' },
  { type: 'binance' as const, name: 'Binance Wallet', icon: '💎', installUrl: 'https://www.bnbchain.org/en/binance-wallet' },
  { type: 'porto' as const, name: 'Porto', icon: '🏦', installUrl: '#' },
];

export const WalletModal = ({ isOpen, onClose, onConnect, isConnecting }: WalletModalProps) => {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);

  useEffect(() => {
    if (isOpen) {
      setWallets(detectWallets());
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[400px] bg-uni-surface2 border-uni-surface3 p-0 gap-0">
        <DialogHeader className="p-5 pb-3">
          <DialogTitle className="text-white">Connect a wallet</DialogTitle>
        </DialogHeader>

        <div className="px-3 pb-2">
          <p className="px-2 pb-2 text-xs text-uni-text2">Detected wallets</p>
          {wallets.filter(w => w.detected).map((wallet) => (
            <Button
              key={wallet.type}
              onClick={() => onConnect(wallet.type)}
              disabled={isConnecting}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 hover:bg-uni-surface3 transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{wallet.icon}</span>
                <span className="text-base font-medium text-white">{wallet.name}</span>
              </div>
              <span className="text-xs text-green-400 font-medium">Detected</span>
            </Button>
          ))}
          {wallets.filter(w => w.detected).length === 0 && (
            <p className="px-4 py-3 text-sm text-uni-text2">No wallets detected</p>
          )}
        </div>


        <div className="flex items-center gap-3 px-5 py-2">
          <div className="flex-1 h-px bg-uni-surface3" />
          <span className="text-xs text-uni-text2">Other wallets</span>
          <div className="flex-1 h-px bg-uni-surface3" />
        </div>

        <div className="px-3 pb-2">
          {wallets.filter(w => !w.detected).map((wallet) => (
            <Button
              key={wallet.type}
              onClick={() => onConnect(wallet.type)}
              disabled={isConnecting}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 hover:bg-uni-surface3 transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{wallet.icon}</span>
                <span className="text-base font-medium text-white">{wallet.name}</span>
              </div>
              <span className="text-xs text-uni-text2">Install</span>
            </Button>
          ))}
          {STATIC_WALLETS.map((wallet) => (
            <button
              key={wallet.type}
              onClick={() => window.open(wallet.installUrl, '_blank')}
              className="flex w-full items-center justify-between rounded-2xl px-4 py-3 hover:bg-uni-surface3 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{wallet.icon}</span>
                <span className="text-base font-medium text-white">{wallet.name}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="px-5 py-4 text-center">
          <p className="text-xs text-uni-text2">
            By connecting a wallet, you agree to the{' '}
            <span className="text-uni-pink underline cursor-pointer">Terms of Service</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
