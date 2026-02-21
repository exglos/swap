import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export const ThemeToggle = ({ theme, onToggle }: ThemeToggleProps) => {
  return (
    <Button
      onClick={onToggle}
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-full"
      aria-label="Toggle theme"
    >
      {theme === 'light' ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </Button>
  );
};
