import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Square } from 'lucide-react';
import { clampPreviewBar, createTemplatePreview } from '../templatePreview.js';
import DrumTemplateRhythm from './DrumTemplateRhythm.jsx';

void ChevronLeft; void ChevronRight; void Play; void Square; void DrumTemplateRhythm; void NotePreview;

function NotePreview({ page, minPitch, maxPitch, name }) {
  return <div className="saved-note-preview" role="img" aria-label={`音符预览·${name}${page.notes.length ? '' : '·空小节'}`}>
    <div className="saved-note-beats" aria-hidden="true">{[1, 5, 9, 13].map(step => <span key={step}>{step}</span>)}</div>
    <svg viewBox="0 0 320 80" preserveAspectRatio="none" aria-hidden="true">
      {Array.from({ length: 17 }, (_, step) => <line key={`step-${step}`} className={step % 4 === 0 ? 'beat-line' : 'step-line'} x1={step * 20} x2={step * 20} y1="0" y2="80" />)}
      {[20, 40, 60].map(y => <line key={y} className="pitch-line" x1="0" x2="320" y1={y} y2={y} />)}
      {page.notes.map((note, i) => <rect key={i} className="saved-preview-note" x={note.start * 20} y={4 + (maxPitch - note.pitch) / (maxPitch - minPitch) * 66} width={Math.max(1, note.duration * 20 - 1)} height="6" rx="1">
        <title>{note.note} · 第{Number((note.start + 1).toFixed(2))}步 · {Number(note.duration.toFixed(2))}步{note.continued ? ' · 延音' : ''}</title>
      </rect>)}
    </svg>
  </div>;
}

export default function UserTemplateCard({ template, disabled, playing, onApply, onPreview }) {
  const [barIndex, setBarIndex] = useState(0);
  const preview = useMemo(() => createTemplatePreview(template), [template]);
  const pageIndex = clampPreviewBar(barIndex, preview.bars.length);
  const page = preview.bars[pageIndex];
  const drums = template.trackId === 'drums';
  const melody = template.trackId === 'melody';
  const shell = drums ? 'gtpl-card drum-template-card' : melody ? 'sctpl-card melody-scale-card' : 'bass-template-groove-card';
  const nameClass = drums ? 'gtpl-name-row' : melody ? 'sctpl-name-row' : 'chord-template-card-head';
  const footerClass = drums ? 'drum-template-card-footer' : melody ? 'sctpl-foot' : 'bass-template-card-footer';
  return <article className={`${shell} saved-template-card${playing ? ' is-previewing' : ''}`} data-user-template={template.id} data-track={template.trackId} aria-disabled={disabled}>
    <button type="button" className={drums ? 'saved-drum-template-select' : melody ? 'melody-scale-card-select' : 'bass-template-card-select'} disabled={disabled} aria-label={`应用${template.name}`} title={template.name} onClick={() => onApply(template)}>
      <span className={nameClass}><strong className={drums ? 'gtpl-name' : melody ? 'sctpl-name' : undefined}>{template.name}</strong><span className={drums ? 'gtpl-default-tag' : melody ? 'sctpl-default-tag' : undefined}>我的模板</span></span>
      {drums ? <DrumTemplateRhythm hits={page.hits} name={template.name} /> : <NotePreview page={page} minPitch={preview.minPitch} maxPitch={preview.maxPitch} name={template.name} />}
    </button>
    <div className={`${footerClass} saved-template-footer`}>
      {preview.bars.length > 1 ? <div className="saved-template-pager" role="group" aria-label={`${template.name}预览小节`}>
        <button type="button" aria-label={`${template.name}上一小节`} disabled={pageIndex === 0} onClick={() => setBarIndex(pageIndex - 1)}><ChevronLeft /></button>
        <span className="mono" aria-live="polite">{pageIndex + 1} / {preview.bars.length}</span>
        <button type="button" aria-label={`${template.name}下一小节`} disabled={pageIndex === preview.bars.length - 1} onClick={() => setBarIndex(pageIndex + 1)}><ChevronRight /></button>
      </div> : <span />}
      <button type="button" className={`drum-template-preview saved-template-preview${playing ? ' is-playing' : ''}`} disabled={disabled} aria-label={`${playing ? '停止试听' : '试听'}${template.name}`} aria-pressed={playing} onClick={() => onPreview(template)}>
        {playing ? <Square /> : <Play />}<span className="saved-template-preview-label">{playing ? '停止' : '试听'}</span>
      </button>
    </div>
  </article>;
}
