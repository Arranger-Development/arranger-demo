import TemplateDialog from './TemplateDialog.jsx';
void TemplateDialog;
import { createElement, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Home, Undo2, Redo2, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { ThemeSwitcher } from './ThemeSwitcher.jsx';
import JamProjectControls from './JamProjectControls.jsx';
import JamPerformanceDeck from './JamPerformanceDeck.jsx';
import RotaryKnob from './RotaryKnob.jsx';
import DrumStepGrid from './DrumStepGrid.jsx';
import JamLauncher from './JamLauncher.jsx';
import JamChordEditor from './JamChordEditor.jsx';
import { createJamAudition } from '../jamAudition.js';
import { createJamHeldEdits } from '../jamHeldEdits.js';
import { createJamPhraseHistory } from '../jamPhraseHistory.js';
import { toggleJamTemplate, launchJamColumn, deleteJamTemplate } from '../jamTemplateSelection.js';
import { jamTrackParameters, jamParameterLevels, jamTrackKnobs } from '../jamPerformanceState.js';
import { PERFORMANCE_TRACKS as TRACKS, PERFORMANCE_LABELS as LABELS, performanceTemplates } from '../performanceModel.js';
import { blankJamDraft, hasJamNotes, applyJamTrackParameter } from '../jamDraftActions.js';
import { jamTemplatePage, jamLauncherColumnCount } from '../jamTemplateSlots.js';
import { JAM_PITCHED_PRESETS as DIAL_PITCHED_PRESETS } from '../jamPitchedPresets.js';
import { getJamTemplateProjects, jamCombinationSnapshot, upgradeJamSlotLayout, defaultJamTimbres } from '../jamTemplateProjects.js';
import { snapshotSection } from '../performanceSession.js';
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
import './jamPerformanceRows.css';

void [Home, Undo2, Redo2, ArrowLeft, ChevronLeft, ChevronRight, RotaryKnob, JamProjectControls, JamPerformanceDeck, DrumStepGrid, JamLauncher, JamChordEditor];
const copy = value => structuredClone(value);
const performanceNow = () => globalThis.performance.now();
const ART = Object.fromEntries(TRACKS.map(t => [t, `${import.meta.env.BASE_URL}assets/jam-instruments/${t}-v1.png`]));
const timbreLabel = id => PERFORMANCE_SAMPLE_BANKS[id]?.label ?? ({ 'soft-electronic-kit':'柔和电子鼓', 'warm-electric-piano':'温暖电钢琴', 'round-electric-bass':'圆润电贝司', 'airy-synth-lead':'空气感合成器' })[id] ?? id;
const emptySelection = () => Object.fromEntries(TRACKS.map(t => [t, null]));
export default function PerformanceMode({ active, genreId, profileId = null, initialBpm, onBack, onHome, controlsRef, hardwareInput, projectStore: providedStore }) {
  const [projectStore] = useState(() => providedStore ?? getJamTemplateProjects(genreId, profileId, initialBpm));
  const library = useSyncExternalStore(projectStore.subscribe, projectStore.getSnapshot);
  const project = library.projects.find(p => p.id === library.activeId), w = project.workspace;
  useEffect(() => {
    const current = projectStore.current().workspace;
    const upgraded = upgradeJamSlotLayout(current);
    if (upgraded !== current) projectStore.patch(upgraded);
  }, [projectStore, w]);
  const [audio] = useState(() => createAudioEngine());
  const [effects] = useState(() => createJamEffects(audio));
  const fx = useSyncExternalStore(effects.subscribe, effects.getSnapshot);
  const [status, setStatus] = useState({ mode: 'stopped', loading: false });
  const [playback] = useState(() => createSessionPlayback(audio, setStatus));
  const [editingTrack, setEditingTrack] = useState(null);
  const [solo, setSolo] = useState(false), [message, setMessage] = useState('');
  function retainMixChange({selection,trackId,restoreSound}) {
    const current=projectStore.current().workspace;
    projectStore.patch({selection,...(restoreSound ? {
      mutedTracks:{...current.mutedTracks,[trackId]:false},
      volumes:{...current.volumes,[trackId]:current.volumes[trackId]<=-24?0:current.volumes[trackId]},
    } : {})});
  }
  const [audition] = useState(() => createJamAudition(playback, {
    readWorkspace:() => projectStore.current().workspace, readDraft:() => projectStore.current().workspace.draft, onSoloChange:setSolo,
    onMixChange:retainMixChange,
  }));
  const [heldEdits] = useState(() => createJamHeldEdits({playback,effects,audio,readProject:projectStore.current,onMixChange:retainMixChange}));
  useEffect(() => heldEdits.connect(), [heldEdits]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [page, setPage] = useState(0);
  const [phraseHistory] = useState(() => createJamPhraseHistory((pid,id) => {
    const w=projectStore.getSnapshot().projects.find(p=>p.id===pid)?.workspace;
    return w && TRACKS.flatMap(t=>w.templates[t]).find(p=>p.id===id);
  }));
  useSyncExternalStore(phraseHistory.subscribe,phraseHistory.getSnapshot);
  useEffect(() => {
    projectStore.enableLiveEditing?.();
    phraseHistory.seed(projectStore.takeMigrationHistory?.()??[]);
  }, [projectStore,phraseHistory]);
  const [editBar, setEditBar] = useState(0);
  const launcherNav = useRef(null), pendingReveal = useRef(null);
  useLayoutEffect(() => {
    if (pendingReveal.current === null || !launcherNav.current) return;
    launcherNav.current.revealSlot(pendingReveal.current); pendingReveal.current = null;
  }, [w.templates]);
  const midiControlsRef = useRef(null), midiEditorVersion = useRef(0);
  const midiInput = useJamMidiController({ active, controlsRef: midiControlsRef });
  const { syncFaders: syncMidiFaders, suspendPitch: suspendMidiPitch } = midiInput;
  const artNodes = useRef({}), artPositions = useRef(null), animations = useRef([]);
  const workbench = useRef(null);
  const midiGesture = useRef(null);
  const hasQueued = Boolean(status.queuedPhraseIds);
  // One shared phase drives all queued outlines; no per-pad React updates or timers.
  useEffect(() => {
    if (!active || !hasQueued) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame;
    const animate = () => {
      const phase = status.loading ? (performanceNow() / (60000 / w.bpm)) % 1 : playback.getBeatPhase();
      const level = (1 - Math.cos(phase * Math.PI * 2)) / 2;
      workbench.current?.style.setProperty('--jam-breath', String(level));
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [active, playback, hasQueued, status.loading, w.bpm]);
  useEffect(() => () => clearTimeout(midiGesture.current), []);
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
  const trackPosition = draft && status.trackPositions?.[draft.trackId];
  const editorPosition = trackPosition && (solo ? trackPosition.editorRevision === audition.getRevision()
    : trackPosition.phraseId === draft.editingTemplateId) ? trackPosition : null;
  const editorPlaying = Boolean(draft && audition.isPlaying());
  const editorQueued = Boolean(draft && status.mode !== 'stopped' && status.queuedPhraseIds?.[draft.trackId] === draft.editingTemplateId);
  const history = phraseHistory.get(project.id,draft?.editingTemplateId);
  const sourceGenre = project.genreId ?? genreId, sourceProfile = project.profileId ?? profileId;
  const catalog = performanceTemplates(sourceGenre, sourceProfile);
  const columnCount = jamLauncherColumnCount(w.templates);
  const pageCount = columnCount / 8;
  const effectivePage = Math.min(page, pageCount - 1);
  const templates = Object.fromEntries(TRACKS.map(t => [t, jamTemplatePage(w.templates[t], effectivePage)]));
  const instrumentTimbre = t => w.timbres?.[t] ?? w.templates[t].find(p => p.id === w.selection[t])?.timbreId ?? w.draftsByTrack?.[t]?.timbreId ?? defaultJamTimbres()[t];
  function sourceDraft(t, sourceId, timbreId) {
    const timbre = timbreId ?? instrumentTimbre(t);
    if (t === 'drums') {
      const p = getDialDrumPreset(50,50);
      return { trackId: t, name: '', timbreId: timbre, params: { strength: 50, groove: 50 }, sourcePresetId: p.id, bars: copy(p.bars) };
    }
    const imported = DIAL_PITCHED_PRESETS.find(p => p.trackId === t && p.id === sourceId);
    if (imported) return { trackId: t, name: '', timbreId: timbre, params: { strength: imported.strength, groove: imported.groove }, sourcePresetId: imported.id, bars: copy(imported.bars) };
    const source = catalog[t].find(p => p.id === sourceId) ?? catalog[t][0];
    const snap = snapshotSection({ id: 'source', kind: 'main', selection: { ...emptySelection(), [t]: source.id }, timbres: { ...defaultJamTimbres(), [t]: timbre } }, sourceGenre, sourceProfile);
    return { trackId: t, name: '', timbreId: timbre, params: jamTrackParameters(undefined, t), sourcePresetId: source.id, bars: copy(snap.matrix[t].slice(0, snap.phraseBars[t])) };
  }
  function launch(quantize = 'bar', override = draft, overrideSolo = solo) {
    const snapshot = jamCombinationSnapshot(projectStore.current().workspace, override, overrideSolo);
    if (!snapshot) { playback.stop(); return; }
    if (overrideSolo) { playback.audition(snapshot, projectStore.current().workspace.bpm); return; }
    playback.launch(snapshot, projectStore.current().workspace.bpm, { edit: true, quantize, preservePhase: true });
  }
  function syncPhraseAudio(phrase, restart = false, knob = false) {
    if (knob && heldEdits.defer(phrase,{canJoin:audition.canJoin()})) {
      audition.update({...phrase,editingTemplateId:phrase.id},{updateAudio:false}); return;
    }
    heldEdits.cancel(phrase.trackId,phrase.id);
    if (audition.getMode() === 'mix' && audition.getPhraseId() === phrase.id) {
      audition.update({...phrase,editingTemplateId:phrase.id},{restart,preserveEffects:knob}); return;
    }
    const snapshot=jamCombinationSnapshot(projectStore.current().workspace,phrase,true);
    if (!hasJamNotes(phrase)) snapshot.phraseIds[phrase.trackId]=null;
    playback.updatePhrase?.(snapshot,phrase.trackId,phrase.id,{preserveEffects:knob});
    audition.update({...phrase,editingTemplateId:phrase.id},{restart,preserveEffects:knob});
  }
  function replaceDraft(next, { record = true, updateAudio = true, restart = false, gesture = false, knob = false } = {}) {
    if (record && !gesture) { clearTimeout(midiGesture.current); endGesture(); }
    const current=projectStore.current().workspace;
    const id=next.editingTemplateId??next.id??draft?.editingTemplateId;
    const before=current.templates[next.trackId]?.find(p=>p.id===id);
    if (!before || !projectStore.commitPhraseEdit) return;
    const phrase=projectStore.commitPhraseEdit({...next,editingTemplateId:id},{projectId:project.id});
    if (!phrase) { setMessage('乐句未能更新，请重新打开该格子。'); return; }
    if (record) phraseHistory.record(project.id,before,phrase);
    if (updateAudio && (restart || before.timbreId!==phrase.timbreId || JSON.stringify(before.bars)!==JSON.stringify(phrase.bars))) {
      void audio.startAudio();syncPhraseAudio(phrase,restart,knob);
    }
  }
  function openEditor(t, template = null, options = {}, targetSlot = null) {
    clearTimeout(midiGesture.current); endGesture();
    const current=projectStore.current().workspace;
    let phrase=template && current.templates[t].find(p=>p.id===template.id);
    if (targetSlot!==null) phrase=current.templates[t].find(p=>p.slotIndex===targetSlot);
    if (!phrase && targetSlot===null && !template) {
      const last=current.draftsByTrack?.[t]?.editingTemplateId;
      phrase=current.templates[t].find(p=>p.id===last);
    }
    if (!phrase) {
      phrase=projectStore.commitPhraseEdit?.(blankJamDraft(t,instrumentTimbre(t),targetSlot??undefined),{create:true,projectId:project.id});
      if (!phrase) { setMessage('乐句未能创建，请重试。'); return; }
      pendingReveal.current=phrase.slotIndex;
    } else projectStore.setDraft({...copy(phrase),params:jamTrackParameters(phrase.params,t),editingTemplateId:phrase.id,dirty:false});
    midiInput.reset(); midiEditorVersion.current += 1;
    if (!editingTrack) captureArt();
    setEditingTrack(t);setMessage('');setEditBar(0);
    if (options?.followPlayback) {
      audition.follow({...phrase,editingTemplateId:phrase.id});
      return;
    }
    void audio.startAudio();
    audition.open({...phrase,editingTemplateId:phrase.id},{mode:'mix',autoStart:true});
  }
  function finishEditor() {
    clearTimeout(midiGesture.current);endGesture();
    midiInput.reset(); midiEditorVersion.current += 1;
    audition.release();captureArt();setEditingTrack(null);setSolo(false);
  }
  function removePhrase(phrase) {
    clearTimeout(midiGesture.current);endGesture();
    heldEdits.cancel(phrase.trackId,phrase.id);
    deleteJamTemplate({projectStore,playback,audition,trackId:phrase.trackId,templateId:phrase.id});
    if (projectStore.current().workspace.templates[phrase.trackId].some(p=>p.id===phrase.id)) return;
    phraseHistory.forget(project.id,phrase.id);
    if (draft?.editingTemplateId===phrase.id) {
      midiInput.reset();midiEditorVersion.current++;captureArt();setEditingTrack(null);setSolo(false);setEditBar(0);
    }
    setDeleteTarget(null);
  }
  function changeParameter(parameter, value, record = false, fromMidi = false) {
    const current = projectStore.current().workspace.draft;
    if (!editingTrack || current?.trackId !== editingTrack || !['strength','groove'].includes(parameter)) return;
    if (!fromMidi) midiInput.useSoftwareValue(jamTrackKnobs(editingTrack).find(knob => knob.parameter === parameter).hardwareParameter);
    const next = applyJamTrackParameter(current, parameter, value);
    if (next === current) return;
    if (record) {
      beginGesture('midi'); clearTimeout(midiGesture.current);
      midiGesture.current = setTimeout(endGesture, 300);
    }
    replaceDraft(next, {gesture:true,knob:true});
  }

  function beginGesture(kind='knob') {
    if (kind!=='midi') clearTimeout(midiGesture.current);
    const current=projectStore.current().workspace.draft;
    if (current) phraseHistory.begin(project.id,current,kind);
  }
  function endGesture() { phraseHistory.end(); }
  function undo(redo = false) {
    midiInput.useSoftwareValue();clearTimeout(midiGesture.current);
    const current=projectStore.current().workspace.draft;
    if (!current || current.trackId!==editingTrack) return;
    const next=phraseHistory.take(project.id,current,redo);
    if (next) replaceDraft(next,{record:false});
  }
  function trigger(t, id) {
    heldEdits.cancel(t);
    const follow = Boolean(editingTrack);
    if (follow) { clearTimeout(midiGesture.current); endGesture(); }
    const triggered = toggleJamTemplate({projectStore,playback,audition,trackId:t,templateId:id});
    if (triggered && follow) openEditor(t,{id},{followPlayback:true});
  }
  function launchColumn(columnIndex) {
    heldEdits.clear(true);
    launchJamColumn({ projectStore, playback, audition, slotIndex: columnIndex, toggle: true });
  }
  function moveSlots(move, expected) {
    if (!projectStore.moveSlots) {
      setMessage('排序功能已更新，请刷新页面后使用，当前内容已保留。'); return false;
    }
    if (!projectStore.moveSlots(move, { ...expected, projectId: project.id })) {
      setMessage('位置未保存，请重新拖动或检查浏览器存储。'); return false;
    }
    setMessage(`已移动到第 ${move.to+1} ${move.trackId ? '格' : '列'}。`);
    return true;
  }
  function toggleMute(t) {
    heldEdits.cancel(t);
    if (audition.getMode() === 'mix') audition.holdMix(t);
    else if (audition.getTrack() === t) audition.pause();
    const current = projectStore.current().workspace;
    projectStore.patch({mutedTracks:{...current.mutedTracks,[t]:!current.mutedTracks[t]},volumes:{...current.volumes,[t]:current.volumes[t] <= -24 ? 0 : current.volumes[t]}});
  }
  function togglePlayback() {
    void audio.startAudio();
    if (draft) { audition.toggleEditor(projectStore.current().workspace.draft); return; }
    if (running) { audition.stop(); effects.reset(); }
    else if (TRACKS.some(t => w.selection[t])) launch('step',null,false);
  }
  function changeInstrumentTimbre(t, timbreId) {
    heldEdits.cancel(t);
    projectStore.setTimbre(t,timbreId);
    if (draft && audition.getTrack()) audition.update(projectStore.current().workspace.draft);
    else if (playback.isActive()) launch('step',null,false);
  }
  function changeMix(track, value) {
    const targets = effects.getSnapshot().selectedTracks;
    const current = projectStore.current().workspace;
    projectStore.patch({ volumes: { ...current.volumes, ...Object.fromEntries(targets.map(t => [t,value])) }, mutedTracks: { ...current.mutedTracks, ...Object.fromEntries(targets.map(t => [t,false])) } });
    targets.forEach(t => effects.volume(t,value));
  }
  function openProject(id) {
    if (!projectStore.save()) return false;
    clearTimeout(midiGesture.current);
    midiInput.reset(); midiEditorVersion.current += 1;
    endGesture();
    if (!(id ? projectStore.switchTo(id) : projectStore.create())) return false;
    audition.stop(); effects.reset(true); setEditingTrack(null); setSolo(false); setPage(0); pendingReveal.current = null; setMessage(''); return true;
  }
  useEffect(() => () => { playback.stop(); effects.resetHolds(); }, [effects, playback]);
  useEffect(() => {
    const t = solo ? audition.getTrack() : null;
    effects.syncMix(t ? {...w.volumes,[t]:w.mutedTracks[t] || w.volumes[t] <= -24 ? 0 : w.volumes[t]} : w.volumes,
      t ? {...w.mutedTracks,[t]:false} : w.mutedTracks);
  }, [effects,w.volumes,w.mutedTracks,solo,audition]);
  useEffect(() => { if (status.error) audition.pause({stop:false}); }, [status.error,audition]);
  useEffect(() => {
    if (!active) { audition.stop(); clearTimeout(midiGesture.current); }
    if (!active || !running || status.loading) { effects.resetHolds(); suspendMidiPitch(); }
    syncMidiFaders();
    const release = () => effects.resetHolds();
    window.addEventListener('blur',release); return () => window.removeEventListener('blur',release);
  }, [active,running,status.loading,effects,audition,syncMidiFaders,suspendMidiPitch]);
  useEffect(() => {
    if (!active) return;
    const handler = e => {
      if (e.target.closest?.('input,select,textarea,[contenteditable],dialog,[role=dialog],[popover]:popover-open')) return;
      if (editingTrack && (e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); undo(e.shiftKey); return; }
      if (e.key === 'Escape') { e.preventDefault(); if (draft) audition.pause(); else audition.stop(); return; }
      if (draft && e.code === 'Space' && !e.repeat && e.target.closest?.('.pitch-step-cell,.drum-step')) { e.preventDefault(); togglePlayback(); return; }
      if (e.target.closest?.('button,[role=slider]')) return;
      const cmd = mapPerformanceKeyboard(e,templates);
      if (cmd) { e.preventDefault(); trigger(cmd.trackId,cmd.templateId); }
      else if (e.code === 'Space' && !e.repeat) { e.preventDefault(); togglePlayback(); }
    };
    window.addEventListener('keydown',handler); return () => window.removeEventListener('keydown',handler);
  });
  useLayoutEffect(() => {
    if (!active) return;
    const controls = { templates,
      dispatch(cmd) {
        const track = effects.getSnapshot().selectedTrack;
        if (cmd.type === 'template') trigger(cmd.trackId,cmd.templateId);
        if (cmd.type === 'editPhrase' && !deleteTarget && TRACKS.includes(cmd.trackId) && Number.isSafeInteger(cmd.slotIndex) && cmd.slotIndex >= 0) openEditor(cmd.trackId,null,false,cmd.slotIndex);
        if (cmd.type === 'launchColumn') launchColumn(cmd.slotIndex);
        if (cmd.type === 'togglePlayback') togglePlayback();
        if (cmd.type === 'stop') { if (draft) audition.pause(); else audition.stop(); effects.reset(); }
        if (cmd.type === 'page') launcherNav.current?.showBank(Math.max(0,Math.min(pageCount-1,effectivePage+cmd.delta)));
        if (cmd.type === 'selectTrack') effects.select(cmd.trackId,cmd.additive);
        if (cmd.type === 'toggleTrack') effects.toggleTrack(cmd.trackId);
        if (cmd.type === 'volume') changeMix(track,cmd.value);
        if (cmd.type === 'cutoff') effects.getSnapshot().selectedTracks.forEach(t => effects.cutoff(t,cmd.value));
        if (cmd.type === 'reverb') effects.reverb(cmd.value);
        if (cmd.type === 'trackParameter' || cmd.type === 'drumParameter') {
          if ((cmd.type !== 'drumParameter' || editingTrack === 'drums') && (!cmd.trackId || cmd.trackId === editingTrack)) changeParameter(cmd.parameter,cmd.value,true,cmd.source === 'midi');
        }
        if (['pitch','chopper','brake'].includes(cmd.type)) {
          if (!cmd.pressed) effects.release(cmd.type,cmd.token); else if (playback.isReady()) effects.press(cmd.type,cmd.token,cmd.value,w.bpm);
        }
        if (cmd.type === 'repeat') { if (!cmd.pressed) effects.repeat.release(cmd.token); else if (playback.isReady()) effects.repeat.press(cmd.token,cmd.division,w.bpm); }
      },
      release: () => effects.resetHolds(),
      getMidiContext: () => {
        const current = projectStore.current(), snapshot = effects.getSnapshot(), t = snapshot.selectedTrack;
        return { projectId: current.id, editorVersion: midiEditorVersion.current, editingTrack,
          blocked: Boolean(deleteTarget), playing: playback.isReady() && !status.loading,
          selectedTrack: t, selectedTracks: snapshot.selectedTracks,
          params: jamTrackParameters(current.workspace.draft?.params, editingTrack),
          parameterLevels: Object.fromEntries(['strength','groove'].map(p => [p,jamParameterLevels(editingTrack,p)])),
          values: {volume:snapshot.volumes[t],cutoff:snapshot.cutoffs[t],reverb:snapshot.reverbs[t],pitch:snapshot.pitches[t]} };
      },
      getSurface: () => ({ ...effects.getSnapshot(), version: 5, templates, selection: w.selection, auditioning: solo,
        page: effectivePage, pageCount, sections: [], status: solo && draft && !editorPlaying ? {...status,mode:'stopped'} : status, beatPhase: playback.getBeatPhase(),
        repeat: effects.getSnapshot().repeats[effects.getSnapshot().selectedTrack], manualSave:false, canSave:false, canPlayEditor:Boolean(draft && hasJamNotes(draft)), storageError: Boolean(library.error) }),
    };
    midiControlsRef.current = controls;
    if (controlsRef) controlsRef.current = controls;
    return () => {
      if (midiControlsRef.current === controls) midiControlsRef.current = null;
      if (controlsRef?.current === controls) controlsRef.current = null;
    };
  });
  const previewBar = Math.min(editBar,(draft?.bars.length ?? 1)-1);
  return <section className="performance-mode jam-workspace template-jam jam-studio" hidden={!active} aria-label="Jam 演奏" data-editing={Boolean(draft)}>
    <header className="performance-header">
      {createElement(ThemeSwitcher)}
      {onHome && <button type="button" className="performance-home" aria-label="返回首页" onClick={() => { if (projectStore.save()) {audition.stop(); onHome();} }}><Home size={16}/></button>}
      <button type="button" className="performance-connect" onClick={() => { if (projectStore.save()) {audition.stop(); onBack();} }}>← 创作模式</button>
      <div className="performance-title"><span className="performance-eyebrow">PROJECT ARRANGER</span><h1>Jam · 演奏</h1></div>
      <label className="performance-tempo">BPM <input type="number" min="40" max="240" aria-label="演奏速度 BPM" value={w.bpm} onChange={e => { const value=Math.max(40,Math.min(240,Math.round(Number(e.target.value)||100))); projectStore.patch({bpm:value}); playback.setTempo(value); }}/></label>
      <button type="button" className="performance-connect" title="推子：收到初始值即同步音量、滤波、混响、弯音；两颗旋钮与当前编辑器左右顺序一致，转动直接接管，无需复位。" onClick={() => { void audio.startAudio(); void hardwareInput?.onConnect(); void midiInput.connect(); }}>{midiInput.status === 'connecting' ? '正在连接…' : <>{[hardwareInput?.status === 'connected' && 'Launchpad',midiInput.status === 'connected' && '旋钮推子'].filter(Boolean).join(' · ') || '连接控制器'}{hardwareInput?.status === 'connected' || midiInput.status === 'connected' ? ' 已连接' : ''}</>}</button>
    </header>
    <JamProjectControls project={project} projects={library.projects}
      onNew={() => openProject(null)} onOpen={openProject} onRename={projectStore.rename}/>
    <div ref={workbench} className="template-jam-workbench studio-workbench">
      <main className="studio-main" aria-label="乐句工作台">
        <JamLauncher key={project.id} active={active} playback={playback} templates={w.templates} columnCount={columnCount} bank={effectivePage} onBankChange={setPage} navigationRef={launcherNav}
          editingTrack={editingTrack} editingTemplateId={draft?.editingTemplateId} auditioning={solo} selection={w.selection} status={status} mutedTracks={w.mutedTracks} volumes={w.volumes}
          timbres={Object.fromEntries(TRACKS.map(t => [t,instrumentTimbre(t)]))} timbreLabel={timbreLabel} artSources={ART} artNodes={artNodes}
          onOpenEditor={openEditor} onTimbreChange={changeInstrumentTimbre} onToggleMute={toggleMute} onTrigger={trigger} onLaunchColumn={launchColumn} onRemove={phrase => hasJamNotes(phrase)?setDeleteTarget(phrase):removePhrase(phrase)} onMove={moveSlots}/>
        {draft && <section className="studio-editor" key={editingTrack} data-track={editingTrack} aria-label={`${LABELS[editingTrack]}乐句编辑`}>
          <header className="studio-editor-heading"><div className="studio-editor-identity"><label className="studio-template-name-field">名称<input aria-label="乐句名称" value={draft.name ?? ''} placeholder={`${LABELS[editingTrack]}新乐句`} maxLength={80} onFocus={() => beginGesture('name')} onBlur={endGesture} onChange={e => { beginGesture('name');replaceDraft({...draft,name:e.target.value},{updateAudio:false,gesture:true}); }}/></label></div>
            <div className="studio-editor-heading-actions">
              <button type="button" className="studio-text-button" onClick={finishEditor}><ArrowLeft size={13}/> 收起编辑</button></div></header>
          <div className="studio-editor-controls">
            {editingTrack !== 'drums' && <div className="studio-phrase-settings"><label>音型<select aria-label={`${LABELS[editingTrack]}乐句起点`} value={draft.sourcePresetId} onChange={e => { const next = e.target.value === 'blank' ? blankJamDraft(editingTrack,draft.timbreId,draft.targetSlot) : sourceDraft(editingTrack,e.target.value,draft.timbreId); midiInput.useSoftwareValue(); replaceDraft({...next,name:draft.name,editingTemplateId:draft.editingTemplateId,targetSlot:draft.targetSlot},{restart:true}); setEditBar(0); }}><option value="blank">空白乐句</option><optgroup label="旋钮模板 · Ableton">{DIAL_PITCHED_PRESETS.filter(p => p.trackId === editingTrack).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup><optgroup label="原有模板">{catalog[editingTrack].map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup></select></label></div>}
            <div className="studio-editor-knobs">{jamTrackKnobs(editingTrack).map(({parameter,hardwareParameter,label,lowLabel,highLabel}) => {
              const position = midiInput.knobPositions[hardwareParameter], value = draft.params?.[parameter] ?? 50;
              return <RotaryKnob key={parameter} label={label} value={value} displayValue={position?.display ? position.percent : value}
                valueDescription={position?.display ? `硬件位置 ${position.percent}%；当前乐句${label} ${value}%` : `${label} ${value}%`}
                showValue={false} format={v => `${v}%`} step={parameter === 'groove' && editingTrack === 'chord' ? 20 : 25}
                ticks={jamParameterLevels(editingTrack,parameter).map(v => ({value:v,label:v}))} spectrum showTicks={false}
                lowLabel={lowLabel} highLabel={highLabel}
                onBegin={() => { midiInput.useSoftwareValue(hardwareParameter); beginGesture(); }} onEnd={endGesture} onChange={v => changeParameter(parameter,v)}/>;
            })}</div>
          </div>
          <div className="studio-grid-toolbar"><span>{editingTrack === 'drums' ? '鼓点音序器' : `${LABELS[editingTrack]}音序器`}<small className="studio-editor-position" aria-label="编辑播放位置">{editorPlaying && editorPosition ? ` · 播放 ${editorPosition.bar+1}/${draft.bars.length}` : editorPlaying || editorQueued ? ' · 准备播放' : hasJamNotes(draft) ? ' · 已暂停' : ' · 空白'}</small></span><div className="studio-bar-pager"><button type="button" aria-label="上一小节" disabled={previewBar === 0} onClick={() => setEditBar(previewBar-1)}><ChevronLeft size={13}/></button><span>{previewBar+1} / {draft.bars.length} 小节</span><button type="button" aria-label="下一小节" disabled={previewBar+1 === draft.bars.length} onClick={() => setEditBar(previewBar+1)}><ChevronRight size={13}/></button></div><div className="studio-undo"><button type="button" aria-label="撤销模板修改" disabled={!history.undo.length} onClick={() => undo()}><Undo2 size={14}/></button><button type="button" aria-label="重做模板修改" disabled={!history.redo.length} onClick={() => undo(true)}><Redo2 size={14}/></button></div></div>
          {editingTrack === 'drums' ? <div className="studio-drum-grid"><DrumStepGrid renderStep={(row,stepNumber) => {
            const step=stepNumber-1,cell=draft.bars[previewBar][step],hits=cell?.drumHits?.filter(h => h.instrument === row.id) ?? [];
            const on=getDrumsCellInstruments(cell).includes(row.id);
            const label={kick:'底鼓',snare:'军鼓',hihat:'踩镲'}[row.id];
            return <button type="button" key={`${row.id}:${step}`} className={`drum-step ${on ? 'active' : ''} ${stepNumber%4 === 0 ? 'beat-end' : ''}`}
              data-instrument={row.id} data-step={step} data-playing={editorPlaying && editorPosition?.bar === previewBar && editorPosition?.step === step} aria-label={`${label}第${step+1}格`} aria-pressed={on}
              onClick={() => { const bars=copy(draft.bars); bars[previewBar][step]=toggleDrumsCellInstrument(cell,row.id); replaceDraft({...draft,bars}); }}>
              {hits.length > 1 && <span className="studio-hit-count" aria-label={`${hits.length}次击打`}>{hits.length}</span>}
            </button>;
          }}/></div> : <JamChordEditor key={draft.editingTemplateId ?? draft.targetSlot ?? 'draft'} draft={draft} bar={previewBar} step={editorPlaying && editorPosition?.bar === previewBar ? editorPosition?.step : null} onChange={replaceDraft}/>}
        </section>}
      </main>
      <aside id="jam-studio-effects" className="jam-effects studio-effects" data-track={fx.selectedTrack}><header className="studio-effects-heading"><h2>现场效果</h2><button type="button" className="studio-text-button" title="恢复四轨的平衡音量，再用推子微调" onClick={() => { if(projectStore.patch({volumes:Object.fromEntries(TRACKS.map(t=>[t,0]))})) setMessage('四轨音量已平衡。'); }}>平衡四轨</button></header><div className="effect-targets" role="group" aria-label="效果目标轨道">{TRACKS.map(t => <button type="button" key={t} aria-pressed={fx.selectedTracks.includes(t)} onClick={() => effects.toggleTrack(t)}>{LABELS[t]}</button>)}</div>
        <JamPerformanceDeck key={project.id} effects={effects} session={w} enabled={active && running && !status.loading} hardwarePitch={midiInput.faderPositions.pitch?.value} changeMix={changeMix}/>
      </aside>
    </div>
    {(library.error || status.error || midiInput.errorMessage || message) && <footer className="template-jam-transport studio-transport"><span role="status">{library.error || status.error || midiInput.errorMessage || message}</span>{library.error && <button type="button" onClick={() => { if (projectStore.save()) setMessage(''); }}>重试</button>}</footer>}
    {deleteTarget && <TemplateDialog titleId="delete-template-title" onClose={() => setDeleteTarget(null)}><h2 id="delete-template-title">删除「{deleteTarget.name}」？</h2><p>该轨后面的乐句会依次补位，已放入创作时间线的乐句会保留。</p><button type="button" onClick={() => removePhrase(deleteTarget)}>删除</button><button type="button" onClick={() => setDeleteTarget(null)}>取消</button></TemplateDialog>}
  </section>;
}
