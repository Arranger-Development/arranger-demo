import { Pencil, X } from 'lucide-react';
import PhrasePerimeterProgress from './PhrasePerimeterProgress.jsx';

export default function JamTemplateCard({ template, playback, isDraft = false, isEmpty = false, selected, canCancel = false, state = 'idle', index, editing, reorderProps, onSelect, onEdit, onRemove }) {
  return <article className={`studio-template${isDraft ? ' studio-template-draft' : ''}`} data-slot-index={index} data-template-id={isDraft ? undefined : template.id} data-draft={isDraft || undefined} data-selected={selected} data-state={state} data-playing={state === 'playing'} data-editing={editing} {...reorderProps}>
    <button type="button" className="studio-template-play" aria-label={isDraft || isEmpty ? `继续编辑${template.name}，第 ${index + 1} 格` : `${state === 'queued' ? '取消等待' : canCancel ? '暂停' : '加入播放'}${template.name}${state === 'queued' ? '，等待下一小节进入' : state === 'playing' ? '，正在播放' : ''}`} aria-pressed={isDraft || isEmpty ? undefined : selected}
      aria-keyshortcuts={isDraft ? undefined : 'Alt+ArrowLeft Alt+ArrowRight'}
      title={isEmpty ? '空白乐句 · 点击编辑' : isDraft ? '点击继续编辑' : `${template.name} · ${state === 'queued' ? '取消等待' : canCancel ? '暂停此乐句' : '加入播放'} · 拖动排序 / Alt＋方向键移动`} onClick={onSelect}
      onKeyDown={e => { if (e.key === 'F2' || (e.key === 'Enter' && e.altKey)) { e.preventDefault(); onEdit(); } }}>
      <span className="studio-template-index" aria-hidden="true">{index + 1}</span><span className="studio-template-name">{template.name}</span>
    </button>
    {playback && !isDraft && !isEmpty && <PhrasePerimeterProgress playback={playback} track={template.trackId} phraseId={template.id} running={state === 'playing'} inset={2} radius={5}/>}
    <span className="studio-template-tools">
      <button type="button" className="studio-template-edit" aria-label={`编辑${template.name}`} title={isDraft ? '编辑草稿' : '编辑模板'} onClick={onEdit}><Pencil size={11}/></button>
      <button type="button" className="studio-template-remove" aria-label={`删除${template.name}`} title={isDraft ? '移除未保存草稿' : '删除模板'} onClick={onRemove}><X size={12}/></button>
    </span>
  </article>;
}
void [Pencil, X, PhrasePerimeterProgress];
