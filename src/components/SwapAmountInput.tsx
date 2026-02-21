import { ChevronDown } from 'lucide-react';
import { Label } from './ui/label';
import { Input } from './ui/input';

interface SwapAmountInputProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  tokenSymbol: string;
  readOnly?: boolean;
  onTokenClick?: () => void;
  showChevron?: boolean;
  priceInfo?: string;
}

export const SwapAmountInput = ({
  label,
  value,
  onChange,
  tokenSymbol,
  readOnly = false,
  onTokenClick,
  showChevron = false,
  priceInfo,
}: SwapAmountInputProps) => {
  const handleInputChange = (val: string) => {
    if (onChange && (val === '' || /^\d*\.?\d*$/.test(val))) {
      onChange(val);
    }
  };

  return (
    <div className="rounded-2xl bg-uni-surface2 p-4">
      <Label className="text-sm text-uni-text2 mb-1 block">{label}</Label>
      <div className="flex items-center justify-between">
        <Input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          readOnly={readOnly}
          className={`w-full bg-transparent text-4xl font-light text-uni-text1 outline-none placeholder:text-uni-text3 ${
            readOnly ? 'cursor-default' : ''
          }`}
        />
        <button
          onClick={onTokenClick}
          className={`ml-3 flex items-center gap-2 rounded-full bg-uni-surface3 px-3 py-1.5 shrink-0 transition-colors ${
            onTokenClick ? 'hover:bg-uni-surface3/80 cursor-pointer' : 'cursor-default'
          }`}
        >
          <span className="text-sm font-medium text-uni-text1">{tokenSymbol}</span>
          {showChevron && <ChevronDown className="h-4 w-4 text-uni-text1" />}
        </button>
      </div>
      {priceInfo && (
        <p className="text-xs text-uni-text2 mt-2">{priceInfo}</p>
      )}
    </div>
  );
};
