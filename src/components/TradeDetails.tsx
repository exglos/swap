interface TradeDetailsProps {
  priceImpact?: string;
  minimumReceived?: string;
  tokenSymbol?: string;
  isBuying: boolean;
  version?: string | null;
  feeTier?: string;
}

export const TradeDetails = ({
  priceImpact,
  minimumReceived,
  tokenSymbol,
  isBuying,
  version,
  feeTier,
}: TradeDetailsProps) => {
  if (!priceImpact || !minimumReceived) return null;

  return (
    <div className="mt-2 rounded-2xl bg-uni-surface2 p-3 space-y-1">
      {version && (
        <div className="flex justify-between text-xs">
          <span className="text-uni-text2">Route</span>
          <span className="text-uni-text1 flex items-center gap-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              version === 'V4' ? 'bg-uni-pink/20 text-uni-pink' : 'bg-uni-text3/20 text-uni-text3'
            }`}>
              Uniswap {version}
            </span>
            {feeTier && <span className="text-uni-text2">• {feeTier}</span>}
          </span>
        </div>
      )}
      <div className="flex justify-between text-xs">
        <span className="text-uni-text2">Price Impact</span>
        <span className="text-uni-text1">{priceImpact}%</span>
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-uni-text2">Min. received</span>
        <span className="text-uni-text1">
          {minimumReceived} {isBuying ? tokenSymbol : 'ETH'}
        </span>
      </div>
    </div>
  );
};
