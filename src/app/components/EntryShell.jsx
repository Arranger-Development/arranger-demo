import { AudioLines, ArrowLeft } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher.jsx';
import { renderIcon } from './icons.js';
import './entry.css';

export function EntryShell({ children, onBack, backLabel = '返回首页', className = '', label = '创作入口' }) {
  return (
    <section className={`entry-surface ${className}`} aria-label={label}>
      <header className="entry-header">
        <div className="entry-brand">
          <span aria-hidden="true">{renderIcon(AudioLines)}</span>
          <span>Aether Synthesizers</span>
        </div>
        <ThemeSwitcher labelPrefix="外观 · " />
      </header>
      {onBack ? (
        <button className="entry-back" type="button" onClick={onBack}>
          <span aria-hidden="true">{renderIcon(ArrowLeft)}</span>{backLabel}
        </button>
      ) : null}
      <main className="entry-content">{children}</main>
    </section>
  );
}

void ThemeSwitcher;
