import TemplateDialog from './TemplateDialog.jsx';
void TemplateDialog;
import { useEffect, useRef, useState } from 'react';
import { useProjectTemplates } from '../JamTemplateContext.js';
import { PERFORMANCE_LABELS } from '../performanceModel.js';
import { jamCombinationSnapshot } from '../jamTemplateProjects.js';
import createAudioEngine from '../../audio/createAudioEngine.js';
import { createSessionPlayback } from '../sessionPlayback.js';
import './templateJam.css';

export default function UserTemplatePicker({ trackId, disabled = false }) {
  const { project, applyTemplate, hasTemplateDestinationContent, preparePreview } = useProjectTemplates();
  const [open,setOpen] = useState(false), [pending,setPending] = useState(null), [error,setError] = useState(''), [previewId,setPreviewId] = useState(null);
  const player = useRef(null);
  const stop = () => { player.current?.stop(); setPreviewId(null); };
  useEffect(() => () => player.current?.stop(), []);
  useEffect(() => {
    const key = e => { if (e.key === 'Escape' && open) { e.preventDefault(); player.current?.stop(); setPreviewId(null); setPending(null); setOpen(false); } };
    window.addEventListener('keydown',key); return () => window.removeEventListener('keydown',key);
  }, [open]);
  if (!project) return null;
  function apply(template) {
    try { stop(); applyTemplate(template); setPending(null); setOpen(false); setError(''); }
    catch(e) { setError(e.message); }
  }
  function preview(template) {
    if (previewId === template.id) { stop(); return; }
    preparePreview?.();
    player.current ??= createSessionPlayback(createAudioEngine(), value => { if (value.error) setError(value.error); });
    const w = { ...project.workspace, selection: Object.fromEntries(['drums','chord','bass','melody'].map(t => [t,null])) };
    const snapshot = jamCombinationSnapshot(w,template,true);
    player.current.launch(snapshot,w.bpm,{ edit:true,quantize:'step' }); setPreviewId(template.id);
  }
  return <div className="user-template-picker"><button type="button" disabled={disabled} onClick={() => { setOpen(true); setError(''); }}>我的模板</button>
    {open && <TemplateDialog className="template-picker-dialog" titleId={`my-${trackId}-templates-title`} onClose={() => { stop(); setPending(null); setOpen(false); }}>
      <h2 id={`my-${trackId}-templates-title`}>我的{PERFORMANCE_LABELS[trackId]}模板</h2><p className="template-picker-project">{project.name}</p>
      {pending ? <><p>目标小节已有内容，应用「{pending.name}」会覆盖这些小节。</p><button type="button" onClick={() => apply(pending)}>应用模板</button><button type="button" onClick={() => setPending(null)}>返回列表</button></> : <div className="template-picker-list">{project.workspace.templates[trackId].length ? project.workspace.templates[trackId].map(template => <div key={template.id} style={{ display:'contents' }}>
        <button type="button" onClick={() => hasTemplateDestinationContent(template) ? setPending(template) : apply(template)}>{template.name} · {template.bars.length}小节</button>
        <button type="button" aria-label={`试听${template.name}`} aria-pressed={previewId === template.id} onClick={() => preview(template)}>{previewId === template.id ? '停止' : '试听'}</button>
      </div>) : <p>在Jam中保存模板后，会显示在这里。</p>}</div>}
      <p role="status">{error}</p><button type="button" onClick={() => { stop(); setPending(null); setOpen(false); }}>关闭</button>
    </TemplateDialog>}
  </div>;
}
