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
        <p className="text-sm text-muted-foreground">No tokens found</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Try searching by name or address</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tokens.map((token) => (
        <Button
          key={token.address}
          onClick={() => onSelectToken(token.address)}
          variant="ghost"
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors cursor-pointer justify-start h-auto ${
            currentToken === token.address ? 'bg-accent/20 border border-accent/40' : ''
          }`}
        >
          {getTokenLogo(token.symbol)}
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-foreground">{token.name}</p>
            <p className="text-xs text-muted-foreground">
              {token.symbol} {token.address !== 'ETH' && (
                <span className="ml-1 text-muted-foreground/60">
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
