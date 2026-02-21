interface TradeDetailsProps {
  priceImpact?: string;
  minimumReceived?: string;
  tokenSymbol?: string;
  isBuying: boolean;
}

export const TradeDetails = ({
  priceImpact,
  minimumReceived,
  tokenSymbol,
  isBuying,
}: TradeDetailsProps) => {
  if (!priceImpact || !minimumReceived) return null;

  return (
    <div className="mt-2 rounded-2xl bg-uni-surface2 p-3 space-y-1">
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
