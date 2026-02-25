import { ethers } from 'ethers';
import { useMultiVersionTrade } from './useMultiVersionTrade';

export const useTrade = (
  provider: ethers.providers.Web3Provider | null,
  signer: ethers.Signer | null
) => {
  const multiVersionTrade = useMultiVersionTrade(provider, signer);

  return {
    trade: multiVersionTrade.trade,
    route: multiVersionTrade.route,
    executionPrice: multiVersionTrade.executionPrice,
    priceImpact: multiVersionTrade.priceImpact,
    minimumReceived: multiVersionTrade.minimumReceived,
    isCalculating: multiVersionTrade.isCalculating,
    error: multiVersionTrade.error,
    version: multiVersionTrade.version,
    calculateTrade: multiVersionTrade.calculateTrade,
    executeTrade: multiVersionTrade.executeTrade,
    clearTrade: multiVersionTrade.clearTrade,
    getRouteInfo: multiVersionTrade.getRouteInfo,
  };
};
