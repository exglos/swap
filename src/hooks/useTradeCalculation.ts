import { useEffect, useRef } from 'react';
import { ethers } from 'ethers';

interface UseTradeCalculationProps {
  tokenAddress: string;
  ethAmount: string;
  tokenAmount: string;
  isBuying: boolean;
  tokenInfo: {
    fetchTokenInfo: (address: string) => void;
    clearTokenInfo: () => void;
    hasLiquidity?: boolean;
  };
  tradeState: {
    calculateTrade: (tokenAddress: string, amount: string, isBuying: boolean) => Promise<any>;
    clearTrade: () => void;
    route: any;
    isCalculating: boolean;
    version: string | null;
  };
  setTokenAmount: (amount: string) => void;
  setEthAmount: (amount: string) => void;
}

export const useTradeCalculation = ({
  tokenAddress,
  ethAmount,
  tokenAmount,
  isBuying,
  tokenInfo,
  tradeState,
  setTokenAmount,
  setEthAmount,
}: UseTradeCalculationProps) => {
  // Extract primitive values to avoid object dependencies
  const hasLiquidity = tokenInfo.hasLiquidity;
  const isCalculating = tradeState.isCalculating;
  const routeOutputAmount = tradeState.route?.outputAmount;
  
  // Fetch token info with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (tokenAddress && ethers.utils.isAddress(tokenAddress)) {
        tokenInfo.fetchTokenInfo(tokenAddress);
      } else if (tokenAddress) {
        tokenInfo.clearTokenInfo();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [tokenAddress]);

  // Calculate trade when inputs change
  useEffect(() => {
    if (!tokenAddress || !ethers.utils.isAddress(tokenAddress) || !hasLiquidity) {
      return;
    }

    const amount = isBuying ? ethAmount : tokenAmount;
    if (amount && parseFloat(amount) > 0) {
      tradeState.calculateTrade(tokenAddress, amount, isBuying);
    } else {
      tradeState.clearTrade();
    }
  }, [ethAmount, tokenAmount, isBuying, tokenAddress, hasLiquidity]);

  // Update output amount when trade route changes
  // Use a ref to track the last output to prevent loops
  const lastOutputRef = useRef<string>('');
  
  useEffect(() => {
    if (!routeOutputAmount || isCalculating) {
      return;
    }
    
    // Only update if output actually changed
    if (routeOutputAmount !== lastOutputRef.current) {
      lastOutputRef.current = routeOutputAmount;
      
      if (isBuying) {
        setTokenAmount(routeOutputAmount);
      } else {
        setEthAmount(routeOutputAmount);
      }
    }
  }, [routeOutputAmount, isCalculating, isBuying, setTokenAmount, setEthAmount]);
};
