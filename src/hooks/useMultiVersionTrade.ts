import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { useV3Trade } from './useV3Trade';
import { useV4Trade } from './useV4Trade';
import { CHAIN_ID, ERC20_ABI } from '@/utils/constants';
import type { MultiVersionTradeState } from '@/types/uniswap';

export const useMultiVersionTrade = (
  provider: ethers.providers.Web3Provider | null,
  signer: ethers.Signer | null
) => {
  const v4Trade = useV4Trade(provider, signer);
  const v3Trade = useV3Trade(provider, signer);

  const [state, setState] = useState<MultiVersionTradeState>({
    primaryRoute: null,
    fallbackRoute: null,
    selectedRoute: null,
    isCalculating: false,
    error: null,
    version: null,
  });

  const calculateTrade = useCallback(
    async (tokenAddress: string, amount: string, isBuying: boolean) => {
      if (!provider || !amount || parseFloat(amount) <= 0) {
        return null;
      }

      setState(prev => ({ ...prev, isCalculating: true, error: null }));

      try {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const [name, symbol, decimals] = await Promise.all([
          tokenContract.name(),
          tokenContract.symbol(),
          tokenContract.decimals(),
        ]);

        const token = new Token(CHAIN_ID, tokenAddress, decimals, symbol, name);

        // Try V4 first (now with Universal Router execution support)
        const v4Result = await v4Trade.calculateTrade(token, amount, isBuying);

        if (v4Result && v4Result.route) {
          // V4 pool found - use it for execution via Universal Router
          setState({
            primaryRoute: v4Result.route,
            fallbackRoute: null,
            selectedRoute: v4Result.route,
            isCalculating: false,
            error: null,
            version: 'V4',
          });
          return v4Result;
        }

        // Fallback to V3 if V4 not available
                
        try {
          const v3Result = await v3Trade.calculateTrade(token, amount, isBuying);
          
          if (v3Result && v3Result.route) {
            setState({
              primaryRoute: null,
              fallbackRoute: v3Result.route,
              selectedRoute: v3Result.route,
              isCalculating: false,
              error: null,
              version: 'V3',
            });
            return v3Result;
          }

          throw new Error('No liquidity pools found on V4 or V3');
        } catch (v3Error: any) {
          console.error('Both V4 and V3 failed:', v3Error);
          throw v3Error;
        }
      } catch (error: any) {
        setState({
          primaryRoute: null,
          fallbackRoute: null,
          selectedRoute: null,
          isCalculating: false,
          error: error.message || 'Failed to calculate trade',
          version: null,
        });
        return null;
      }
    },
    [provider, v4Trade.calculateTrade, v3Trade.calculateTrade]
  );

  const executeTrade = useCallback(
    async (account: string, isBuying: boolean, slippage: number, deadline: number) => {
      if (!state.selectedRoute || !state.version) {
        throw new Error('No trade route selected');
      }

      if (state.version === 'V4' && v4Trade.poolInfo && state.selectedRoute) {
        return await v4Trade.executeTrade(
          v4Trade.poolInfo,
          state.selectedRoute,
          account,
          isBuying,
          slippage,
          deadline
        );
      } else if (state.version === 'V3' && v3Trade.trade) {
        return await v3Trade.executeTrade(v3Trade.trade, account, isBuying, slippage, deadline);
      }

      throw new Error('Trade execution failed: Invalid state');
    },
    [state.selectedRoute, state.version, v4Trade.poolInfo, v4Trade.executeTrade, v3Trade.trade, v3Trade.executeTrade]
  );

  const clearTrade = useCallback(() => {
    v4Trade.clearTrade();
    v3Trade.clearTrade();
    setState({
      primaryRoute: null,
      fallbackRoute: null,
      selectedRoute: null,
      isCalculating: false,
      error: null,
      version: null,
    });
  }, []);

  const getRouteInfo = useCallback(() => {
    if (!state.selectedRoute || !state.version) {
      return null;
    }

    return {
      version: state.version,
      route: state.selectedRoute,
      executionPrice: state.selectedRoute.executionPrice,
      priceImpact: state.selectedRoute.priceImpact,
      minimumReceived: state.selectedRoute.minimumReceived,
      feeTier: state.selectedRoute.feeTier,
      isV4Primary: state.version === 'V4',
      isFallback: state.version === 'V3',
    };
  }, [state.selectedRoute, state.version]);

  return {
    ...state,
    calculateTrade,
    executeTrade,
    clearTrade,
    getRouteInfo,
    trade: state.version === 'V3' ? v3Trade.trade : null,
    route: state.selectedRoute,
    executionPrice: state.selectedRoute?.executionPrice || '',
    priceImpact: state.selectedRoute?.priceImpact || '',
    minimumReceived: state.selectedRoute?.minimumReceived || '',
  };
};
