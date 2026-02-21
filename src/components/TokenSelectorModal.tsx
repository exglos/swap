import { useState } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  { symbol: 'PAXG', name: 'PAX Gold', address: '0x45804880De22913dAFE09f4980848ECE6EcbAf78', decimals: 18 },
  { symbol: 'ZAMA', name: 'Zama', address: '0xA12C1E860b8d8e4A7a4E3e1b1b1b1b1b1b1bf4f3', decimals: 18 },
  { symbol: 'RLUSD', name: 'Ripple USD', address: '0x82929282929282929282929282929282929217eD', decimals: 18 },
  { symbol: 'USD1', name: 'USD1', address: '0x8d0D8d0D8d0D8d0D8d0D8d0D8d0D8d0D8d0D8B0d', decimals: 18 },
  { symbol: 'AZTEC', name: 'Aztec', address: '0xA27EA27EA27EA27EA27EA27EA27EA27EA27E62D2', decimals: 18 },
  { symbol: 'MUSD', name: 'MetaMask USD', address: '0xacA9acA9acA9acA9acA9acA9acA9acA9acA935DA', decimals: 18 },
  { symbol: 'LBTC', name: 'Lombard Staked BTC', address: '0x8236592872365928723659287236592872364494', decimals: 8 },
  { symbol: 'SUSDE', name: 'Ethena Staked USDe', address: '0x9D399D399D399D399D399D399D399D399D393497', decimals: 18 },
  { symbol: 'RETH', name: 'Rocket Pool ETH', address: '0xae78ae78ae78ae78ae78ae78ae78ae78ae786393', decimals: 18 },
  { symbol: 'AUSD', name: 'AUSD', address: '0x0000000000000000000000000000000000012a', decimals: 18 },
  { symbol: 'ADS', name: 'Adshares', address: '0xcfcEcfcEcfcEcfcEcfcEcfcEcfcEcfcEcfcEd22A', decimals: 0 },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  { symbol: 'ADO', name: 'ADO Protocol', address: '0xf990f990f990f990f990f990f990f990f9902886', decimals: 18 },
  { symbol: 'SKY', name: 'Sky', address: '0x56075607560756075607560756075607560759279', decimals: 18 },
  { symbol: 'ETH', name: 'Ethereum', address: 'ETH', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
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
      <DialogContent className="max-w-[420px] bg-uni-surface2 border-uni-surface3 p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3">
          <DialogTitle className="text-uni-text1">Select a token</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-uni-text2" />
            <Input
              type="text"
              placeholder="Search tokens"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl bg-uni-surface1 border border-uni-surface3 pl-10 pr-4 py-3 text-uni-text1 placeholder:text-uni-text2 outline-none focus:border-uni-text2 transition-colors"
            />
          </div>
        </div>

        <div className="px-3 pb-3 max-h-[500px] overflow-y-auto">
          <div className="px-2 pb-2">
            <p className="text-xs text-uni-text2 font-medium">Tokens by 24H volume</p>
          </div>
          <TokenList
            tokens={filteredTokens}
            onSelectToken={handleSelectToken}
            currentToken={currentToken}
            getTokenLogo={getTokenLogo}
          />
        </div>

        {searchQuery && searchQuery.startsWith('0x') && searchQuery.length === 42 && (
          <div className="px-5 pb-4 border-t border-uni-surface3 pt-4">
            <button
              onClick={() => handleSelectToken(searchQuery)}
              className="w-full rounded-xl bg-uni-surface3 hover:bg-uni-surface3/80 px-4 py-3 text-uni-text1 font-medium transition-colors cursor-pointer"
            >
              Import custom token
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
