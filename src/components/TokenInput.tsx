import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

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
}

export const TokenInput = ({ value, onChange, tokenInfo }: TokenInputProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="token-address">Token Contract Address</Label>
      <Input
        id="token-address"
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="0x..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
      />
      {tokenInfo.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading token info...</span>
        </div>
      )}
      {tokenInfo.symbol && !tokenInfo.isLoading && (
        <div className="text-sm">
          <p className="font-medium text-green-600">
            {tokenInfo.name} ({tokenInfo.symbol}) - {tokenInfo.decimals} decimals
          </p>
          {!tokenInfo.hasLiquidity && (
            <p className="text-yellow-600">⚠️ No liquidity pair found</p>
          )}
        </div>
      )}
      {tokenInfo.error && (
        <p className="text-sm text-red-500">{tokenInfo.error}</p>
      )}
    </div>
  );
};
