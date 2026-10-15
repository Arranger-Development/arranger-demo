import { Pencil, X } from 'lucide-react';

export default function JamTemplateCard({ template, selected, playing, onSelect, onEdit, onRemove }) {
  return <article className="studio-template" data-selected={selected} data-playing={playing && selected}>
    <button type="button" className="studio-template-play" aria-label={`${selected ? '取消选择' : '演奏'}${template.name}`} aria-pressed={selected}
      title={template.name} onClick={onSelect}
      onKeyDown={e => { if (e.key === 'F2' || (e.key === 'Enter' && e.altKey)) { e.preventDefault(); onEdit(); } }}>
      <span className="studio-template-name">{template.name}</span>
    </button>
    <span className="studio-template-tools">
      <button type="button" className="studio-template-edit" aria-label={`编辑${template.name}`} title="编辑模板" onClick={onEdit}><Pencil size={11}/></button>
      <button type="button" className="studio-template-remove" aria-label={`删除${template.name}`} title="删除模板" onClick={onRemove}><X size={12}/></button>
    </span>
  </article>;
}
void [Pencil, X];
