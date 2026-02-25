import { useState } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { TokenList } from './TokenList';
import { Input } from './ui/input';

interface Token {
  symbol: string;
  name: string;
  address: string;
  logoURI?: string;
  decimals?: number;
}

interface TokenSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (address: string) => void;
  currentToken?: string;
}

const POPULAR_TOKENS: Token[] = [
  // Top 20 tokens from Uniswap Default Token List (v18.6.0)
  // Core Assets
  { symbol: 'ETH', name: 'Ethereum', address: 'ETH', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  
  // Major DeFi Tokens
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  { symbol: 'LINK', name: 'ChainLink Token', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
  { symbol: 'AAVE', name: 'Aave', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18 },
  { symbol: 'COMP', name: 'Compound', address: '0xc00e94Cb662C3520282E6F5717214004A7f26884', decimals: 18 },
  { symbol: 'MKR', name: 'Maker', address: '0x9f8F72aA9304c8B593d555F12eF511b4C9d8Acd', decimals: 18 },
  { symbol: 'SUSHI', name: 'SushiToken', address: '0x6B3595068778DD592e39A122f4f5a5cF68C4C9E6', decimals: 18 },
  { symbol: '1INCH', name: '1inch', address: '0x111111111117dC0aa78b770fA6A738034120C302', decimals: 18 },
  
  // Liquid Staking
  { symbol: 'RETH', name: 'Rocket Pool ETH', address: '0xae78ae78ae78ae78ae78ae78ae78ae78ae786393', decimals: 18 },
  { symbol: 'stETH', name: 'Lido Staked Ether', address: '0xae7ab96520DEB3fB1962E36f1979c5B3d220C649', decimals: 18 },
  { symbol: 'cbETH', name: 'Coinbase Wrapped Staked ETH', address: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704', decimals: 18 },
  
  // Popular Altcoins
  { symbol: 'SHIB', name: 'Shiba Inu', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18 },
  { symbol: 'MATIC', name: 'Polygon', address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', decimals: 18 },
  { symbol: 'ENJ', name: 'Enjin Coin', address: '0xF629cDdD2e023a69104b8d4708C0E4F0807C4AEC', decimals: 18 },
  { symbol: 'MANA', name: 'Decentraland', address: '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942', decimals: 18 },
];

export const TokenSelectorModal = ({ isOpen, onClose, onSelectToken, currentToken }: TokenSelectorModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredTokens = POPULAR_TOKENS.filter(token => 
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectToken = (address: string) => {
    onSelectToken(address);
    onClose();
    setSearchQuery('');
  };

  const getTokenLogo = (symbol: string) => {
    const colors: Record<string, string> = {
      'ETH': '#627EEA',
      'USDC': '#2775CA',
      'USDT': '#26A17B',
      'WBTC': '#F09242',
      'DAI': '#F5AC37',
      'UNI': '#FF007A',
      'WETH': '#627EEA',
      'PAXG': '#D4AF37',
      'ZAMA': '#8254ee',
      'RLUSD': '#23292F',
      'USD1': '#0052FF',
      'AZTEC': '#1E1E1E',
      'MUSD': '#F6851B',
      'LBTC': '#F7931A',
      'SUSDE': '#00D395',
      'RETH': '#FF6B4A',
      'AUSD': '#00A3FF',
      'ADS': '#3C3C3D',
      'ADO': '#7B3FE4',
      'SKY': '#1AAB9B',
    };
    
    return (
      <div 
        className="flex h-9 w-9 items-center justify-center rounded-full text-white font-bold text-sm shrink-0"
        style={{ backgroundColor: colors[symbol] || '#6B7280' }}
      >
        {symbol.slice(0, 2)}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[420px] bg-card border-border p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="text-foreground text-lg font-semibold">Select a token</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Search and select a token to trade
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tokens"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl bg-input border-border pl-10 pr-4 py-3 text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring transition-colors"
            />
          </div>
        </div>

        <div className="px-4 pb-4 max-h-[500px] overflow-y-auto">
          <div className="px-2 pb-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Popular Tokens</p>
          </div>
          <TokenList
            tokens={filteredTokens}
            onSelectToken={handleSelectToken}
            currentToken={currentToken}
            getTokenLogo={getTokenLogo}
          />
        </div>

        {searchQuery && searchQuery.startsWith('0x') && searchQuery.length === 42 && (
          <div className="px-6 pb-6 border-t border-border pt-4">
            <button
              onClick={() => handleSelectToken(searchQuery)}
              className="w-full rounded-xl bg-primary hover:bg-primary/90 px-4 py-3 text-primary-foreground font-medium transition-colors cursor-pointer"
            >
              Import custom token
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
