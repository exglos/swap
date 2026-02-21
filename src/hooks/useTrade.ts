import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Trade, Route } from '@uniswap/v2-sdk';
import { Pair } from '@uniswap/v2-sdk';
import { WETH_ADDRESS, CHAIN_ID, DEFAULT_SLIPPAGE, ROUTER_ADDRESS, ROUTER_ABI, ERC20_ABI } from '@/utils/constants';
import { calculateDeadline } from '@/utils/helpers';

interface TradeState {
  trade: Trade<Token, Token, TradeType> | null;
  route: Route<Token, Token> | null;
  executionPrice: string;
  priceImpact: string;
  minimumReceived: string;
  isCalculating: boolean;
  error: string | null;
}

export const useTrade = (
  provider: ethers.BrowserProvider | null,
  signer: ethers.Signer | null
) => {
  const [tradeState, setTradeState] = useState<TradeState>({
    trade: null,
    route: null,
    executionPrice: '',
    priceImpact: '',
    minimumReceived: '',
    isCalculating: false,
    error: null,
  });

  const calculateTrade = useCallback(
    async (
      pair: Pair,
      token: Token,
      amount: string,
      isBuying: boolean
    ) => {
      if (!provider || !amount || parseFloat(amount) <= 0) {
        return;
      }

      setTradeState(prev => ({ ...prev, isCalculating: true, error: null }));

      try {
        const wethToken = new Token(CHAIN_ID, WETH_ADDRESS, 18, 'WETH', 'Wrapped Ether');
        const [inputToken, outputToken] = isBuying ? [wethToken, token] : [token, wethToken];

        const route = new Route([pair], inputToken, outputToken);
        const amountIn = CurrencyAmount.fromRawAmount(
          inputToken,
          ethers.parseUnits(amount, inputToken.decimals).toString()
        );

        const trade = new Trade(route, amountIn, TradeType.EXACT_INPUT);

        const slippageTolerance = new Percent(DEFAULT_SLIPPAGE, 10000);
        const minimumAmountOut = trade.minimumAmountOut(slippageTolerance);

        setTradeState({
          trade,
          route,
          executionPrice: trade.executionPrice.toSignificant(6),
          priceImpact: trade.priceImpact.toSignificant(2),
          minimumReceived: minimumAmountOut.toSignificant(6),
          isCalculating: false,
          error: null,
        });
      } catch (error: any) {
        console.error('Error calculating trade:', error);
        setTradeState(prev => ({
          ...prev,
          isCalculating: false,
          error: error.message || 'Failed to calculate trade',
        }));
      }
    },
    [provider]
  );

  const executeTrade = useCallback(
    async (
      trade: Trade<Token, Token, TradeType>,
      account: string,
      isBuying: boolean
    ) => {
      if (!signer || !trade) {
        throw new Error('Wallet not connected or trade not calculated');
      }

      const slippageTolerance = new Percent(DEFAULT_SLIPPAGE, 10000);
      const amountOutMin = trade.minimumAmountOut(slippageTolerance);
      const path = trade.route.path.map(token => token.address);
      const deadline = calculateDeadline(20);

      const routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

      if (isBuying) {
        const value = ethers.parseEther(trade.inputAmount.toExact());
        const tx = await routerContract.swapExactETHForTokens(
          amountOutMin.quotient.toString(),
          path,
          account,
          deadline,
          { value }
        );
        return tx;
      } else {
        const tokenContract = new ethers.Contract(
          trade.inputAmount.currency.address,
          ERC20_ABI,
          signer
        );

        const allowance = await tokenContract.allowance(account, ROUTER_ADDRESS);
        const amountIn = ethers.parseUnits(
          trade.inputAmount.toExact(),
          trade.inputAmount.currency.decimals
        );

        if (allowance < amountIn) {
          const approveTx = await tokenContract.approve(ROUTER_ADDRESS, amountIn);
          await approveTx.wait();
        }

        const tx = await routerContract.swapExactTokensForETH(
          amountIn,
          amountOutMin.quotient.toString(),
          path,
          account,
          deadline
        );
        return tx;
      }
    },
    [signer]
  );

  const clearTrade = useCallback(() => {
    setTradeState({
      trade: null,
      route: null,
      executionPrice: '',
      priceImpact: '',
      minimumReceived: '',
      isCalculating: false,
      error: null,
    });
  }, []);

  return {
    ...tradeState,
    calculateTrade,
    executeTrade,
    clearTrade,
  };
};
