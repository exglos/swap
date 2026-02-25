import { Label } from './ui/label';
import { Input } from './ui/input';

interface TokenAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
  tokenName?: string | null;
  tokenSymbol?: string | null;
  decimals?: number | null;
  hasLiquidity?: boolean;
  error?: string | null;
}

export const TokenAddressInput = ({
  value,
  onChange,
  isLoading,
  tokenName,
  tokenSymbol,
  decimals,
  error,
}: TokenAddressInputProps) => {
  return (
    <div className="mb-2 rounded-2xl bg-uni-surface2 p-4">
      <Label className="text-sm text-uni-text2 mb-2 block">Token Contract Address</Label>
      <Input
        type="text"
        autoComplete="off"
        spellCheck={false}
        placeholder="0x..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-base text-uni-text1 font-mono outline-none placeholder:text-uni-text3"
      />
      {isLoading && (
        <p className="text-xs text-uni-text2 mt-2 animate-pulse">Loading token info...</p>
      )}
      {tokenSymbol && !isLoading && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-uni-pink" />
            <p className="text-xs text-uni-text2">
              {tokenName} ({tokenSymbol}) &middot; {decimals} decimals
            </p>
          </div>
          <div className="rounded-lg bg-uni-pink/10 border border-uni-pink/20 p-2">
            <p className="text-xs text-uni-pink font-medium">Ready to trade on Uniswap V4/V3</p>
          </div>
        </div>
      )}
      {error && (
        <p className="text-xs text-uni-pink-hover mt-2">{error}</p>
      )}
    </div>
  );
};
