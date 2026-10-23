import TemplateDialog from './TemplateDialog.jsx';
void TemplateDialog;
import { createElement, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Home, Play, Square, Undo2, Redo2, ArrowLeft, Save, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher.jsx';
import JamProjectControls from './JamProjectControls.jsx';
import JamPerformanceDeck from './JamPerformanceDeck.jsx';
import RotaryKnob from './RotaryKnob.jsx';
import DrumStepGrid from './DrumStepGrid.jsx';
import JamTemplateCard from './JamTemplateCard.jsx';
import JamPhrasePreview from './JamPhrasePreview.jsx';
import { createJamAudition } from '../jamAudition.js';
import { toggleJamTemplate } from '../jamTemplateSelection.js';
import { PERFORMANCE_TRACKS as TRACKS, PERFORMANCE_LABELS as LABELS, performanceTemplates } from '../performanceModel.js';
import { getJamTemplateProjects, jamCombinationSnapshot } from '../jamTemplateProjects.js';
import { defaultTimbres, snapshotSection, TIMBRE_OPTIONS } from '../performanceSession.js';
import { getDialDrumPreset } from '../../data/dialDrumPresets.js';
import { PERFORMANCE_SAMPLE_BANKS } from '../../data/performanceTimbres.js';
import { createJamEffects } from '../jamEffects.js';
import { createSessionPlayback } from '../sessionPlayback.js';
import createAudioEngine from '../../audio/createAudioEngine.js';
import { toggleDrumsCellInstrument, getDrumsCellInstruments } from '../../domain/drumsCells.js';
import { mapPerformanceKeyboard } from '../../input/performanceInput.js';
import useJamMidiController from '../../input/useJamMidiController.js';
import './performance.css';
import './jamWorkspace.css';
import './templateJam.css';
import './jamStudio.css';

void [Home, Play, Square, Undo2, Redo2, ArrowLeft, Save, Volume2, VolumeX, ChevronLeft, ChevronRight, RotaryKnob, JamProjectControls, JamPerformanceDeck, DrumStepGrid, JamTemplateCard, JamPhrasePreview];
const copy = value => structuredClone(value);
const performanceNow = () => globalThis.performance.now();
const ART = Object.fromEntries(TRACKS.map(t => [t, `${import.meta.env.BASE_URL}assets/jam-instruments/${t}-v1.png`]));
const timbreLabel = id => PERFORMANCE_SAMPLE_BANKS[id]?.label ?? ({ 'soft-electronic-kit':'柔和电子鼓', 'warm-electric-piano':'温暖电钢琴', 'round-electric-bass':'圆润电贝司', 'airy-synth-lead':'空气感合成器' })[id] ?? id;
const emptySelection = () => Object.fromEntries(TRACKS.map(t => [t, null]));
export default function PerformanceMode({ active, genreId, profileId = null, initialBpm, onBack, onHome, controlsRef, hardwareInput, projectStore: providedStore }) {
  const [projectStore] = useState(() => providedStore ?? getJamTemplateProjects(genreId, profileId, initialBpm));
  const library = useSyncExternalStore(projectStore.subscribe, projectStore.getSnapshot);
  const project = library.projects.find(p => p.id === library.activeId), w = project.workspace;
  const [audio] = useState(() => createAudioEngine());
  const [effects] = useState(() => createJamEffects(audio));
  const fx = useSyncExternalStore(effects.subscribe, effects.getSnapshot);
  const [status, setStatus] = useState({ mode: 'stopped', loading: false });
  const [playback] = useState(() => createSessionPlayback(audio, setStatus));
  const [editingTrack, setEditingTrack] = useState(null);
  const [solo, setSolo] = useState(false), [message, setMessage] = useState(''), [pendingEditor, setPendingEditor] = useState(null);
  const [audition] = useState(() => createJamAudition(playback, {readWorkspace:() => projectStore.current().workspace, readDraft:() => projectStore.current().workspace.draft, onSoloChange:setSolo}));
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showEffects, setShowEffects] = useState(false);
  const [history, setHistory] = useState({ undo: [], redo: [] });
  const [page, setPage] = useState(0), [savedAt, setSavedAt] = useState(-Infinity);
  const [editBar, setEditBar] = useState(0);
  const gesture = useRef(null), histories = useRef({});
  const midiControlsRef = useRef(null), midiEditorVersion = useRef(0);
  const midiInput = useJamMidiController({ active, controlsRef: midiControlsRef });
  const artNodes = useRef({}), artPositions = useRef(null), animations = useRef([]);
  const workbench = useRef(null);
  useEffect(() => { if (workbench.current) workbench.current.scrollTop = 0; }, [editingTrack, project.id]);
  function captureArt() {
    artPositions.current = Object.fromEntries(TRACKS.map(t => [t,artNodes.current[t]?.getBoundingClientRect()]));
  }
  useLayoutEffect(() => {
    const before = artPositions.current;
    artPositions.current = null;
    if (!before) return;
    animations.current.forEach(animation => animation.cancel());
    animations.current = [];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (const t of TRACKS) {
      const node = artNodes.current[t], from = before[t], to = node?.getBoundingClientRect();
      if (!from || !to?.width) continue;
      animations.current.push(node.animate([
        {transformOrigin:'top left',transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`},
        {transformOrigin:'top left',transform:'translate(0,0) scale(1)'},
      ], {duration:460,easing:'cubic-bezier(.22,1,.36,1)'}));
    }
  }, [editingTrack]);
  useEffect(() => () => animations.current.forEach(animation => animation.cancel()), []);
  const draft = editingTrack && w.draft?.trackId === editingTrack ? w.draft : null;
  const running = status.mode !== 'stopped';
  const sourceGenre = project.genreId ?? genreId, sourceProfile = project.profileId ?? profileId;
  const catalog = performanceTemplates(sourceGenre, sourceProfile);
  const pageCount = Math.max(1, ...TRACKS.map(t => Math.ceil(w.templates[t].length / 8)));
  const effectivePage = Math.min(page, pageCount - 1);
  const templates = Object.fromEntries(TRACKS.map(t => [t, w.templates[t].slice(effectivePage * 8, effectivePage * 8 + 8)]));
  const instrumentTimbre = t => w.timbres?.[t] ?? w.templates[t].find(p => p.id === w.selection[t])?.timbreId ?? w.draftsByTrack?.[t]?.timbreId ?? defaultTimbres()[t];
  function sourceDraft(t, sourceId, timbreId) {
    const timbre = timbreId ?? instrumentTimbre(t);
    if (t === 'drums') {
      const p = getDialDrumPreset(50,50);
      return { trackId: t, name: '', timbreId: timbre, params: { strength: 50, groove: 50 }, sourcePresetId: p.id, bars: copy(p.bars) };
    }
    const source = catalog[t].find(p => p.id === sourceId) ?? catalog[t][0];
    const snap = snapshotSection({ id: 'source', kind: 'main', selection: { ...emptySelection(), [t]: source.id }, timbres: { ...defaultTimbres(), [t]: timbre } }, sourceGenre, sourceProfile);
    return { trackId: t, name: '', timbreId: timbre, sourcePresetId: source.id, bars: copy(snap.matrix[t].slice(0, snap.phraseBars[t])) };
  }
  function launch(quantize = 'bar', override = draft, overrideSolo = solo) {
    const snapshot = jamCombinationSnapshot(projectStore.current().workspace, override, overrideSolo);
    if (!snapshot) { playback.stop(); return; }
    playback.launch(snapshot, projectStore.current().workspace.bpm, { edit: true, quantize, preservePhase: true });
  }
  function replaceDraft(next, record = true, preserveDirty = false) {
    if (record && draft) setHistory(h => ({ undo: [...h.undo, copy(draft)].slice(-50), redo: [] }));
    projectStore.setDraft({ ...next,dirty:preserveDirty ? Boolean(next.dirty) : true });
    if (running) launch('step', next);
  }
  function openEditor(t, template = null, force = false) {
    const current = projectStore.current().workspace;
    const existing = current.draftsByTrack?.[t] ?? (current.draft?.trackId === t ? current.draft : null);
    if (!force && template && existing?.dirty && existing.editingTemplateId !== template.id) { setPendingEditor({t,template}); return; }
    const next = template && (force || existing?.editingTemplateId !== template.id)
      ? {...copy(template),editingTemplateId:template.id,dirty:false} : existing ? copy(existing) : sourceDraft(t);
    if (t === 'drums' && !next.params) next.params = {strength:50,groove:50};
    midiInput.reset(); midiEditorVersion.current += 1;
    audition.release();
    if (editingTrack) histories.current[editingTrack] = history;
    if (!editingTrack) captureArt();
    projectStore.setDraft(next); setEditingTrack(t); setSolo(false);
    setHistory(force || template && existing?.editingTemplateId !== template.id ? {undo:[],redo:[]} : histories.current[t] ?? {undo:[],redo:[]});
    effects.select(t); setMessage(''); setEditBar(0);
  }
  function finishEditor() {
    midiInput.reset(); midiEditorVersion.current += 1;
    const continuing = audition.getTrack() ? audition.wasPlaying() : playback.isActive();
    audition.release({resume:false});
    histories.current[editingTrack] = history;
    captureArt(); setEditingTrack(null); setSolo(false);
    if (draft?.dirty) setMessage('草稿已保留，下次点乐器继续编辑。');
    if (continuing) launch('step',null,false);
  }
  function resolvePending(save) {
    const {t,template} = pendingEditor;
    if (save) {
      const previous = projectStore.current().workspace.draftsByTrack[t];
      if (!projectStore.saveTemplate(previous,previous.name ?? '',previous.editingTemplateId)) { setMessage('模板未能保存，草稿已保留。'); return; }
    }
    setPendingEditor(null); openEditor(t,template,true);
  }
  function saveTemplate(update = false) {
    if (!draft) return false;
    const saved = projectStore.saveTemplate(draft, draft.name ?? '', update ? draft.editingTemplateId : null);
    if (!saved) { setMessage('模板未能保存，当前编辑已保留。'); return false; }
    const next = { ...copy(draft), dirty:false, name: update ? saved.name : '', ...(update ? { editingTemplateId: saved.id } : { editingTemplateId: undefined }) };
    projectStore.setDraft(next); setSavedAt(performanceNow()); setMessage(`已保存「${saved.name}」`); return true;
  }
  function changeParameter(parameter, value, record = false) {
    const current = projectStore.current().workspace.draft;
    if (editingTrack !== 'drums' || current?.trackId !== 'drums') return;
    const params = { ...current.params, [parameter]: value };
    if (current.params?.[parameter] === value) return;
    const p = getDialDrumPreset(params.strength, params.groove);
    setEditBar(0);
    if (record) setHistory(h => ({ undo: [...h.undo, copy(current)].slice(-50), redo: [] }));
    replaceDraft({ ...current, params, sourcePresetId: p.id, bars: copy(p.bars) }, false);
  }
  function beginGesture() { if (!gesture.current && draft) gesture.current = copy(draft); }
  function endGesture() {
    const before = gesture.current; gesture.current = null;
    if (before && JSON.stringify(before) !== JSON.stringify(projectStore.current().workspace.draft)) setHistory(h => ({ undo: [...h.undo, before].slice(-50), redo: [] }));
  }
  function undo(redo = false) {
    const from = redo ? history.redo : history.undo;
    if (!from.length) return;
    replaceDraft(copy(from[from.length - 1]), false, true);
    setHistory(redo ? { undo: [...history.undo, copy(draft)], redo: history.redo.slice(0,-1) } : { undo: history.undo.slice(0,-1), redo: [...history.redo, copy(draft)] });
  }
  function trigger(t, id) {
    toggleJamTemplate({projectStore,playback,audition,trackId:t,templateId:id,draft});
  }
  function toggleMute(t) {
    if (audition.getTrack() === t) audition.stop();
    const current = projectStore.current().workspace;
    projectStore.patch({mutedTracks:{...current.mutedTracks,[t]:!current.mutedTracks[t]},volumes:{...current.volumes,[t]:current.volumes[t] <= -24 ? 0 : current.volumes[t]}});
  }
  function togglePlayback() {
    if (running) { audition.stop(); effects.reset(); } else launch('step');
  }
  function changeInstrumentTimbre(t, timbreId) {
    projectStore.setTimbre(t,timbreId);
    if (playback.isActive()) launch('step',null,false);
  }
  function changeMix(track, value) {
    const targets = effects.getSnapshot().selectedTracks;
    const current = projectStore.current().workspace;
    projectStore.patch({ volumes: { ...current.volumes, ...Object.fromEntries(targets.map(t => [t,value])) }, mutedTracks: { ...current.mutedTracks, ...Object.fromEntries(targets.map(t => [t,false])) } });
    targets.forEach(t => effects.volume(t,value));
  }
  function openProject(id) {
    if (!projectStore.save()) return false;
    midiInput.reset(); midiEditorVersion.current += 1;
    if (!(id ? projectStore.switchTo(id) : projectStore.create())) return false;
    audition.stop(); effects.reset(true); histories.current = {}; setEditingTrack(null); setSolo(false); setPage(0); setMessage(''); return true;
  }
  useEffect(() => () => { playback.stop(); effects.resetHolds(); }, [effects, playback]);
  useEffect(() => {
    const t = solo ? audition.getTrack() : null;
    effects.syncMix(t ? {...w.volumes,[t]:w.mutedTracks[t] || w.volumes[t] <= -24 ? 0 : w.volumes[t]} : w.volumes,
      t ? {...w.mutedTracks,[t]:false} : w.mutedTracks);
  }, [effects,w.volumes,w.mutedTracks,solo,audition]);
  useEffect(() => { if (status.error) audition.release({resume:false}); }, [status.error,audition]);
  useEffect(() => {
    if (!active) audition.stop();
    if (!active || !running || status.loading) effects.resetHolds();
    const release = () => effects.resetHolds();
    window.addEventListener('blur',release); return () => window.removeEventListener('blur',release);
  }, [active,running,status.loading,effects,audition]);
  useEffect(() => {
    if (!active) return;
    const handler = e => {
      if (e.target.closest?.('input,select,textarea,[contenteditable],dialog,[role=dialog],[popover]:popover-open')) return;
      if (editingTrack && (e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); undo(e.shiftKey); return; }
      if (e.target.closest?.('button,[role=slider]')) return;
      const cmd = mapPerformanceKeyboard(e,templates);
      if (cmd) { e.preventDefault(); trigger(cmd.trackId,cmd.templateId); }
      else if (e.code === 'Space' && !e.repeat) { e.preventDefault(); togglePlayback(); }
      else if (e.key === 'Escape') audition.stop();
    };
    window.addEventListener('keydown',handler); return () => window.removeEventListener('keydown',handler);
  });
  useLayoutEffect(() => {
    if (!active) return;
    const controls = { templates,
      dispatch(cmd) {
        const track = effects.getSnapshot().selectedTrack;
        if (cmd.type === 'template') trigger(cmd.trackId,cmd.templateId);
        if (cmd.type === 'save' && editingTrack) saveTemplate();
        if (cmd.type === 'togglePlayback') togglePlayback();
        if (cmd.type === 'stop') { audition.stop(); effects.reset(); }
        if (cmd.type === 'page') setPage(Math.max(0,Math.min(pageCount-1,effectivePage+cmd.delta)));
        if (cmd.type === 'selectTrack') effects.select(cmd.trackId,cmd.additive);
        if (cmd.type === 'toggleTrack') effects.toggleTrack(cmd.trackId);
        if (cmd.type === 'volume') changeMix(track,cmd.value);
        if (cmd.type === 'cutoff') effects.getSnapshot().selectedTracks.forEach(t => effects.cutoff(t,cmd.value));
        if (cmd.type === 'reverb') effects.reverb(cmd.value);
        if (cmd.type === 'drumParameter') changeParameter(cmd.parameter,cmd.value,true);
        if (['pitch','chopper','brake'].includes(cmd.type)) {
          if (!cmd.pressed) effects.release(cmd.type,cmd.token); else if (playback.isReady()) effects.press(cmd.type,cmd.token,cmd.value,w.bpm);
        }
        if (cmd.type === 'repeat') { if (!cmd.pressed) effects.repeat.release(cmd.token); else if (playback.isReady()) effects.repeat.press(cmd.token,cmd.division,w.bpm); }
      },
      release: () => effects.resetHolds(),
      getMidiContext: () => {
        const current = projectStore.current(), snapshot = effects.getSnapshot(), t = snapshot.selectedTrack;
        return { projectId: current.id, editorVersion: midiEditorVersion.current, editingTrack,
          blocked: Boolean(pendingEditor || deleteTarget), playing: playback.isReady() && !status.loading,
          selectedTrack: t, selectedTracks: snapshot.selectedTracks,
          params: current.workspace.draft?.params ?? {strength:50,groove:50},
          values: {volume:snapshot.volumes[t],cutoff:snapshot.cutoffs[t],reverb:snapshot.reverbs[t],pitch:snapshot.pitches[t]} };
      },
      getSurface: () => ({ ...effects.getSnapshot(), version: 5, templates, selection: w.selection,
        page: effectivePage, pageCount, sections: [], status, beatPhase: playback.getBeatPhase(),
        repeat: effects.getSnapshot().repeats[effects.getSnapshot().selectedTrack], savedAt, canSave: Boolean(draft), storageError: Boolean(library.error) }),
    };
    midiControlsRef.current = controls;
    if (controlsRef) controlsRef.current = controls;
    return () => {
      if (midiControlsRef.current === controls) midiControlsRef.current = null;
      if (controlsRef?.current === controls) controlsRef.current = null;
    };
  });
  const previewBar = Math.min(editBar,(draft?.bars.length ?? 1)-1);
  const canPlay = Boolean(draft || TRACKS.some(t => w.selection[t]));
  return <section className="performance-mode jam-workspace template-jam jam-studio" hidden={!active} aria-label="Jam 演奏" data-editing={Boolean(draft)}>
    <header className="performance-header">
      {createElement(ThemeSwitcher)}
      {onHome && <button type="button" className="performance-home" aria-label="返回首页" onClick={() => { if (projectStore.save()) {audition.stop(); onHome();} }}><Home size={16}/></button>}
      <button type="button" className="performance-connect" onClick={() => { if (projectStore.save()) {audition.stop(); onBack();} }}>← 创作模式</button>
      <div className="performance-title"><span className="performance-eyebrow">PROJECT ARRANGER</span><h1>Jam · 演奏</h1></div>
      <label className="performance-tempo">BPM <input type="number" min="40" max="240" aria-label="演奏速度 BPM" value={w.bpm} onChange={e => { const value=Math.max(40,Math.min(240,Math.round(Number(e.target.value)||100))); projectStore.patch({bpm:value}); playback.setTempo(value); }}/></label>
      <button type="button" className="performance-connect" title="推子：音量、滤波、混响、弯音（手动回中）；旋钮：鼓强度、律动。经过屏幕当前值后接管。" onClick={() => { void audio.startAudio(); void hardwareInput?.onConnect(); void midiInput.connect(); }}>{midiInput.status === 'connecting' ? '正在连接…' : <>{[hardwareInput?.status === 'connected' && 'Launchpad',midiInput.status === 'connected' && '旋钮推子'].filter(Boolean).join(' · ') || '连接控制器'}{hardwareInput?.status === 'connected' || midiInput.status === 'connected' ? ' 已连接' : ''}</>}</button>
    </header>
    <JamProjectControls project={project} projects={library.projects} onSave={() => setMessage(projectStore.save() ? '项目已保存。' : '项目保存失败，草稿已保留。')}
      onNew={() => openProject(null)} onOpen={openProject} onRename={projectStore.rename}/>
    <div ref={workbench} className="template-jam-workbench studio-workbench">
      <main className="studio-main">
        <div className="studio-heading"><h2>乐句工作台</h2><p>{draft ? '切换乐器，草稿会保留' : '单击选择 / 取消 · 点笔编辑'}</p><button type="button" className="studio-effects-toggle" aria-expanded={showEffects} aria-controls="jam-studio-effects" onClick={() => setShowEffects(open => !open)}>现场效果</button></div>
        <div className="studio-gallery" aria-label="四轨乐器与模板">{TRACKS.map(t => <section className="studio-instrument" data-track={t} data-active={editingTrack === t} key={t} aria-label={`${LABELS[t]}模板`}>
          <div className="studio-instrument-top"><button type="button" className="studio-instrument-open" aria-label={`创作${LABELS[t]}模板`} onClick={() => openEditor(t)} aria-expanded={editingTrack === t}>
            <span className="studio-instrument-art" data-art-track={t} ref={node => {artNodes.current[t]=node;}}><img src={ART[t]} alt="" draggable={false} decoding="async"/></span>
            {draft && <span className="studio-instrument-label"><strong>{LABELS[t]}</strong><span className="studio-editing-state">{editingTrack === t ? '编辑中' : ''}</span><small>{w.templates[t].length ? `${w.templates[t].length} 个乐句` : '开始创作'}</small></span>}
          </button>{!draft && <div className="studio-instrument-label"><strong>{LABELS[t]}</strong><label className="studio-instrument-timbre" title="切换音色"><select aria-label={`${LABELS[t]}音色`} value={instrumentTimbre(t)} onChange={e => changeInstrumentTimbre(t,e.target.value)}>{TIMBRE_OPTIONS[t].map(id => <option key={id} value={id}>{timbreLabel(id)}</option>)}</select></label></div>}<button type="button" className="studio-track-mute" aria-label={`${w.mutedTracks[t] ? '取消静音' : '静音'}${LABELS[t]}`} aria-pressed={w.mutedTracks[t]} onClick={() => toggleMute(t)} title={w.mutedTracks[t] ? '取消静音' : '静音'}>{w.mutedTracks[t] ? <VolumeX size={14}/> : <Volume2 size={14}/>}</button></div>
          <div className="studio-template-list" aria-label={`${LABELS[t]}已保存乐句`}>{w.templates[t].length ? w.templates[t].map(p => <JamTemplateCard key={`${project.id}:${p.id}:${p.name}`} template={p} selected={w.selection[t] === p.id}
            playing={running && !w.mutedTracks[t] && (!solo || editingTrack === t)} onSelect={() => trigger(t,p.id)} onEdit={() => openEditor(t,p)} onRemove={() => setDeleteTarget(p)}/>) : <span className="studio-template-empty">保存的乐句会出现在这里</span>}</div>
        </section>)}</div>
        {draft && <section className="studio-editor" key={editingTrack} data-track={editingTrack} aria-label={`${LABELS[editingTrack]}乐句编辑`}>
          <header className="studio-editor-heading"><div className="studio-editor-identity"><label className="studio-template-name-field">名称<input aria-label="模板名称" value={draft.name ?? ''} placeholder={`${LABELS[editingTrack]}新乐句`} maxLength={80} onChange={e => projectStore.setDraft({...draft,name:e.target.value,dirty:true})}/></label><span className="studio-draft-state">{draft.dirty ? '草稿' : draft.editingTemplateId ? '已保存乐句' : '新的声音'}</span></div><button type="button" className="studio-text-button" onClick={finishEditor}><ArrowLeft size={13}/> 收起编辑</button></header>
          <div className="studio-editor-controls">
            {editingTrack !== 'drums' && <div className="studio-phrase-settings"><label>起点<select aria-label={`${LABELS[editingTrack]}乐句起点`} value={draft.sourcePresetId} onChange={e => replaceDraft({...sourceDraft(editingTrack,e.target.value,draft.timbreId),name:draft.name,editingTemplateId:draft.editingTemplateId})}>{catalog[editingTrack].map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>}
            {editingTrack === 'drums' && <div className="studio-editor-knobs"><RotaryKnob label="强度" value={draft.params?.strength ?? 50} spectrum showTicks={false} lowLabel="温和" highLabel="强烈" onBegin={beginGesture} onEnd={endGesture} onChange={v => changeParameter('strength',v)}/><RotaryKnob label="律动" value={draft.params?.groove ?? 50} spectrum showTicks={false} lowLabel="平稳" highLabel="活跃" onBegin={beginGesture} onEnd={endGesture} onChange={v => changeParameter('groove',v)}/></div>}
          </div>
          <div className="studio-grid-toolbar"><span>{editingTrack === 'drums' ? '鼓点音序器' : '乐句预览'}</span><div className="studio-bar-pager"><button type="button" aria-label="上一小节" disabled={previewBar === 0} onClick={() => setEditBar(previewBar-1)}><ChevronLeft size={13}/></button><span>{previewBar+1} / {draft.bars.length} 小节</span><button type="button" aria-label="下一小节" disabled={previewBar+1 === draft.bars.length} onClick={() => setEditBar(previewBar+1)}><ChevronRight size={13}/></button></div><div className="studio-undo"><button type="button" aria-label="撤销模板修改" disabled={!history.undo.length} onClick={() => undo()}><Undo2 size={14}/></button><button type="button" aria-label="重做模板修改" disabled={!history.redo.length} onClick={() => undo(true)}><Redo2 size={14}/></button></div></div>
          {editingTrack === 'drums' ? <div className="studio-drum-grid"><DrumStepGrid renderStep={(row,stepNumber) => {
            const step=stepNumber-1,cell=draft.bars[previewBar][step],hits=cell?.drumHits?.filter(h => h.instrument === row.id) ?? [];
            const on=getDrumsCellInstruments(cell).includes(row.id);
            const label={kick:'底鼓',snare:'军鼓',hihat:'踩镲'}[row.id];
            return <button type="button" key={`${row.id}:${step}`} className={`drum-step ${on ? 'active' : ''} ${stepNumber%4 === 0 ? 'beat-end' : ''}`}
              data-instrument={row.id} data-step={step} data-playing={running && (status.bar ?? 0)%draft.bars.length === previewBar && status.step === step} aria-label={`${label}第${step+1}格`} aria-pressed={on}
              onClick={() => { const bars=copy(draft.bars); bars[previewBar][step]=toggleDrumsCellInstrument(cell,row.id); replaceDraft({...draft,bars}); }}>
              {hits.length > 1 && <span className="studio-hit-count" aria-label={`${hits.length}次击打`}>{hits.length}</span>}
            </button>;
          }}/></div> : <JamPhrasePreview draft={draft} bar={previewBar} step={running && (status.bar ?? 0)%draft.bars.length === previewBar ? status.step : null}/>}
          <footer className="studio-editor-actions"><button type="button" className="studio-solo" aria-label={`${solo ? '停止试听' : '试听'}${LABELS[editingTrack]}`} aria-pressed={solo} onClick={() => audition.toggle(draft)}>{solo ? <Square size={12}/> : <Play size={12}/>} {solo ? '停止试听' : '试听'}</button>
            <div>{draft.editingTemplateId && <button type="button" className="studio-text-button" onClick={() => saveTemplate(true)}>保存修改</button>}<button type="button" className="studio-save" onClick={() => saveTemplate()}><Save size={13}/>{draft.editingTemplateId ? '另存新模板' : '保存新模板'}</button></div></footer>
        </section>}
      </main>
      <aside id="jam-studio-effects" className="jam-effects studio-effects" data-open={showEffects} data-track={fx.selectedTrack} onKeyDown={e => { if (e.key === 'Escape') { setShowEffects(false); workbench.current?.querySelector('.studio-effects-toggle')?.focus(); } }}><header><h2>现场效果</h2><button type="button" className="studio-effects-close" aria-label="收起现场效果" onClick={() => { setShowEffects(false); workbench.current?.querySelector('.studio-effects-toggle')?.focus(); }}>×</button></header><div className="effect-targets" role="group" aria-label="效果目标轨道">{TRACKS.map(t => <button type="button" key={t} aria-pressed={fx.selectedTracks.includes(t)} onClick={() => effects.toggleTrack(t)}>{LABELS[t]}</button>)}</div>
        <JamPerformanceDeck key={project.id} effects={effects} session={w} enabled={active && running && !status.loading} changeMix={changeMix}/>
      </aside>
    </div>
    <footer className="template-jam-transport studio-transport"><button type="button" className="template-play-button" aria-label={running ? '停止组合' : '播放组合'} disabled={!running && !canPlay} onClick={togglePlayback}>{running ? <Square size={14}/> : <Play size={14}/>} {running ? '停止' : draft ? '试听组合' : '播放组合'}</button><span role="status">{library.error || status.error || midiInput.errorMessage || (status.loading ? '正在准备声音…' : status.pendingId ? '等待节拍切换' : message)}</span>
      <span className="template-page-controls">模板页 {effectivePage+1}/{pageCount}<button type="button" aria-label="上一页模板" disabled={!effectivePage} onClick={() => setPage(effectivePage-1)}>‹</button><button type="button" aria-label="下一页模板" disabled={effectivePage+1>=pageCount} onClick={() => setPage(effectivePage+1)}>›</button></span></footer>
    {pendingEditor && <TemplateDialog titleId="replace-draft-title" onClose={() => setPendingEditor(null)}><h2 id="replace-draft-title">保留当前草稿？</h2><p>这条轨道还有未保存为模板的修改。</p><button type="button" onClick={() => resolvePending(true)}>先保存再编辑</button><button type="button" onClick={() => resolvePending(false)}>放弃草稿并编辑</button><button type="button" onClick={() => setPendingEditor(null)}>取消</button></TemplateDialog>}
    {deleteTarget && <TemplateDialog titleId="delete-template-title" onClose={() => setDeleteTarget(null)}><h2 id="delete-template-title">删除「{deleteTarget.name}」？</h2><p>已放入创作时间线的乐句会保留。</p><button type="button" onClick={() => { projectStore.removeTemplate(deleteTarget.trackId,deleteTarget.id); setDeleteTarget(null); if (running) launch('step',draft,false); }}>删除</button><button type="button" onClick={() => setDeleteTarget(null)}>取消</button></TemplateDialog>}
  </section>;
}
