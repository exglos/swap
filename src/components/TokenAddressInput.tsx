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
  liquidityETH?: string;
  liquidityToken?: string;
  error?: string | null;
}

export const TokenAddressInput = ({
  value,
  onChange,
  isLoading,
  tokenName,
  tokenSymbol,
  decimals,
  hasLiquidity,
  liquidityETH,
  liquidityToken,
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
        className="w-full bg-transparent text-base text-white font-mono outline-none placeholder:text-uni-text3"
      />
      {isLoading && (
        <p className="text-xs text-uni-text2 mt-2 animate-pulse">Loading token info...</p>
      )}
      {tokenSymbol && !isLoading && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${hasLiquidity ? 'bg-uni-pink' : 'bg-uni-pink/40'}`} />
            <p className="text-xs text-uni-text2">
              {tokenName} ({tokenSymbol}) &middot; {decimals} decimals
            </p>
          </div>
          {hasLiquidity && liquidityETH && liquidityToken && (
            <div className="rounded-lg bg-uni-pink/10 border border-uni-pink/20 p-2">
              <p className="text-xs text-uni-pink font-medium mb-1">Liquidity Pool</p>
              <div className="flex items-center justify-between text-xs text-uni-text2">
                <span>{parseFloat(liquidityToken).toLocaleString(undefined, { maximumFractionDigits: 2 })} {tokenSymbol}</span>
                <span>•</span>
                <span>{parseFloat(liquidityETH).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH</span>
              </div>
            </div>
          )}
        </div>
      )}
      {tokenSymbol && !isLoading && !hasLiquidity && (
        <div className="mt-2 rounded-lg bg-uni-text3/10 border border-uni-text3/30 p-3">
          <div className="flex items-start gap-2">
            <div className="text-uni-text3 mt-0.5">⚠️</div>
            <div className="flex-1">
              <p className="text-sm font-medium text-uni-text3">No Liquidity Available</p>
              <p className="text-xs text-uni-text2 mt-1">
                This token has no ETH trading pair on Uniswap V2. You cannot swap this token until liquidity is added.
              </p>
            </div>
          </div>
        </div>
      )}
      {error && (
        <p className="text-xs text-uni-pink-hover mt-2">{error}</p>
      )}
    </div>
  );
};
