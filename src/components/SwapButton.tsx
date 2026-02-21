import { Button } from './ui/button';

interface SwapButtonProps {
  account: string | null;
  canTrade: boolean;
  isCalculating: boolean;
  tokenAddress: string;
  isLoading: boolean;
  hasLiquidity?: boolean;
  isBuying: boolean;
  ethAmount: string;
  tokenAmount: string;
  tokenSymbol?: string | null;
  onClick: () => void;
}

export const SwapButton = ({
  account,
  canTrade,
  isCalculating,
  tokenAddress,
  isLoading,
  hasLiquidity,
  isBuying,
  ethAmount,
  tokenAmount,
  tokenSymbol,
  onClick,
}: SwapButtonProps) => {
  const getButtonText = () => {
    if (!account) return 'Get started';
    if (!tokenAddress) return 'Enter token address';
    if (isLoading) return 'Loading...';
    if (!hasLiquidity && tokenSymbol) return 'No liquidity';
    if (isCalculating) return 'Calculating...';
    if (isBuying && !ethAmount) return 'Enter amount';
    if (!isBuying && !tokenAmount) return 'Enter amount';
    return 'Swap';
  };

  return (
    <Button
      onClick={onClick}
      disabled={account ? (!canTrade || isCalculating) : false}
      className={`mt-2 w-full rounded-2xl py-4 text-lg font-semibold transition-all cursor-pointer ${
        !account
          ? 'bg-uni-pink text-white hover:bg-uni-pink-hover'
          : canTrade
          ? 'bg-uni-pink text-white hover:bg-uni-pink-hover'
          : 'bg-uni-surface3 text-uni-text2 cursor-not-allowed'
      }`}
    >
      {getButtonText()}
    </Button>
  );
};
