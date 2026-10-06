import { ArrowRight, LayoutGrid, Music2, Sparkles } from 'lucide-react';
import { EntryShell } from './EntryShell.jsx';
import { renderIcon } from './icons.js';

const ENTRIES = [
  { id: 'ai', title: 'AI 入口', description: '用文字、音频、视频或图片\n获取编曲建议', icon: Sparkles },
  { id: 'creation', title: '创作入口', description: '自由编排轨道与音符\n从你的想法开始', icon: Music2 },
  { id: 'jam', title: '演奏入口', description: '组合 Loop，实时演奏\n进入 Jam 模式', icon: LayoutGrid },
];

export function EntryHome({ onEnter }) {
  return (
    <EntryShell className="entry-home" label="创作入口">
      <h1 className="sr-only">选择你的创作方式</h1>
      <div className="entry-options">
        {ENTRIES.map((entry) => (
          <button className="entry-option" key={entry.id} type="button" onClick={() => onEnter(entry.id)}>
            <span className="entry-option-icon" aria-hidden="true">{renderIcon(entry.icon)}</span>
            <span className="entry-option-title">{entry.title}</span>
            <span className="entry-option-description">{entry.description}</span>
            <span className="entry-option-arrow" aria-hidden="true">{renderIcon(ArrowRight)}</span>
          </button>
        ))}
      </div>
    </EntryShell>
  );
}

void EntryShell;
