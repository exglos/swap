import { useEffect } from 'react';
import { ethers } from 'ethers';

interface UseTradeCalculationProps {
  tokenAddress: string;
  ethAmount: string;
  tokenAmount: string;
  isBuying: boolean;
  tokenInfo: {
    fetchTokenInfo: (address: string) => void;
    clearTokenInfo: () => void;
    pair: any;
    token: any;
  };
  tradeState: {
    calculateTrade: (pair: any, token: any, amount: string, isBuying: boolean) => void;
    clearTrade: () => void;
    trade: any;
    isCalculating: boolean;
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
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (tokenAddress && ethers.isAddress(tokenAddress)) {
        tokenInfo.fetchTokenInfo(tokenAddress);
      } else if (tokenAddress) {
        tokenInfo.clearTokenInfo();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [tokenAddress, tokenInfo.fetchTokenInfo, tokenInfo.clearTokenInfo]);

  useEffect(() => {
    if (tokenInfo.pair && tokenInfo.token) {
      const amount = isBuying ? ethAmount : tokenAmount;
      if (amount && parseFloat(amount) > 0) {
        tradeState.calculateTrade(tokenInfo.pair, tokenInfo.token, amount, isBuying);
      } else {
        tradeState.clearTrade();
      }
    }
  }, [ethAmount, tokenAmount, isBuying, tokenInfo.pair, tokenInfo.token, tradeState.calculateTrade, tradeState.clearTrade]);

  useEffect(() => {
    if (tradeState.trade && !tradeState.isCalculating) {
      if (isBuying) {
        setTokenAmount(tradeState.trade.outputAmount.toSignificant(6));
      } else {
        setEthAmount(tradeState.trade.outputAmount.toSignificant(6));
      }
    }
  }, [tradeState.trade, tradeState.isCalculating, isBuying, setTokenAmount, setEthAmount]);
};
