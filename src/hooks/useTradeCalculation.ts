import { useEffect, useMemo, useRef } from 'react';
import { ethers } from 'ethers';

interface UseTradeCalculationProps {
  inputTokenAddress: string;
  outputTokenAddress: string;
  inputAmount: string;
  tokenInfo: {
    fetchTokenInfo: (address: string) => void;
    clearTokenInfo: () => void;
    isLoading?: boolean;
    error?: string | null;
  };
  tradeState: {
    calculateTrade: (inputTokenAddress: string, outputTokenAddress: string, amount: string) => Promise<any>;
    clearTrade: () => void;
    route: any;
    isCalculating: boolean;
    version: string | null;
  };
  setOutputAmount: (amount: string) => void;
}

export const useTradeCalculation = ({
  inputTokenAddress,
  outputTokenAddress,
  inputAmount,
  tokenInfo,
  tradeState,
  setOutputAmount,
}: UseTradeCalculationProps) => {
  const isTokenInfoLoading = tokenInfo.isLoading;
  const tokenInfoError = tokenInfo.error;
  const isCalculating = tradeState.isCalculating;
  const routeOutputAmount = tradeState.route?.outputAmount;
  const previousPairRef = useRef({
    inputTokenAddress,
    outputTokenAddress,
  });
  
  // Calculate derived output amount during render
  const derivedOutputAmount = useMemo(() => {
    if (!routeOutputAmount || isCalculating) {
      return '';
    }
    return routeOutputAmount;
  }, [routeOutputAmount, isCalculating]);

  useEffect(() => {
    let tokenInfoTimeout: NodeJS.Timeout | undefined;

    clearTimeout(tokenInfoTimeout);
    tokenInfoTimeout = setTimeout(() => {
      if (outputTokenAddress && ethers.utils.isAddress(outputTokenAddress)) {
        tokenInfo.fetchTokenInfo(outputTokenAddress);
      } else if (outputTokenAddress) {
        tokenInfo.clearTokenInfo();
      }
    }, 500);

    return () => {
      if (tokenInfoTimeout) {
        clearTimeout(tokenInfoTimeout);
      }
    };
  }, [
    outputTokenAddress,
    tokenInfo.fetchTokenInfo,
    tokenInfo.clearTokenInfo,
  ]);

  useEffect(() => {
    const previousPair = previousPairRef.current;
    const pairChanged =
      previousPair.inputTokenAddress !== inputTokenAddress ||
      previousPair.outputTokenAddress !== outputTokenAddress;

    if (pairChanged) {
      tradeState.clearTrade();
      setOutputAmount('');
      previousPairRef.current = {
        inputTokenAddress,
        outputTokenAddress,
      };
      return;
    }

    previousPairRef.current = {
      inputTokenAddress,
      outputTokenAddress,
    };
  }, [
    inputTokenAddress,
    outputTokenAddress,
    tradeState.clearTrade,
    setOutputAmount,
  ]);

  useEffect(() => {
    if (
      !inputTokenAddress ||
      !outputTokenAddress ||
      !ethers.utils.isAddress(inputTokenAddress) ||
      !ethers.utils.isAddress(outputTokenAddress)
    ) {
      tradeState.clearTrade();
      setOutputAmount('');
      return;
    }

    if (tokenInfoError) {
      tradeState.clearTrade();
      setOutputAmount('');
      return;
    }

    if (isTokenInfoLoading) {
      return;
    }

    if (inputAmount && parseFloat(inputAmount) > 0) {
      tradeState.calculateTrade(inputTokenAddress, outputTokenAddress, inputAmount);
    } else {
      tradeState.clearTrade();
      setOutputAmount('');
    }
  }, [
    inputTokenAddress,
    outputTokenAddress,
    inputAmount,
    isTokenInfoLoading,
    tokenInfoError,
    tradeState.calculateTrade,
    tradeState.clearTrade,
    setOutputAmount
  ]);

  useEffect(() => {
    if (derivedOutputAmount) {
      setOutputAmount(derivedOutputAmount);
    } else if (!isCalculating) {
      setOutputAmount('');
    }
  }, [derivedOutputAmount, isCalculating, setOutputAmount]);
};
