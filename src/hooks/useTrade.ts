import { ethers } from 'ethers';
import { useMultiVersionTrade } from './useMultiVersionTrade';

export const useTrade = (
  provider: ethers.providers.Web3Provider | null,
  signer: ethers.Signer | null,
  readOnlyProvider: ethers.providers.JsonRpcProvider
) => {
  const multiVersionTrade = useMultiVersionTrade(provider, signer, readOnlyProvider);

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
    debugSteps: multiVersionTrade.debugSteps,
  };
};
