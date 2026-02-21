import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AmountInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  symbol?: string;
}

export const AmountInput = ({ 
  label, 
  value, 
  onChange, 
  placeholder = '0.0', 
  readOnly = false,
  symbol 
}: AmountInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      onChange(val);
    }
  };

  const id = label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {symbol && `(${symbol})`}
      </Label>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        readOnly={readOnly}
        className={readOnly ? "cursor-default bg-muted/50 text-muted-foreground text-lg" : "text-lg"}
      />
    </div>
  );
};
