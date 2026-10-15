import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useProjectTemplates } from '../JamTemplateContext.js';
import { PERFORMANCE_LABELS } from '../performanceModel.js';
import { jamCombinationSnapshot, sortUserTemplatesForCreation } from '../jamTemplateProjects.js';
import createAudioEngine from '../../audio/createAudioEngine.js';
import { createSessionPlayback } from '../sessionPlayback.js';
import './templateJam.css';
import TemplateDialog from './TemplateDialog.jsx';
import UserTemplateCard from './UserTemplateCard.jsx';
void TemplateDialog;
void UserTemplatePicker;
void UserTemplateCard;

export const EMPTY_DRUM_TEMPLATES_MESSAGE = '还没有鼓模板，在 Jam 中创作并保存后会显示在这里。';

// Empty clips and the literal-note Chord editor have no built-in template panel.
// Keep their saved-phrase access behind the regular template entry as well.
export function UserTemplateMenu({ trackId, disabled = false }) {
  const { project } = useProjectTemplates();
  const [open, setOpen] = useState(false);
  if (trackId !== 'drums' && !project?.workspace.templates[trackId]?.length) return null;
  const label = { drums: '选择律动模板', chord: '选择和弦模板', bass: '选择Bass弹奏律动模板', melody: '选择 Melody 风格模板' }[trackId];
  return <>
    <button className="btn-template-groove" type="button" disabled={disabled} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}>{label}</button>
    {open && <TemplateDialog className="creation-template-dialog" titleId={`saved-${trackId}-title`} onClose={() => setOpen(false)}>
      <h2 id={`saved-${trackId}-title`}>{PERFORMANCE_LABELS[trackId]}模板</h2>
      <UserTemplatePicker trackId={trackId} emptyMessage={trackId === 'drums' ? EMPTY_DRUM_TEMPLATES_MESSAGE : undefined} disabled={disabled} onApplied={() => setOpen(false)} />
      <button type="button" onClick={() => setOpen(false)}>关闭</button>
    </TemplateDialog>}
  </>;
}

// Mounted inside the editor's existing template panel, never in a second dialog.
export default function UserTemplatePicker(props) {
  const context = useProjectTemplates();
  if (!context.project?.workspace.templates[props.trackId]?.length) return props.emptyMessage ? <p className="user-template-empty">{props.emptyMessage}</p> : null;
  return <UserTemplateSection key={context.project.id} {...props} context={context} />;
}

void UserTemplateSection;
function UserTemplateSection({ trackId, disabled = false, context, ref, onBeforePreview, onApplied }) {
  const { project, applyTemplate, hasTemplateDestinationContent, preparePreview } = context;
  const [pending, setPending] = useState(null), [error, setError] = useState(''), [previewId, setPreviewId] = useState(null);
  const player = useRef(null);
  const stop = useCallback(() => { player.current?.stop(); setPreviewId(null); }, []);
  useImperativeHandle(ref, () => ({ stop }), [stop]);
  useEffect(() => () => player.current?.stop(), []);
  const templates = sortUserTemplatesForCreation(project.workspace.templates[trackId]);
  function apply(template) {
    try {
      stop(); onBeforePreview?.();
      applyTemplate(template); setPending(null); setError(''); onApplied?.();
    } catch (e) { setError(e.message); }
  }
  function requestApply(template) {
    stop(); setError('');
    if (hasTemplateDestinationContent(template)) setPending(template);
    else apply(template);
  }
  function preview(template) {
    if (previewId === template.id) { stop(); return; }
    onBeforePreview?.(); preparePreview?.(); setError('');
    player.current ??= createSessionPlayback(createAudioEngine(), value => {
      if (value.error) { setError(value.error); setPreviewId(null); }
    });
    const snapshot = jamCombinationSnapshot(project.workspace, template, true);
    player.current.launch(snapshot, project.workspace.bpm, { edit: true, quantize: 'step' });
    setPreviewId(template.id);
  }
  return <section className="user-template-section" aria-label={`我的${PERFORMANCE_LABELS[trackId]}模板`}>
    {pending ? <div className="user-template-confirm" role="group" aria-label="确认覆盖模板">
      <p>目标小节已有内容，应用「{pending.name}」会覆盖这些小节。</p>
      <button type="button" disabled={disabled} onClick={() => apply(pending)}>确认应用</button>
      <button type="button" onClick={() => setPending(null)}>取消</button>
    </div> : <div className="user-template-list">{templates.map(template => <UserTemplateCard template={template} key={template.id} disabled={disabled} playing={previewId === template.id} onApply={requestApply} onPreview={preview} />)}</div>}
    {error && <p className="user-template-error" role="alert">{error}</p>}
  </section>;
}
