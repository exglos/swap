import React from 'react';
import { Button } from '@/components/ui/button';

interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals?: number;
}

interface TokenListProps {
  tokens: Token[];
  onSelectToken: (address: string) => void;
  currentToken?: string;
  getTokenLogo: (symbol: string) => React.ReactElement;
}

export const TokenList = ({ tokens, onSelectToken, currentToken, getTokenLogo }: TokenListProps) => {
  if (tokens.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-uni-text2">No tokens found</p>
        <p className="text-xs text-uni-text3 mt-1">Try searching by name or address</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tokens.map((token) => (
        <Button
          key={token.address}
          onClick={() => onSelectToken(token.address)}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-uni-surface3 transition-colors cursor-pointer ${
            currentToken === token.address ? 'bg-uni-surface3' : ''
          }`}
        >
          {getTokenLogo(token.symbol)}
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-uni-text1">{token.name}</p>
            <p className="text-xs text-uni-text2">
              {token.symbol} {token.address !== 'ETH' && (
                <span className="ml-1 text-uni-text3">
                  {token.address.slice(0, 6)}...{token.address.slice(-4)}
                </span>
              )}
            </p>
          </div>
        </Button>
      ))}
    </div>
  );
};
