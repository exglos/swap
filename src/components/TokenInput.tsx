import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, AlertCircle } from 'lucide-react';
import { COMMON_TOKENS, searchCommonTokens, isCommonToken } from '@/utils/commonTokens';

interface TokenInputProps {
  value: string;
  onChange: (value: string) => void;
  tokenInfo: {
    name: string;
    symbol: string;
    decimals: number;
    hasLiquidity: boolean;
    isLoading: boolean;
    error: string | null;
  };
  onSelectToken?: (token: any) => void;
}

export const TokenInput = ({ value, onChange, tokenInfo, onSelectToken }: TokenInputProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter common tokens based on search
  const filteredTokens = useMemo(() => {
    if (!searchQuery) return COMMON_TOKENS.slice(0, 8); // Show first 8 by default
    return searchCommonTokens(searchQuery).slice(0, 12);
  }, [searchQuery]);

  // Check if current address is a common token
  const isCurrentCommonToken = value && isCommonToken(value);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setSearchQuery(newValue);
    setShowSuggestions(newValue.length > 0);
  };

  const selectToken = (token: any) => {
    onChange(token.address);
    setSearchQuery('');
    setShowSuggestions(false);
    if (onSelectToken) {
      onSelectToken(token);
    }
  };

  return (
    <div className="space-y-3">
      <Label htmlFor="token-address">Token Contract Address</Label>
      
      <div className="relative">
        <Input
          id="token-address"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="0x... or search tokens"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          className="font-mono pr-10"
          onFocus={() => setShowSuggestions(true)}
        />
        <Search className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
      </div>

      {showSuggestions && filteredTokens.length > 0 && (
        <div className="border rounded-lg bg-white shadow-lg max-h-64 overflow-y-auto z-10">
          <div className="p-2 border-b bg-gray-50">
            <p className="text-xs font-medium text-gray-600">
              Common Tokens {searchQuery && `(filtered: ${filteredTokens.length})`}
            </p>
          </div>
          {filteredTokens.map((token) => (
            <div
              key={token.address}
              className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
              onClick={() => selectToken(token)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">
                    {token.symbol?.slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{token.symbol}</p>
                  <p className="text-xs text-gray-500">{token.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{token.decimals} decimals</p>
                <p className="text-xs text-green-600">Verified</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tokenInfo.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading token info...</span>
        </div>
      )}

      {tokenInfo.symbol && !tokenInfo.isLoading && (
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <p className="font-medium text-green-600">
              {tokenInfo.name} ({tokenInfo.symbol}) - {tokenInfo.decimals} decimals
            </p>
            {isCurrentCommonToken && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                Common Token
              </span>
            )}
          </div>
          {!tokenInfo.hasLiquidity && (
            <p className="text-yellow-600 mt-1">⚠️ No liquidity pair found</p>
          )}
        </div>
      )}

      {tokenInfo.error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-red-700 font-medium">Token Error</p>
            <p className="text-xs text-red-600 mt-1">{tokenInfo.error}</p>
            <div className="mt-2 text-xs text-red-600">
              <p className="font-medium">Common solutions:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Try selecting from the verified tokens above</li>
                <li>Check if the token address is correct</li>
                <li>Ensure the token is on Ethereum mainnet</li>
                <li>Verify the token implements ERC20 standard</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {!value && !tokenInfo.isLoading && !tokenInfo.error && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Popular Tokens:</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_TOKENS.slice(0, 6).map((token) => (
              <button
                key={token.address}
                onClick={() => selectToken(token)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-medium text-gray-700 transition-colors"
              >
                {token.symbol}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
