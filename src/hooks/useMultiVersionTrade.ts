import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Token } from '@uniswap/sdk-core';
import { useV3Trade } from './useV3Trade';
import { useV4Trade } from './useV4Trade';
import { CHAIN_ID, ERC20_ABI, WETH_ADDRESS } from '@/utils/constants';
import type { MultiVersionTradeState, RouteDebugStep } from '@/types/uniswap';
import { NATIVE_ETH_ADDRESS } from '@/utils/v4PoolRegistry';

export const useMultiVersionTrade = (
  provider: ethers.providers.Web3Provider | null,
  signer: ethers.Signer | null,
  readOnlyProvider: ethers.providers.JsonRpcProvider
) => {
  const v4Trade = useV4Trade(provider, signer, readOnlyProvider);
  const v3Trade = useV3Trade(provider, signer, readOnlyProvider);

  const [state, setState] = useState<MultiVersionTradeState>({
    primaryRoute: null,
    fallbackRoute: null,
    selectedRoute: null,
    isCalculating: false,
    error: null,
    version: null,
    debugSteps: [],
  });

  const loadToken = useCallback(
    async (tokenAddress: string): Promise<Token> => {
      if (!provider) {
        if (!readOnlyProvider) {
          throw new Error('Provider not available');
        }
      }
      const quoteProvider = provider ?? readOnlyProvider;

      const normalized = tokenAddress.toLowerCase();

      if (normalized === NATIVE_ETH_ADDRESS.toLowerCase()) {
        return new Token(CHAIN_ID, NATIVE_ETH_ADDRESS, 18, 'ETH', 'Ethereum');
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, quoteProvider);
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
      ]);

      return new Token(CHAIN_ID, tokenAddress, decimals, symbol, name);
    },
    [provider]
  );

  const calculateTrade = useCallback(
    async (inputTokenAddress: string, outputTokenAddress: string, amount: string) => {
      if (
        !(provider || readOnlyProvider) ||
        !inputTokenAddress ||
        !outputTokenAddress ||
        !amount ||
        parseFloat(amount) <= 0
      ) {
        return null;
      }

      setState(prev => ({ ...prev, isCalculating: true, error: null }));

      try {
        if (inputTokenAddress.toLowerCase() === outputTokenAddress.toLowerCase()) {
          throw new Error('Select two different tokens to get a quote.');
        }

        const inputToken = await loadToken(inputTokenAddress);
        const outputToken = await loadToken(outputTokenAddress);

        const isWrapPair =
          (inputToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase() &&
            outputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()) ||
          (inputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase() &&
            outputToken.address.toLowerCase() === WETH_ADDRESS.toLowerCase());

        if (isWrapPair) {
          setState({
            primaryRoute: null,
            fallbackRoute: null,
            selectedRoute: null,
            isCalculating: false,
            error: 'ETH/WETH is a wrap or unwrap operation. Use the wrap flow instead of swap.',
            version: null,
          });
          return null;
        }

        const v3InputToken =
          inputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()
            ? new Token(CHAIN_ID, WETH_ADDRESS, 18, 'WETH', 'Wrapped Ether')
            : inputToken;
        const v3OutputToken =
          outputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase()
            ? new Token(CHAIN_ID, WETH_ADDRESS, 18, 'WETH', 'Wrapped Ether')
            : outputToken;

        // Try V4 first (now with Universal Router execution support)
        const v4Result = await v4Trade.calculateTrade(inputToken, outputToken, amount);

        if (v4Result && v4Result.route) {
          const selectedRoute = {
            ...v4Result.route,
            inputAddress: inputToken.address,
            outputAddress: outputToken.address,
            inputSymbol: inputToken.symbol || 'TOKEN',
            outputSymbol: outputToken.symbol || 'TOKEN',
            pathSymbols: v4Result.route.pathSymbols || [inputToken.symbol || 'TOKEN', outputToken.symbol || 'TOKEN'],
            isNativeInput: inputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase(),
            isNativeOutput: outputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase(),
          };

          // V4 pool found - use it for execution via Universal Router
          setState({
            primaryRoute: selectedRoute,
            fallbackRoute: null,
            selectedRoute,
            isCalculating: false,
            error: null,
            version: 'V4',
            debugSteps: v4Result.debugSteps || v4Trade.getDebugSteps(),
          });
          return v4Result;
        }

        const v4DebugSteps = v4Trade.getDebugSteps();
        const v4FailureDetails = v4DebugSteps.find(step => step.label === 'V4 result' && step.status === 'error')?.details;

        // Fallback to V3 if V4 not available
                
        try {
          const v3Result = await v3Trade.calculateTrade(v3InputToken, v3OutputToken, amount);
          
          if (v3Result && v3Result.route) {
            const selectedRoute = {
              ...v3Result.route,
              inputAddress: inputToken.address,
              outputAddress: outputToken.address,
              inputSymbol: inputToken.symbol || 'TOKEN',
              outputSymbol: outputToken.symbol || 'TOKEN',
              pathSymbols: [inputToken.symbol || 'TOKEN', outputToken.symbol || 'TOKEN'],
              isNativeInput: inputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase(),
              isNativeOutput: outputToken.address.toLowerCase() === NATIVE_ETH_ADDRESS.toLowerCase(),
            };

            setState({
              primaryRoute: null,
              fallbackRoute: selectedRoute,
              selectedRoute,
              isCalculating: false,
              error: null,
              version: 'V3',
              debugSteps: [
                ...(v4Result?.debugSteps || v4DebugSteps || []),
                ...(v4FailureDetails ? [{
                  label: 'V4 fallback reason',
                  status: 'error' as const,
                  details: v4FailureDetails,
                }] : []),
                {
                  label: 'V3 fallback',
                  status: 'success',
                  details: `Selected v3 route ${selectedRoute.pathSymbols?.join(' -> ') || `${selectedRoute.inputSymbol} -> ${selectedRoute.outputSymbol}`}`,
                },
              ],
            });
            return v3Result;
          }

          throw new Error('No liquidity pools found on V4 or V3');
        } catch (v3Error: any) {
          console.debug('Both V4 and V3 failed:', v3Error.message);
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
          debugSteps: v4Trade.getDebugSteps(),
        });
        return null;
      }
    },
    [provider, readOnlyProvider, loadToken, v4Trade.calculateTrade, v3Trade.calculateTrade]
  );

  const executeTrade = useCallback(
    async (account: string, slippage: number, deadline: number) => {
      if (!state.selectedRoute || !state.version) {
        throw new Error('No trade route selected');
      }

      if (state.version === 'V4' && v4Trade.poolPath.length > 0 && state.selectedRoute) {
        return await v4Trade.executeTrade(
          v4Trade.poolPath,
          state.selectedRoute,
          account,
          slippage,
          deadline
        );
      } else if (state.version === 'V3' && v3Trade.trade) {
        return await v3Trade.executeTrade(v3Trade.trade, account, slippage, deadline);
      }

      throw new Error('Trade execution failed: Invalid state');
    },
    [state.selectedRoute, state.version, v4Trade.poolPath, v4Trade.executeTrade, v3Trade.trade, v3Trade.executeTrade]
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
      debugSteps: [],
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
    debugSteps: state.debugSteps as RouteDebugStep[] | undefined,
  };
};
