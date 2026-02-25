import { useState, useEffect, useCallback } from 'react';
import { providers, type Signer } from 'ethers';
import { CHAIN_ID } from '@/utils/constants';
import type { EthereumProvider } from '@/types/window';

export type WalletType = 'metamask' | 'phantom' | 'coinbase' | 'injected';

export interface DetectedWallet {
  type: WalletType;
  name: string;
  detected: boolean;
  icon: string;
}

interface Web3State {
  provider: providers.Web3Provider | null;
  readonlyProvider: providers.JsonRpcProvider;
  signer: Signer | null;
  account: string | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
}

/** Find a specific provider from the providers array or window globals */
function getProvider(type: WalletType): EthereumProvider | null {
  const ethereum = window.ethereum;
  if (!ethereum) return null;

  // When multiple extensions exist, window.ethereum.providers has them all
  const providers: EthereumProvider[] = (ethereum as any).providers ?? [];

  switch (type) {
    case 'metamask': {
      const mm = providers.find((p) => p.isMetaMask && !p.isPhantom);
      return mm ?? (ethereum.isMetaMask && !ethereum.isPhantom ? ethereum : null);
    }
    case 'phantom': {
      const ph = window.phantom?.ethereum;
      if (ph) return ph;
      const phProvider = providers.find((p) => p.isPhantom);
      return phProvider ?? (ethereum.isPhantom ? ethereum : null);
    }
    case 'coinbase': {
      if (window.coinbaseWalletExtension) return window.coinbaseWalletExtension;
      const cb = providers.find((p) => p.isCoinbaseWallet);
      return cb ?? (ethereum.isCoinbaseWallet ? ethereum : null);
    }
    case 'injected':
    default:
      return ethereum;
  }
}

/** Detect which wallets are available in the browser */
export function detectWallets(): DetectedWallet[] {
  const wallets: DetectedWallet[] = [
    { type: 'metamask', name: 'MetaMask', detected: false, icon: '🦊' },
    { type: 'phantom', name: 'Phantom', detected: false, icon: '👻' },
    { type: 'coinbase', name: 'Coinbase Wallet', detected: false, icon: '🔵' },
  ];

  for (const w of wallets) {
    w.detected = getProvider(w.type) !== null;
  }

  return wallets;
}

export const useWeb3 = () => {
  // a readonly provider for when injected provider is not available yet
  const readonlyProvider = new providers.JsonRpcProvider('https://mainnet.infura.io/v3/02bcf0c674d447da967b67b20739ea91')

  const [state, setState] = useState<Web3State>({
    readonlyProvider:readonlyProvider,
    provider: null,
    signer: null,
    account: null,
    chainId: null,
    isConnecting: false,
    error: null,
  });
  const [activeProvider, setActiveProvider] = useState<EthereumProvider | null>(null);

  const connect = useCallback(async (walletType: WalletType = 'metamask') => {
    const ethereum = getProvider(walletType);
    if (!ethereum) {
      setState(prev => ({ ...prev, error: `${walletType} wallet not detected. Please install it.` }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // This targets the SPECIFIC provider, avoiding the selectExtension conflict
      const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned');
      }

      const provider = new providers.Web3Provider(ethereum as any);
      const signer = await provider.getSigner();
      const account = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      setActiveProvider(ethereum);

      setState({
        readonlyProvider,
        provider,
        signer,
        account,
        chainId,
        isConnecting: false,
        error: chainId !== CHAIN_ID ? `Please switch to Ethereum Mainnet (Chain ID: ${CHAIN_ID})` : null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to connect wallet';
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: message,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setActiveProvider(null);
    setState({
      readonlyProvider,
      provider: null,
      signer: null,
      account: null,
      chainId: null,
      isConnecting: false,
      error: null,
    });
  }, []);

  // Listen for account / chain changes on the active provider
  useEffect(() => {
    const ethereum = activeProvider;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        const provider = new providers.Web3Provider(ethereum as any);
        (async () => {
          const signer = await provider.getSigner();
          const account = await signer.getAddress();
          const network = await provider.getNetwork();
          setState(prev => ({
            ...prev,
            provider,
            signer,
            account,
            chainId: Number(network.chainId),
          }));
        })().catch(console.error);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [activeProvider, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    isConnected: !!state.account,
  };
};
