import { useState, useCallback } from 'react';
import { Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TradeSettingsProps {
  settings: {
    slippage: number;
    deadline: number;
  };
  setSettings: (settings: { slippage: number; deadline: number }) => void;
}

export const TradeSettings = ({ settings, setSettings }: TradeSettingsProps) => {
  const [customSlippage, setCustomSlippage] = useState('');
  const [customDeadline, setCustomDeadline] = useState('');

  const handleSlippageChange = useCallback((value: number) => {
    setSettings({ ...settings, slippage: value });
    setCustomSlippage('');
  }, [settings, setSettings]);

  const handleQuickDeadlineChange = useCallback((d: number) => {
    setSettings({ ...settings, deadline: d });
    setCustomDeadline('');
  }, [settings, setSettings]);

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 50) {
      setSettings({ ...settings, slippage: numValue });
    }
  };

  const handleCustomDeadlineChange = (value: string) => {
    setCustomDeadline(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 60) {
      setSettings({ ...settings, deadline: numValue });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 bg-card border-border" 
        align="end" 
        sideOffset={8}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Transaction Settings</h3>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground">
              Slippage Tolerance
            </Label>
            <div className="flex gap-2">
              {[0.1, 0.5, 1.0].map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSlippageChange(s)}
                  className={`flex-1 ${
                    settings.slippage === s && !customSlippage
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}%
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Custom"
                value={customSlippage}
                onChange={(e) => handleCustomSlippageChange(e.target.value)}
                className="flex-1"
                min="0.01"
                max="50"
                step="0.01"
              />
              <span className="text-muted-foreground text-sm py-2">%</span>
            </div>
            {settings.slippage > 5 && (
              <p className="text-xs text-yellow-500">
                ⚠️ High slippage! Your transaction may be front-run.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-medium text-muted-foreground">
              Transaction Deadline
            </Label>
            <div className="flex gap-2">
              {[10, 20, 30].map((d) => (
                <Button
                  key={d}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickDeadlineChange(d)}
                  className={`flex-1 ${
                    settings.deadline === d && !customDeadline
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d}m
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Custom"
                value={customDeadline}
                onChange={(e) => handleCustomDeadlineChange(e.target.value)}
                className="flex-1"
                min="1"
                max="60"
              />
              <span className="text-muted-foreground text-sm py-2">minutes</span>
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-3 border border-border">
            <h4 className="text-xs font-medium text-foreground mb-2">Pro Tips</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Lower slippage = better price, but higher failure risk</li>
              <li>• V4 pools typically need less slippage than V3</li>
              <li>• Set deadline based on network congestion</li>
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
