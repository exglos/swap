import { useState } from 'react';
import { formatAddress } from '@/utils/helpers';
import { WalletModal } from './WalletModal';
import type { WalletType } from '@/hooks/useWeb3';

interface WalletConnectProps {
  account: string | null;
  isConnecting: boolean;
  error: string | null;
  onConnect: (walletType: WalletType) => void;
}

export const WalletConnect = ({ account, isConnecting, error, onConnect }: WalletConnectProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleConnect = (walletType: WalletType) => {
    onConnect(walletType);
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {error && (
          <p className="text-xs text-uni-pink-hover max-w-[200px] truncate">{error}</p>
        )}
        <button
          onClick={() => account ? undefined : setIsModalOpen(true)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-all cursor-pointer ${
            account
              ? 'bg-uni-surface2 text-white hover:bg-uni-surface3'
              : 'bg-uni-pink text-white hover:bg-uni-pink-hover'
          }`}
        >
          {isConnecting ? 'Connecting...' : account ? formatAddress(account) : 'Connect'}
        </button>
      </div>

      <WalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConnect={handleConnect}
        isConnecting={isConnecting}
      />
    </>
  );
};
