import { useState, useMemo } from 'react';
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
import { ArrowDown } from 'lucide-react';
import { ethers } from 'ethers';
import { Button } from './ui/button';

// Import the popular tokens list for fallback
const POPULAR_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: 'ETH', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'USDT', name: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  { symbol: 'LINK', name: 'ChainLink Token', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
  { symbol: 'AAVE', name: 'Aave', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18 },
  { symbol: 'COMP', name: 'Compound', address: '0xc00e94Cb662C3520282E6F5717214004A7f26884', decimals: 18 },
  { symbol: 'MKR', name: 'Maker', address: '0x9f8F72aA9304c8B593d555F12eF511b4C9d8Acd', decimals: 18 },
  { symbol: 'SUSHI', name: 'SushiToken', address: '0x6B3595068778DD592e39A122f4f5a5cF68C4C9E6', decimals: 18 },
  { symbol: '1INCH', name: '1inch', address: '0x111111111117dC0aa78b770fA6A738034120C302', decimals: 18 },
  { symbol: 'RETH', name: 'Rocket Pool ETH', address: '0xae78ae78ae78ae78ae78ae78ae78ae78ae786393', decimals: 18 },
  { symbol: 'stETH', name: 'Lido Staked Ether', address: '0xae7ab96520DEB3fB1962E36f1979c5B3d220C649', decimals: 18 },
  { symbol: 'cbETH', name: 'Coinbase Wrapped Staked ETH', address: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704', decimals: 18 },
  { symbol: 'SHIB', name: 'Shiba Inu', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18 },
  { symbol: 'MATIC', name: 'Polygon', address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', decimals: 18 },
  { symbol: 'ENJ', name: 'Enjin Coin', address: '0xF629cDdD2e023a69104b8d4708C0E4F0807C4AEC', decimals: 18 },
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
  const [tokenAddress, setTokenAddress] = useState('');
  const [ethAmount, setEthAmount] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [isBuying, setIsBuying] = useState(true);
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);

  const tokenInfo = useToken(provider, readonlyProvider);
  const tradeState = useTrade(provider, signer);
  const { txStatus, executeTrade } = useTradeExecution();

  // Fallback token info for when provider is not available
  const fallbackTokenInfo = useMemo(() => {
    if (!tokenAddress) return null;
    
    const knownToken = POPULAR_TOKENS.find(token => 
      token.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    
    return knownToken || null;
  }, [tokenAddress]);

  // Use fallback token info when provider is not available or token info is not loaded
  const displayTokenInfo = useMemo(() => {
    // If we have token info from the hook, use it
    if (tokenInfo.name || tokenInfo.symbol) {
      return {
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        hasLiquidity: tokenInfo.hasLiquidity,
        isLoading: tokenInfo.isLoading,
        error: tokenInfo.error
      };
    }
    
    // If no provider but we have fallback info, use it
    if (!provider && fallbackTokenInfo) {
      return {
        name: fallbackTokenInfo.name,
        symbol: fallbackTokenInfo.symbol,
        decimals: fallbackTokenInfo.decimals,
        hasLiquidity: true, // Assume popular tokens have liquidity
        isLoading: false,
        error: null
      };
    }
    
    // Otherwise, return the original token info (might be empty)
    return {
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      decimals: tokenInfo.decimals,
      hasLiquidity: tokenInfo.hasLiquidity,
      isLoading: tokenInfo.isLoading,
      error: tokenInfo.error
    };
  }, [tokenInfo, fallbackTokenInfo, provider]);

  // Memoize trade calculation props to prevent unnecessary re-renders
  const tradeCalculationProps = useMemo(() => ({
    tokenAddress,
    ethAmount,
    tokenAmount,
    isBuying,
    tokenInfo,
    tradeState,
    setTokenAmount,
    setEthAmount,
  }), [tokenAddress, ethAmount, tokenAmount, isBuying, tokenInfo, tradeState, setTokenAmount, setEthAmount]);

  useTradeCalculation(tradeCalculationProps);

  const handleSwapMode = () => {
    setIsBuying(!isBuying);
    setEthAmount('');
    setTokenAmount('');
    tradeState.clearTrade();
  };

  const handleTrade = async () => {
    if (!account || !tradeState.route) return;
    await executeTrade(account, isBuying, tradeState.executeTrade, () => {
      setEthAmount('');
      setTokenAmount('');
      tradeState.clearTrade();
    });
  };

  const canTrade = !!(account && 
    displayTokenInfo.hasLiquidity && 
    tradeState.route && 
    ((isBuying && ethAmount) || (!isBuying && tokenAmount)));

  const handleButtonClick = () => {
    if (!account) {
      onConnectWallet();
    } else if (canTrade) {
      handleTrade();
    }
  };

  return (
    <div className="w-full max-w-[480px]">
      <TokenAddressInput
        value={tokenAddress}
        onChange={setTokenAddress}
        isLoading={displayTokenInfo.isLoading}
        tokenName={displayTokenInfo.name}
        tokenSymbol={displayTokenInfo.symbol}
        decimals={displayTokenInfo.decimals}
        hasLiquidity={displayTokenInfo.hasLiquidity}
        error={displayTokenInfo.error}
      />
      
      <SwapAmountInput
        label="Sell"
        value={isBuying ? ethAmount : tokenAmount}
        onChange={isBuying ? setEthAmount : setTokenAmount}
        tokenSymbol={isBuying ? 'ETH' : (displayTokenInfo.symbol || 'TOKEN')}
        onTokenClick={!isBuying ? () => setIsTokenSelectorOpen(true) : undefined}
        showChevron={!isBuying}
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
        value={isBuying ? tokenAmount : ethAmount}
        tokenSymbol={isBuying ? (displayTokenInfo.symbol || 'TOKEN') : 'ETH'}
        readOnly
        onTokenClick={isBuying ? () => setIsTokenSelectorOpen(true) : undefined}
        showChevron={isBuying}
        priceInfo={tradeState.executionPrice ? `1 ETH ≈ ${tradeState.executionPrice} ${displayTokenInfo.symbol}` : undefined}
      />

      <TradeDetails
        priceImpact={tradeState.priceImpact}
        minimumReceived={tradeState.minimumReceived}
        tokenSymbol={displayTokenInfo.symbol}
        isBuying={isBuying}
        version={tradeState.version}
        feeTier={tradeState.route?.feeTier}
      />

      <SwapButton
        account={account}
        canTrade={canTrade}
        isCalculating={tradeState.isCalculating}
        tokenAddress={tokenAddress}
        isLoading={displayTokenInfo.isLoading}
        hasLiquidity={!!displayTokenInfo.hasLiquidity}
        isBuying={isBuying}
        ethAmount={ethAmount}
        tokenAmount={tokenAmount}
        tokenSymbol={displayTokenInfo.symbol}
        onClick={handleButtonClick}
      />

      {txStatus ? (
        <div className="mt-2">
          <StatusMessage type={txStatus.type} message={txStatus.message} />
        </div>
      ) : null}
      {tradeState.error ? (
        <div className="mt-2">
          <StatusMessage type="error" message={tradeState.error} />
        </div>
      ) : null}

      <TokenSelectorModal
        isOpen={isTokenSelectorOpen}
        onClose={() => setIsTokenSelectorOpen(false)}
        onSelectToken={(address) => {
          setTokenAddress(address);
          setIsTokenSelectorOpen(false);
        }}
        currentToken={tokenAddress}
      />
    </div>
  );
};
