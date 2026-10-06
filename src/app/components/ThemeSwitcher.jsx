import { useSyncExternalStore } from 'react';
import { Palette } from 'lucide-react';
import { getTheme, setTheme, subscribeTheme } from '../themeStore.js';
import { renderIcon } from './icons.js';

export function ThemeSwitcher({ labelPrefix = '' }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'hardware');
  const name = theme === 'swiss' ? 'Swiss Grid' : '硬件';
  const nextName = theme === 'swiss' ? '硬件' : 'Swiss Grid';
  // Keep native button activation separate from the workspace's music shortcuts.
  return (
    <button
      className="theme-switcher"
      type="button"
      aria-label={`切换为 ${nextName} 皮肤，当前皮肤：${name}`}
      aria-pressed={theme === 'swiss'}
      title={`当前皮肤：${name}。点击切换为 ${nextName}`}
      onClick={() => setTheme(theme === 'swiss' ? 'hardware' : 'swiss')}
      onKeyDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
    >
      {renderIcon(Palette)}
      <span className="theme-switcher-label">{labelPrefix}{name}</span>
    </button>
  );
}
