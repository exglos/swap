import { Button } from './ui/button';

interface SwapButtonProps {
  account: string | null;
  canTrade: boolean;
  isCalculating: boolean;
  tokenAddress: string;
  outputTokenAddress: string;
  isLoading: boolean;
  hasLiquidity?: boolean;
  amount: string;
  tokenSymbol?: string | null;
  error?: string | null;
  onClick: () => void;
}

export const SwapButton = ({
  account,
  canTrade,
  isCalculating,
  tokenAddress,
  outputTokenAddress,
  isLoading,
  hasLiquidity,
  amount,
  tokenSymbol,
  error,
  onClick,
}: SwapButtonProps) => {
  const getButtonText = () => {
    if (!account) return 'Get started';
    if (!tokenAddress) return 'Select sell token';
    if (!outputTokenAddress) return 'Select buy token';
    if (!amount) return 'Enter amount';
    if (isLoading) return 'Loading token...';
    if (isCalculating) return 'Finding route...';
    if (error) return 'Route unavailable';
    if (!hasLiquidity && tokenSymbol) return 'Awaiting quote';
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
