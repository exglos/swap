import { useState, useMemo, useEffect } from 'react';
import { StatusMessage } from './StatusMessage';
import { TokenSelectorModal } from './TokenSelectorModal';
import { TokenAddressInput } from './TokenAddressInput';
import { SwapAmountInput } from './SwapAmountInput';
import { TradeDetails } from './TradeDetails';
import { SwapButton } from './SwapButton';
import { useToken } from '@/hooks/useToken';
import { useTrade } from '@/hooks/useTrade';
import { useTradeExecution } from '@/hooks/useTradeExecution';
import { useTradeCalculation } from '@/hooks/useTradeCalculation';
import { useWalletBalances } from '@/hooks/useWalletBalances';
import { useWETH } from '@/hooks/useWETH';
import { WrapModal } from './WrapModal';
import { TradeSettings } from './TradeSettings';
import { ArrowDown } from 'lucide-react';
import { ethers } from 'ethers';
import { Button } from './ui/button';
import { showTransactionToast, showWrapToast } from '@/utils/notifications';

// Import the popular tokens list for fallback
const POPULAR_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: ethers.constants.AddressZero, decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  { symbol: 'LINK', name: 'ChainLink Token', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
  { symbol: 'AAVE', name: 'Aave', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18 },
  { symbol: '1INCH', name: '1inch', address: '0x111111111117dC0aa78b770fA6A738034120C302', decimals: 18 },
  { symbol: 'cbETH', name: 'Coinbase Wrapped Staked ETH', address: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704', decimals: 18 },
  { symbol: 'SHIB', name: 'Shiba Inu', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18 },
  { symbol: 'MATIC', name: 'Polygon', address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', decimals: 18 },
  { symbol: 'MANA', name: 'Decentraland', address: '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942', decimals: 18 },
];

interface TradeInterfaceProps {
  provider: ethers.providers.Web3Provider | null;
  readonlyProvider: ethers.providers.JsonRpcProvider,
  signer: ethers.Signer | null;
  account: string | null;
  onConnectWallet: () => void;
}

export const TradeInterface = ({ provider, signer, account, onConnectWallet,readonlyProvider }: TradeInterfaceProps) => {
  const [tokenAddressSelling, setTokenAddressSelling] = useState('');
  const [tokenAddressBuying, setTokenAddressBuying] = useState('');

  const [tokenAmountSelling, setTokenAmountSelling] = useState('');
  const [tokenAmountBuying, setTokenAmountBuying] = useState('');
  const [isTokenSelectorOpenSelling, setIsTokenSelectorOpenSelling] = useState(false);
  const [isTokenSelectorBuyingOpen, setIsTokenSelectorBuyingOpen] = useState(false);

  const tokenInfoBuying = useToken(provider, readonlyProvider);
  const tokenInfoSelling = useToken(provider, readonlyProvider);
  const tradeState = useTrade(provider, signer, readonlyProvider);
  const { txStatus } = useTradeExecution();
  const { eth, weth, loading: balanceLoading } = useWalletBalances(provider, account);
  const wethHook = useWETH(signer);

  const [isWrapModalOpen, setWrapModalOpen] = useState(false);
  const [settings, setSettings] = useState({
    slippage: 0.1, // percent
    deadline: 10,   // minutes
  });

  // Fallback token info for when provider is not available
  const fallbackTokenInfoSelling = useMemo(() => {
    if (!tokenAddressSelling) return null;
    
    const knownToken = POPULAR_TOKENS.find(token => 
      token.address.toLowerCase() === tokenAddressSelling.toLowerCase()
    );
    
    return knownToken || null;
  }, [tokenAddressSelling]);

  const fallbackTokenInfoBuying = useMemo(() => {
    if (!tokenAddressBuying) return null;

    const knownToken = POPULAR_TOKENS.find(token =>
      token.address.toLowerCase() === tokenAddressBuying.toLowerCase()
    );

    return knownToken || null;
  }, [tokenAddressBuying]);

  // Use fallback token info when provider is not available or token info is not loaded
  const displayTokenInfoSelling = useMemo(() => {

    // If we have token info from the hook, use it
    if (tokenInfoSelling.name || tokenInfoSelling.symbol) {
      return {
        name: tokenInfoSelling.name,
        symbol: tokenInfoSelling.symbol,
        decimals: tokenInfoSelling.decimals,
        hasLiquidity: tokenInfoSelling.hasLiquidity,
        isLoading: tokenInfoSelling.isLoading,
        error: tokenInfoSelling.error
      };
    }
    
    // If no provider but we have fallback info, use it
    if (!provider && fallbackTokenInfoSelling) {
      return {
        name: fallbackTokenInfoSelling.name,
        symbol: fallbackTokenInfoSelling.symbol,
        decimals: fallbackTokenInfoSelling.decimals,
        hasLiquidity: true, // Assume popular tokens have liquidity
        isLoading: false,
        error: null
      };
    }
    
    // Otherwise, return the original token info (might be empty)
    return {
      name: tokenInfoSelling.name,
      symbol: tokenInfoSelling.symbol,
      decimals: tokenInfoSelling.decimals,
      hasLiquidity: tokenInfoSelling.hasLiquidity,
      isLoading: tokenInfoSelling.isLoading,
      error: tokenInfoSelling.error
    };
  }, [tokenInfoSelling, fallbackTokenInfoSelling, provider]);

  const displayTokenInfoBuying = useMemo(() => {

    // If we have token info from the hook, use it
    if (tokenInfoBuying.name || tokenInfoBuying.symbol) {
      return {
        name: tokenInfoBuying.name,
        symbol: tokenInfoBuying.symbol,
        decimals: tokenInfoBuying.decimals,
        hasLiquidity: tokenInfoBuying.hasLiquidity,
        isLoading: tokenInfoBuying.isLoading,
        error: tokenInfoBuying.error
      };
    }

    // If no provider but we have fallback info, use it
    if (!provider && fallbackTokenInfoBuying) {
      return {
        name: fallbackTokenInfoBuying.name,
        symbol: fallbackTokenInfoBuying.symbol,
        decimals: fallbackTokenInfoBuying.decimals,
        hasLiquidity: true, // Assume popular tokens have liquidity
        isLoading: false,
        error: null
      };
    }

    // Otherwise, return the original token info (might be empty)
    return {
      name: tokenInfoBuying.name,
      symbol: tokenInfoBuying.symbol,
      decimals: tokenInfoBuying.decimals,
      hasLiquidity: tokenInfoBuying.hasLiquidity,
      isLoading: tokenInfoBuying.isLoading,
      error: tokenInfoBuying.error
    };
  }, [tokenInfoBuying, fallbackTokenInfoBuying, provider]);

  // Memoize trade calculation props to prevent unnecessary re-renders
  const tradeCalculationProps = useMemo(() => ({
    inputTokenAddress: tokenAddressSelling,
    outputTokenAddress: tokenAddressBuying,
    inputAmount: tokenAmountSelling,
    tokenInfo: tokenInfoBuying,
    tradeState,
    setOutputAmount: setTokenAmountBuying,
  }), [tokenAddressSelling, tokenAddressBuying, tokenAmountSelling, tokenInfoBuying, tradeState, setTokenAmountBuying]);

  useTradeCalculation(tradeCalculationProps);

  useEffect(() => {
    const syncSellTokenFromQuery = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedToken = params.get('token')?.trim();

      if (!requestedToken || !ethers.utils.isAddress(requestedToken)) {
        return;
      }

      setTokenAddressSelling(currentAddress =>
        currentAddress.toLowerCase() === requestedToken.toLowerCase() ? currentAddress : requestedToken
      );
    };

    syncSellTokenFromQuery();
    window.addEventListener('popstate', syncSellTokenFromQuery);

    return () => {
      window.removeEventListener('popstate', syncSellTokenFromQuery);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentQueryToken = params.get('token');

    if (tokenAddressSelling && ethers.utils.isAddress(tokenAddressSelling)) {
      if (currentQueryToken?.toLowerCase() === tokenAddressSelling.toLowerCase()) {
        return;
      }

      params.set('token', tokenAddressSelling);
    } else {
      if (!currentQueryToken) {
        return;
      }

      params.delete('token');
    }

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [tokenAddressSelling]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (tokenAddressSelling && ethers.utils.isAddress(tokenAddressSelling)) {
        tokenInfoSelling.fetchTokenInfo(tokenAddressSelling);
      } else {
        tokenInfoSelling.clearTokenInfo();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    tokenAddressSelling,
    tokenInfoSelling.fetchTokenInfo,
    tokenInfoSelling.clearTokenInfo,
  ]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (tokenAddressBuying && ethers.utils.isAddress(tokenAddressBuying)) {
        tokenInfoBuying.fetchTokenInfo(tokenAddressBuying);
      } else {
        tokenInfoBuying.clearTokenInfo();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [
    tokenAddressBuying,
    tokenInfoBuying.fetchTokenInfo,
    tokenInfoBuying.clearTokenInfo,
  ]);

  const handleSwapMode = () => {
    setTokenAddressSelling(tokenAddressBuying);
    setTokenAddressBuying(tokenAddressSelling);
    setTokenAmountSelling(tokenAmountBuying);
    setTokenAmountBuying(tokenAmountSelling);
    tradeState.clearTrade();
  };

  const handleTrade = async () => {
    if (!account || !tradeState.route) return;
    
    // Create the execution promise using the multi-version trade executor
    const tradePromise = tradeState.executeTrade(account, settings.slippage, settings.deadline)
      .then(tx => {
        // Clear form on success
        setTokenAmountSelling('');
        setTokenAmountBuying('');
        tradeState.clearTrade();
        return tx;
      });
    
    // Show transaction toast (handles both success and error)
    showTransactionToast(tradePromise, `Swap ${tradeState.route.inputSymbol} to ${tradeState.route.outputSymbol}`);
  };

  // Check if user has enough balance for the trade
  const hasEnoughBalance = () => {
    if (!tokenAmountSelling) return true;

    const isNativeSell = tokenAddressSelling.toLowerCase() === ethers.constants.AddressZero.toLowerCase();
    if (!isNativeSell) return true;
    
    const amountNum = parseFloat(tokenAmountSelling);
    if (isNaN(amountNum) || amountNum <= 0) return false;
    
    // Add gas buffer (0.005 ETH for safety)
    const gasBuffer = 0.005;
    const requiredAmount = amountNum + gasBuffer;
    
    return tradeState.version === 'V4'
      ? parseFloat(eth) >= requiredAmount
      : parseFloat(eth) + parseFloat(weth) >= requiredAmount;
  };

  const getBalanceMessage = () => {
    if (!account) return null;
    
    if (balanceLoading) return "Checking balances...";
    if (needsWrapping()) {
      return `Wrap ${tokenAmountSelling} ETH to WETH for V3 trading`;
    }
    if (tokenAddressSelling.toLowerCase() !== ethers.constants.AddressZero.toLowerCase()) {
      return null;
    }
    if (!hasEnoughBalance()) {
      if (tradeState.version === 'V4') {
        return `Insufficient ETH. You have ${parseFloat(eth).toFixed(4)} ETH, need at least ${(parseFloat(tokenAmountSelling) + 0.005).toFixed(4)} ETH (including gas)`;
      } else {
        const total = parseFloat(eth) + parseFloat(weth);
        return `Insufficient funds. You have ${total.toFixed(4)} ETH total, need at least ${(parseFloat(tokenAmountSelling) + 0.005).toFixed(4)} ETH (including gas)`;
      }
    }
    return null;
  };

  const canTrade = !!(account && 
    tokenAddressSelling &&
    tokenAddressBuying &&
    tradeState.route && 
    tokenAmountSelling &&
    hasEnoughBalance());

  // Check if user needs to wrap ETH for V3
  const needsWrapping = () => {
    if (!tokenAmountSelling || tradeState.version !== 'V3') return false;
    if (tokenAddressSelling.toLowerCase() !== ethers.constants.AddressZero.toLowerCase()) return false;
    
    const amountNum = parseFloat(tokenAmountSelling);
    const wethBalance = parseFloat(weth);
    const ethBalance = parseFloat(eth);
    
    // Need wrapping if: ETH amount > WETH balance AND have enough ETH to wrap
    return amountNum > wethBalance && ethBalance >= amountNum;
  };

  const handleWrapConfirm = async (amount: string) => {
    try {
      const wrapPromise = wethHook.wrap(amount);
      showWrapToast(wrapPromise, amount, 'wrap');
      
      await wrapPromise;
      
      // Refresh balances after wrapping
      setTimeout(() => {
        // This will trigger balance refresh in the hook
        window.location.reload(); // Simple refresh for now
      }, 3000);
    } catch (error) {
    }
  };

  const handleButtonClick = () => {
    if (!account) {
      onConnectWallet();
    } else if (needsWrapping()) {
      setWrapModalOpen(true);
    } else if (canTrade) {
      handleTrade();
    }
  };

  const isDisplayedQuoteStale = useMemo(() => {
    const activeRoute = tradeState.route;
    const hasDisplayedQuote = Boolean(tokenAmountBuying || activeRoute?.outputAmount || tradeState.minimumReceived);

    if (!hasDisplayedQuote) {
      return false;
    }

    if (!activeRoute) {
      return tradeState.isCalculating;
    }

    const currentInputAddress = tokenAddressSelling.toLowerCase();
    const currentOutputAddress = tokenAddressBuying.toLowerCase();
    const routeMatchesCurrentSelection =
      activeRoute.inputAddress.toLowerCase() === currentInputAddress &&
      activeRoute.outputAddress.toLowerCase() === currentOutputAddress &&
      activeRoute.inputAmount === tokenAmountSelling;

    return !routeMatchesCurrentSelection || tradeState.isCalculating;
  }, [
    tokenAmountBuying,
    tokenAddressSelling,
    tokenAddressBuying,
    tokenAmountSelling,
    tradeState.route,
    tradeState.minimumReceived,
    tradeState.isCalculating,
  ]);

  return (
    <div className="w-full max-w-[480px]">
      <TokenAddressInput
        value={tokenAddressSelling}
        onChange={setTokenAddressSelling}
        isLoading={displayTokenInfoSelling.isLoading}
        tokenName={displayTokenInfoSelling.name}
        tokenSymbol={displayTokenInfoSelling.symbol}
        decimals={displayTokenInfoSelling.decimals}
        hasLiquidity={displayTokenInfoSelling.hasLiquidity}
        error={displayTokenInfoSelling.error}
      />
      
      <SwapAmountInput
        label="Sell"
        value={tokenAmountSelling}
        onChange={setTokenAmountSelling}
        tokenSymbol={(displayTokenInfoSelling.symbol || 'TOKEN')}
        onTokenClick={() => setIsTokenSelectorOpenSelling(true)}
        showChevron={true}
      />

      <div className="flex justify-center -my-3 relative z-10">
        <Button
          onClick={handleSwapMode}
          className="flex h-10 w-10 items-center justify-center rounded-xl border-4 border-uni-surface1 bg-uni-surface2 text-uni-text2 hover:text-uni-text1 transition-colors cursor-pointer"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>

      <SwapAmountInput
        label="Buy"
        value={tokenAmountBuying}
        readOnly={true}
        tokenSymbol={(displayTokenInfoBuying.symbol || 'TOKEN')}
        onTokenClick={ () => setIsTokenSelectorBuyingOpen(true)}
        showChevron={true}
        priceInfo={tradeState.executionPrice ? `1 ${tradeState.route?.inputSymbol || displayTokenInfoSelling.symbol || 'TOKEN'} ≈ ${tradeState.executionPrice} ${tradeState.route?.outputSymbol || displayTokenInfoBuying.symbol || 'TOKEN'}` : undefined}
        isStale={isDisplayedQuoteStale}
      />

      {tradeState.route && tradeState.version && (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-uni-surface3 bg-uni-surface2 px-4 py-3">
          <span className="text-xs uppercase tracking-wide text-uni-text3">Route Source</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            tradeState.version === 'V4'
              ? 'bg-uni-pink/20 text-uni-pink'
              : 'bg-uni-text3/20 text-uni-text1'
          }`}>
            {tradeState.version === 'V4' ? 'Uniswap V4' : 'Uniswap V3 Fallback'}
          </span>
        </div>
      )}

      <div className="mt-3 rounded-2xl bg-uni-surface2 p-4 space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-uni-text3">Selling token</p>
          <p className="mt-1 text-sm text-uni-text1">
            {displayTokenInfoSelling.name || 'Not selected'}
            {displayTokenInfoSelling.symbol ? ` (${displayTokenInfoSelling.symbol})` : ''}
          </p>
          <p className="text-xs text-uni-text2">
            Decimals: {displayTokenInfoSelling.decimals}
          </p>
          <p className="text-xs font-mono text-uni-text3 break-all">
            {tokenAddressSelling || 'No token address selected'}
          </p>
        </div>

        <div className="border-t border-uni-surface3 pt-3">
          <p className="text-xs uppercase tracking-wide text-uni-text3">Buying token</p>
          <p className="mt-1 text-sm text-uni-text1">
            {displayTokenInfoBuying.name || 'Not selected'}
            {displayTokenInfoBuying.symbol ? ` (${displayTokenInfoBuying.symbol})` : ''}
          </p>
          <p className="text-xs text-uni-text2">
            Decimals: {displayTokenInfoBuying.decimals}
          </p>
          <p className="text-xs font-mono text-uni-text3 break-all">
            {tokenAddressBuying || 'No token address selected'}
          </p>
        </div>
      </div>

      <TradeDetails
        outputAmount={tradeState.route?.outputAmount || tokenAmountBuying}
        priceImpact={tradeState.priceImpact}
        minimumReceived={tradeState.minimumReceived}
        tokenSymbol={tradeState.route?.outputSymbol || displayTokenInfoBuying.symbol}
        version={tradeState.version}
        feeTier={tradeState.getRouteInfo()?.feeTier}
        isFallback={tradeState.getRouteInfo()?.isFallback}
        slippage={settings.slippage}
        isStale={isDisplayedQuoteStale}
      />

      {/* Settings Section */}
      <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
        <div className="flex gap-4">
          <span>Slippage: {settings.slippage}%</span>
          <span>Deadline: {settings.deadline}m</span>
        </div>
        <TradeSettings
          settings={settings}
          setSettings={setSettings}
        />
      </div>

      {getBalanceMessage() && (
        <div className="mt-2 p-3 rounded-xl bg-uni-surface2 border border-uni-surface3">
          <p className="text-sm text-uni-text2 leading-relaxed">
            {getBalanceMessage()}
          </p>
        </div>
      )}

      <SwapButton
        account={account}
        canTrade={canTrade}
        isCalculating={tradeState.isCalculating}
        tokenAddress={tokenAddressSelling}
        outputTokenAddress={tokenAddressBuying}
        isLoading={displayTokenInfoSelling.isLoading}
        hasLiquidity={!!tradeState.route}
        amount={tokenAmountSelling}
        tokenSymbol={tradeState.route?.outputSymbol || displayTokenInfoBuying?.symbol}
        error={tradeState.error}
        onClick={handleButtonClick}
      />

      {txStatus ? (
        <div className="mt-2">
          <StatusMessage type={txStatus.type} message={txStatus.message} />
        </div>
      ) : null}
      {tradeState.error && !tradeState.route ? (
        <div className="mt-2">
          <StatusMessage type="error" message={tradeState.error} />
        </div>
      ) : null}

      {tradeState.debugSteps && tradeState.debugSteps.length > 0 ? (
        <div className="mt-3 rounded-2xl bg-uni-surface2 p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-uni-text3">ROUTE INFO</p>
          {tradeState.debugSteps.map((step, index) => (
            <div key={`${step.label}-${index}`} className="rounded-xl border border-uni-surface3 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-uni-text1">{step.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  step.status === 'success'
                    ? 'bg-green-500/15 text-green-400'
                    : step.status === 'error'
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-uni-text3/20 text-uni-text2'
                }`}>
                  {step.status}
                </span>
              </div>
              <p className="mt-1 break-all text-xs text-uni-text2">{step.details}</p>
            </div>
          ))}
        </div>
      ) : null}

      <TokenSelectorModal
        isOpen={isTokenSelectorOpenSelling}
        onClose={() => setIsTokenSelectorOpenSelling(false)}
        onSelectToken={(address) => {
          setTokenAddressSelling(address);
          setIsTokenSelectorOpenSelling(false);
        }}
        currentToken={tokenAddressSelling}
      />

      <TokenSelectorModal
          isOpen={isTokenSelectorBuyingOpen}
          onClose={() => setIsTokenSelectorBuyingOpen(false)}
          onSelectToken={(address) => {
            setTokenAddressBuying(address);
            setIsTokenSelectorBuyingOpen(false);
          }}
          currentToken={tokenAddressBuying}
      />

      <WrapModal
        isOpen={isWrapModalOpen}
        onClose={() => setWrapModalOpen(false)}
        onConfirm={handleWrapConfirm}
        amount={tokenAmountSelling}
        loading={wethHook.loading}
        error={wethHook.error}
        txHash={wethHook.txHash}
      />
    </div>
  );
};
