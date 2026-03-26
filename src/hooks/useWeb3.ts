import { useState, useEffect, useCallback } from 'react';
import { providers, type Signer } from 'ethers';
import { CHAIN_ID } from '@/utils/constants';
import type { EthereumProvider } from '@/types/window';

// Storage keys for persistence
const STORAGE_KEYS = {
  WALLET_TYPE: 'connectedWalletType',
  ACCOUNT: 'connectedAccount',
  CHAIN_ID: 'connectedChainId'
};

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

// Save connection state to localStorage
const saveConnectionState = (walletType: WalletType, account: string, chainId: number) => {
  try {
    localStorage.setItem(STORAGE_KEYS.WALLET_TYPE, walletType);
    localStorage.setItem(STORAGE_KEYS.ACCOUNT, account);
    localStorage.setItem(STORAGE_KEYS.CHAIN_ID, chainId.toString());
  } catch (error) {
    console.warn('Failed to save wallet connection state:', error);
  }
};

// Clear connection state from localStorage
const clearConnectionState = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.WALLET_TYPE);
    localStorage.removeItem(STORAGE_KEYS.ACCOUNT);
    localStorage.removeItem(STORAGE_KEYS.CHAIN_ID);
  } catch (error) {
    console.warn('Failed to clear wallet connection state:', error);
  }
};

// Load saved connection state from localStorage
const loadSavedConnection = (): { walletType: WalletType | null, account: string | null, chainId: number | null } => {
  try {
    const walletType = localStorage.getItem(STORAGE_KEYS.WALLET_TYPE) as WalletType | null;
    const account = localStorage.getItem(STORAGE_KEYS.ACCOUNT);
    const chainId = localStorage.getItem(STORAGE_KEYS.CHAIN_ID);
    
    return {
      walletType,
      account,
      chainId: chainId ? parseInt(chainId, 10) : null
    };
  } catch (error) {
    console.warn('Failed to load wallet connection state:', error);
    return { walletType: null, account: null, chainId: null };
  }
};

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

      // Save connection state to localStorage
      saveConnectionState(walletType, account, chainId);

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
    clearConnectionState(); // Clear saved state
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

  // Combined effect for auto-reconnect and provider event listeners
  useEffect(() => {
    // Auto-reconnect logic
    const attemptAutoReconnect = async () => {
      const savedConnection = loadSavedConnection();
      if (savedConnection.walletType && savedConnection.account) {
        const ethereum = getProvider(savedConnection.walletType);
        if (ethereum) {
          try {
            const accounts = await ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0 && accounts[0].toLowerCase() === savedConnection.account?.toLowerCase()) {
              // Account matches, attempt to reconnect
              await connect(savedConnection.walletType);
            } else {
              // Account changed or disconnected, clear saved state
              clearConnectionState();
            }
          } catch (error) {
            // Failed to check accounts, clear saved state
            clearConnectionState();
          }
        } else {
          // Wallet not detected, clear saved state
          clearConnectionState();
        }
      }
    };

    // Set up provider event listeners
    const setupEventListeners = (ethereum: EthereumProvider) => {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          const provider = new providers.Web3Provider(ethereum as any);
          (async () => {
            try {
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
            } catch (error) {
              console.error('Failed to update account:', error);
            }
          })();
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
    };

    // Execute auto-reconnect
    attemptAutoReconnect();

    // Set up event listeners if we have an active provider
    if (activeProvider) {
      return setupEventListeners(activeProvider);
    }
  }, [connect, disconnect, activeProvider]);

  return {
    ...state,
    connect,
    disconnect,
    isConnected: !!state.account,
  };
};
