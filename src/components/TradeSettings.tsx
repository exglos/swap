import { useState } from 'react';
import { Settings } from 'lucide-react';

interface TradeSettingsProps {
  settings: {
    slippage: number;
    deadline: number;
  };
  setSettings: (settings: { slippage: number; deadline: number }) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const TradeSettings = ({ settings, setSettings, isOpen, onClose }: TradeSettingsProps) => {
  const [customSlippage, setCustomSlippage] = useState('');
  const [customDeadline, setCustomDeadline] = useState('');

  const handleSlippageChange = (value: number) => {
    setSettings({ ...settings, slippage: value });
    setCustomSlippage('');
  };

  const handleCustomSlippageChange = (value: string) => {
    setCustomSlippage(value);
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 50) {
      setSettings({ ...settings, slippage: numValue });
    }
  };

  const handleDeadlineChange = (value: string) => {
    setCustomDeadline(value);
    const numValue = parseInt(value);
    if (!isNaN(numValue) && numValue > 0 && numValue <= 60) {
      setSettings({ ...settings, deadline: numValue });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      
      {/* Settings Popover */}
      <div className="fixed top-20 right-4 z-50">
        <div className="bg-[#1a1b1f] border border-gray-800 rounded-2xl w-80 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-bold text-white">Transaction Settings</h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-6">
            {/* Slippage Tolerance */}
            <div>
              <label className="text-xs text-gray-400 block mb-3 font-medium">
                Slippage Tolerance
              </label>
              <div className="flex gap-2 mb-2">
                {[0.1, 0.5, 1.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSlippageChange(s)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                      settings.slippage === s && !customSlippage
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                        : 'border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white'
                    }`}
                  >
                    {s}%
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Custom"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippageChange(e.target.value)}
                  className="flex-1 bg-[#13141e] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
                  min="0.01"
                  max="50"
                  step="0.01"
                />
                <span className="text-gray-400 text-sm py-2">%</span>
              </div>
              {settings.slippage > 5 && (
                <p className="text-xs text-yellow-400 mt-2">
                  ⚠️ High slippage! Your transaction may be front-run.
                </p>
              )}
            </div>

            {/* Transaction Deadline */}
            <div>
              <label className="text-xs text-gray-400 block mb-3 font-medium">
                Transaction Deadline
              </label>
              <div className="flex gap-2 mb-2">
                {[10, 20, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setSettings({ ...settings, deadline: d });
                      setCustomDeadline('');
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                      settings.deadline === d && !customDeadline
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                        : 'border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white'
                    }`}
                  >
                    {d}m
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Custom"
                  value={customDeadline}
                  onChange={(e) => handleDeadlineChange(e.target.value)}
                  className="flex-1 bg-[#13141e] border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
                  min="1"
                  max="60"
                />
                <span className="text-gray-400 text-sm py-2">minutes</span>
              </div>
            </div>

            {/* Info Section */}
            <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
              <h4 className="text-xs font-medium text-gray-300 mb-2">💡 Pro Tips</h4>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Lower slippage = better price, but higher failure risk</li>
                <li>• V4 pools typically need less slippage than V3</li>
                <li>• Set deadline based on network congestion</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
