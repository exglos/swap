interface TradeDetailsProps {
  outputAmount?: string;
  priceImpact?: string;
  minimumReceived?: string;
  tokenSymbol?: string;
  version?: string | null;
  feeTier?: string;
  isFallback?: boolean;
  slippage?: number;
  isStale?: boolean;
}

export const TradeDetails = ({
  outputAmount,
  priceImpact,
  minimumReceived,
  tokenSymbol,
  version,
  feeTier,
  isFallback,
  slippage,
  isStale = false,
}: TradeDetailsProps) => {
  if (!outputAmount && !priceImpact && !minimumReceived) return null;

  return (
    <div className={`mt-2 rounded-2xl bg-uni-surface2 p-3 space-y-1 transition-opacity ${isStale ? 'quote-stale' : ''}`}>
      {version && (
        <div className="flex justify-between text-xs">
          <span className="text-uni-text2">Route</span>
          <span className="text-uni-text1 flex items-center gap-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              version === 'V4' ? 'bg-uni-pink/20 text-uni-pink' : 'bg-uni-text3/20 text-uni-text3'
            }`}>
              {version === 'V4' ? 'Uniswap V4' : isFallback ? 'Uniswap V3 Fallback' : 'Uniswap V3'}
            </span>
            {feeTier && <span className="text-uni-text2">• {feeTier}</span>}
          </span>
        </div>
      )}
      {outputAmount && (
        <div className="flex justify-between text-xs">
          <span className="text-uni-text2">Est. received</span>
          <span className="text-uni-text1">
            {outputAmount} {tokenSymbol}
          </span>
        </div>
      )}
      <div className="flex justify-between text-xs">
        <span className="text-uni-text2">Price Impact</span>
        <span className="text-uni-text1">{priceImpact || '--'}{priceImpact ? '%' : ''}</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-uni-text2">Min. received</span>
        <span className="text-uni-text1">
          {minimumReceived || '--'}{minimumReceived ? ` ${tokenSymbol}` : ''}
        </span>
      </div>
      {typeof slippage === 'number' && (
        <div className="flex justify-between text-xs">
          <span className="text-uni-text2">Slippage</span>
          <span className="text-uni-text1">{slippage}%</span>
        </div>
      )}
    </div>
  );
};
