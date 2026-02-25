import { useState } from 'react';
import { useWeb3 } from '@/hooks/useWeb3';
import { useTheme } from '@/hooks/useTheme';
import { WalletConnect } from '@/components/WalletConnect';
import { WalletModal } from '@/components/WalletModal';
import { TradeInterface } from '@/components/TradeInterface';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { WalletType } from '@/hooks/useWeb3';

function App() {
  const { readonlyProvider, provider, signer, account, isConnecting, error, connect } = useWeb3();
  const { theme, toggleTheme } = useTheme();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  const handleConnect = (walletType: WalletType) => {
    connect(walletType);
    setIsWalletModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-uni-surface1 text-uni-text1">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <img src="/exglos-logo.svg" alt="Exglos" className="h-8" />
          <span className="text-sm text-uni-text2">Swap</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <WalletConnect
            account={account}
            isConnecting={isConnecting}
            error={error}
            onConnect={handleConnect}
          />
        </div>
      </header>

      <main className="flex flex-col items-center justify-center px-4 pt-12">
        <div className="text-center mb-8">
          <h2 className="text-5xl font-medium text-uni-text1 mb-3">
            Swap anytime,<br />anywhere.
          </h2>
          <p className="text-sm text-uni-text2 max-w-md mx-auto">
            Trade any token without restrictions. Decentralized, permissionless swapping.
          </p>
        </div>
        <TradeInterface
          readonlyProvider={readonlyProvider}
          provider={provider}
          signer={signer}
          account={account}
          onConnectWallet={() => setIsWalletModalOpen(true)}
        />
      </main>

      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnect={handleConnect}
        isConnecting={isConnecting}
      />
    </div>
  );
}

export default App;