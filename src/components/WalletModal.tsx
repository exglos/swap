import { useEffect, useState } from 'react';
import { detectWallets, type WalletType, type DetectedWallet } from '@/hooks/useWeb3';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
      <DialogContent className="max-w-[400px] bg-card border-border p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="text-foreground text-lg font-semibold">Connect a wallet</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Choose a wallet to connect to the application
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-4">
          <p className="px-2 pb-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Detected wallets</p>
          {wallets.filter(w => w.detected).map((wallet) => (
            <Button
              key={wallet.type}
              onClick={() => onConnect(wallet.type)}
              disabled={isConnecting}
              variant="ghost"
              className="flex w-full items-center justify-between rounded-xl px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 justify-start h-auto mb-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{wallet.icon}</span>
                <span className="text-base font-medium text-foreground">{wallet.name}</span>
              </div>
              <span className="text-xs text-green-600 dark:text-green-400 font-medium bg-green-500/10 dark:bg-green-500/20 px-2 py-1 rounded-full">Detected</span>
            </Button>
          ))}
          {wallets.filter(w => w.detected).length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground text-center bg-muted/30 rounded-xl">No wallets detected</p>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 py-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground font-medium">Other wallets</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="px-4 pb-4">
          {wallets.filter(w => !w.detected).map((wallet) => (
            <Button
              key={wallet.type}
              onClick={() => onConnect(wallet.type)}
              disabled={isConnecting}
              variant="ghost"
              className="flex w-full items-center justify-between rounded-xl px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 justify-start h-auto mb-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{wallet.icon}</span>
                <span className="text-base font-medium text-foreground">{wallet.name}</span>
              </div>
              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">Install</span>
            </Button>
          ))}
          {STATIC_WALLETS.map((wallet) => (
            <button
              key={wallet.type}
              onClick={() => window.open(wallet.installUrl, '_blank')}
              className="flex w-full items-center justify-between rounded-xl px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer mb-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{wallet.icon}</span>
                <span className="text-base font-medium text-foreground">{wallet.name}</span>
              </div>
              <span className="text-xs text-accent">Get →</span>
            </button>
          ))}
        </div>

        <div className="px-6 py-4 text-center border-t border-border">
          <p className="text-xs text-muted-foreground">
            By connecting a wallet, you agree to the{' '}
            <span className="text-accent underline cursor-pointer hover:text-accent/80">Terms of Service</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
