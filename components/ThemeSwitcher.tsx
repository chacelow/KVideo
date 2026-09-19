'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="w-7 h-7 flex items-center justify-center rounded-md text-[#9499a0] hover:text-[#e3e5e7] hover:bg-white/5 transition-colors cursor-pointer"
      aria-label={isDark ? '切换至浅色模式' : '切换至深色模式'}
      title={isDark ? '深色模式 (点击切换)' : '浅色模式 (点击切换)'}
    >
      {isDark ? <Moon size={14} /> : <Sun size={14} />}
    </button>
  );
}
