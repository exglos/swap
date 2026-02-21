import { useState } from 'react';
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

interface TradeInterfaceProps {
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  account: string | null;
  onConnectWallet: () => void;
}

export const TradeInterface = ({ provider, signer, account, onConnectWallet }: TradeInterfaceProps) => {
  const [tokenAddress, setTokenAddress] = useState('');
  const [ethAmount, setEthAmount] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [isBuying, setIsBuying] = useState(true);
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);

  const tokenInfo = useToken(provider);
  const tradeState = useTrade(provider, signer);
  const { txStatus, executeTrade } = useTradeExecution();

  useTradeCalculation({
    tokenAddress,
    ethAmount,
    tokenAmount,
    isBuying,
    tokenInfo,
    tradeState,
    setTokenAmount,
    setEthAmount,
  });

  const handleSwapMode = () => {
    setIsBuying(!isBuying);
    setEthAmount('');
    setTokenAmount('');
    tradeState.clearTrade();
  };

  const handleTrade = async () => {
    if (!account || !tradeState.trade) return;
    await executeTrade(tradeState.trade, account, isBuying, tradeState.executeTrade, () => {
      setEthAmount('');
      setTokenAmount('');
      tradeState.clearTrade();
    });
  };

  const canTrade = !!(account && 
    tokenInfo.hasLiquidity && 
    tradeState.trade && 
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
        isLoading={tokenInfo.isLoading}
        tokenName={tokenInfo.name}
        tokenSymbol={tokenInfo.symbol}
        decimals={tokenInfo.decimals}
        hasLiquidity={tokenInfo.hasLiquidity}
        liquidityETH={tokenInfo.liquidityETH}
        liquidityToken={tokenInfo.liquidityToken}
        error={tokenInfo.error}
      />
      
      <SwapAmountInput
        label="Sell"
        value={isBuying ? ethAmount : tokenAmount}
        onChange={isBuying ? setEthAmount : setTokenAmount}
        tokenSymbol={isBuying ? 'ETH' : (tokenInfo.symbol || 'TOKEN')}
        onTokenClick={!isBuying ? () => setIsTokenSelectorOpen(true) : undefined}
        showChevron={!isBuying}
      />

      <div className="flex justify-center -my-3 relative z-10">
        <Button
          onClick={handleSwapMode}
          className="flex h-10 w-10 items-center justify-center rounded-xl border-4 border-uni-surface1 bg-uni-surface2 text-uni-text2 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>

      <SwapAmountInput
        label="Buy"
        value={isBuying ? tokenAmount : ethAmount}
        tokenSymbol={isBuying ? (tokenInfo.symbol || 'TOKEN') : 'ETH'}
        readOnly
        onTokenClick={isBuying ? () => setIsTokenSelectorOpen(true) : undefined}
        showChevron={isBuying}
        priceInfo={tradeState.executionPrice ? `1 ETH ≈ ${tradeState.executionPrice} ${tokenInfo.symbol}` : undefined}
      />

      <TradeDetails
        priceImpact={tradeState.priceImpact}
        minimumReceived={tradeState.minimumReceived}
        tokenSymbol={tokenInfo.symbol}
        isBuying={isBuying}
      />

      <SwapButton
        account={account}
        canTrade={canTrade}
        isCalculating={tradeState.isCalculating}
        tokenAddress={tokenAddress}
        isLoading={tokenInfo.isLoading}
        hasLiquidity={!!tokenInfo.hasLiquidity}
        isBuying={isBuying}
        ethAmount={ethAmount}
        tokenAmount={tokenAmount}
        tokenSymbol={tokenInfo.symbol}
        onClick={handleButtonClick}
      />

      {txStatus && (
        <div className="mt-2">
          <StatusMessage type={txStatus.type} message={txStatus.message} />
        </div>
      )}
      {tradeState.error && (
        <div className="mt-2">
          <StatusMessage type="error" message={tradeState.error} />
        </div>
      )}

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
