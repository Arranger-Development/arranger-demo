import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Home } from 'lucide-react';
import { renderIcon } from './icons.js';
import { ThemeSwitcher } from './ThemeSwitcher.jsx';
import createAudioEngine from '../../audio/createAudioEngine.js';
import { PERFORMANCE_LABELS as LABELS, performanceTemplates, hasSelection, normalizePerformanceBpm } from '../performanceModel.js';
import { fixedPerformancePads, replacePadBinding, createSessionEditor, snapshotSection, createExportEntry, createArrangementImport, arrangementExportLength } from '../performanceSession.js';
import { createSessionPlayback } from '../sessionPlayback.js';
import { mapPerformanceKeyboard } from '../../input/performanceInput.js';
import { loopRepeat } from '../loopOrder.js';
import { createJamEffectAutomation } from '../jamEffectAutomation.js';
import { createJamEffects } from '../jamEffects.js';
import { bindJamBlankClick, returnToNewCombination } from '../jamBlankClick.js';
import JamPerformanceDeck from './JamPerformanceDeck.jsx';
import { createJamArpeggiator } from '../jamArpeggiator.js';
import JamView from './JamView.jsx';
import JamProjectControls from './JamProjectControls.jsx';
import { createJamProjects } from '../jamProjects.js';
import JamExportDialog from './JamExportDialog.jsx';
import './performance.css';
import './jamView.css';
import './jamWorkspace.css';

void [JamView, JamExportDialog, JamPerformanceDeck, JamProjectControls];
const storage = () => { try { return window.localStorage; } catch { return null; } };

export default function PerformanceMode({ active, genreId, profileId = null, initialBpm, recommendation, onBack, onHome, onImport, controlsRef, hardwareInput }) {
  const [projectStore] = useState(() => createJamProjects(storage(), genreId, profileId, initialBpm, recommendation));
  const projectLibrary = useSyncExternalStore(projectStore.subscribe, projectStore.getSnapshot);
  const currentProject = projectLibrary.projects.find(p => p.id === projectLibrary.activeId);
  const [editor] = useState(() => {
    const instance = createSessionEditor(projectStore.current().workspace.session, { catalog: performanceTemplates(genreId, profileId) });
    instance.restore(projectStore.current().workspace); return instance;
  });
  const { session, drafts, editingId } = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const [audio] = useState(() => createAudioEngine());
  const [effects] = useState(() => createJamEffects(audio));
  const { selectedTrack, selectedTracks } = useSyncExternalStore(effects.subscribe, effects.getSnapshot);
  const [arp] = useState(() => {
    const instance = createJamArpeggiator(audio);
    instance.configure(0, projectStore.current().arpNotes?.join(' ') ?? ''); return instance;
  });
  useEffect(() => { audio.setJamArpeggiator(arp); return () => { arp.stop(); audio.setJamArpeggiator(null); }; }, [audio, arp]);
  const [status, setStatus] = useState({ mode: 'stopped', loading: false, playingId: null, pendingId: null });
  const [automation] = useState(() => createJamEffectAutomation(audio, effects, (id, effectAutomation) => editor.edit({ effectAutomation }, id)));
  const recording = useSyncExternalStore(automation.subscribe, automation.getSnapshot);
  const recordingLocked = recording.phase !== 'idle';
  const [playback] = useState(() => createSessionPlayback(audio, setStatus, automation));
  const [message, setMessage] = useState('');
  const [savedAt, setSavedAt] = useState(-Infinity);
  const [exportEntries, setExportEntries] = useState(null);
  const [counts, setCounts] = useState({});
  const [requestedPage, setPage] = useState(0);
  const page = Math.min(requestedPage, Math.max(0, Math.ceil(session.sections.length / 8) - 1));
  const inputActive = active && !exportEntries;
  const workspaceRef = useRef(null);
  useEffect(() => bindJamBlankClick(workspaceRef.current, {
    isEnabled: () => inputActive && !playback.isActive(),
    onClick: () => returnToNewCombination(editor, playback),
  }), [editor, playback, inputActive]);
  const locked = status.mode !== 'stopped';
  const draft = drafts[editingId];
  const catalog = useMemo(() => performanceTemplates(genreId, profileId), [genreId, profileId]);
  const templates = useMemo(() => fixedPerformancePads(catalog, session.pads), [catalog, session.pads]);
  const persist = () => { if (!projectStore.save(editor.getSnapshot(), arp.getSnapshot().presets[0])) setMessage('项目保存失败，当前内容已保留，请重试。'); };
  const patch = (value) => { editor.patch(value); persist(); };
  const jamSnapshot = (section) => {
    const value = snapshotSection(section, genreId, profileId);
    const saved = editor.getSnapshot().session.sections.find(s => s.id === section.id);
    return value && { ...value, repeat: loopRepeat(saved ?? { kind: section.kind }), effectAutomation: section.effectAutomation, phraseIds: { ...section.selection } };
  };
  const launchDraft = (edit = false) => {
    setMessage('');
    const current = editor.getSnapshot(); const next = jamSnapshot(current.drafts[current.editingId]);
    if (next) playback.launch(next, current.session.bpm, { edit, returnAfterTransition: false }); else if (playback.isActive()) playback.stop();
  };
  function replacePad(track, index, templateId) {
    if (automation.isRecording()) return;
    const current = editor.getSnapshot().session;
    const next = replacePadBinding(current, catalog, track, index, templateId);
    if (next !== current) patch({ pads: next.pads });
  }
  function triggerPad(track, index) {
    if (automation.isRecording()) return;
    const current = editor.getSnapshot();
    const phrase = fixedPerformancePads(catalog, current.session.pads)[track][index];
    if (!phrase) return;
    const selection = { ...current.drafts[current.editingId].selection };
    selection[track] = selection[track] === phrase.id ? null : phrase.id;
    editor.edit({ selection }); launchDraft(true);
  }
  function selectSection(id) {
    if (automation.isRecording()) return;
    if (!editor.getSnapshot().drafts[id]) return;
    const current = editor.getSnapshot();
    const snapshot = jamSnapshot(current.drafts[id]);
    if (!playback.isActive() || !snapshot) editor.select(id);
    playback.launch(snapshot, current.session.bpm);
  }
  function toggleSequence() {
    if (playback.isActive()) { effects.reset(); playback.stop(); return; }
    const current = editor.getSnapshot();
    const snapshots = current.session.sections.map(s => jamSnapshot(current.drafts[s.id]));
    setMessage(playback.sequence(snapshots, current.session.bpm) ? '' : '没有可播放的 Loop');
  }
  function save() {
    if (automation.isRecording()) return;
    if (!hasSelection(editor.getSnapshot().drafts[editor.getSnapshot().editingId].selection)) return;
    if (!editor.save((next, snapshot) => projectStore.save(snapshot, arp.getSnapshot().presets[0]))) {
      setMessage('保存失败，当前组合已保留，请重试。'); return;
    }
    effects.reset(); playback.stop(); setSavedAt(performance.now()); setMessage('已保存，可继续组合下一个 loop。');
  }
  function saveProject() {
    if (automation.isRecording()) return;
    setMessage(projectStore.save(editor.getSnapshot(), arp.getSnapshot().presets[0]) ? '项目已保存，包含当前草稿。' : '项目保存失败，当前内容已保留，请重试。');
  }
  function openProject(id) {
    if (automation.isRecording()) return false;
    const ok = id ? projectStore.switchTo(id, editor.getSnapshot(), arp.getSnapshot().presets[0])
      : projectStore.create(editor.getSnapshot(), arp.getSnapshot().presets[0]);
    if (!ok) { setMessage('项目保存失败，已留在当前项目，请重试。'); return false; }
    resetPlayback(); arp.stop();
    const next = projectStore.current();
    editor.restore(next.workspace); arp.configure(0, next.arpNotes?.join(' ') ?? '');
    setPage(0); setExportEntries(null); setCounts({}); setSavedAt(-Infinity); setMessage(id ? `已打开「${next.name}」` : `已新建「${next.name}」，原项目已保留。`);
    return true;
  }
  function renameProject(name) {
    const ok = projectStore.rename(name);
    setMessage(ok ? '项目已重命名。' : '重命名失败，请填写名称或检查浏览器存储。'); return ok;
  }
  function changeMix(track, volume) {
    const current = editor.getSnapshot().session;
    const tracks = effects.getSnapshot().selectedTracks;
    if (!tracks.length) return;
    patch({ volumes: { ...current.volumes, ...Object.fromEntries(tracks.map(t=>[t,volume])) }, mutedTracks: { ...current.mutedTracks, ...Object.fromEntries(tracks.map(t=>[t,false])) } });
    tracks.forEach(t=>effects.volume(t,volume));
  }
  function changeEffectPage(page) { if (effects.getSnapshot().effectPage === 'arp' && page !== 'arp') arp.stop(); effects.setPage(page); }
  function pressArp(token, index) {
    if (!playback.isReady() || automation.isRecording()) return;
    const current = editor.getSnapshot();
    void arp.press(token,index,current.drafts[current.editingId].timbres.melody);
  }
  function toggleRecording() {
    if (automation.isRecording()) playback.cancelRecording();
    else { arp.stop(); const current=editor.getSnapshot(); playback.record(jamSnapshot(current.drafts[current.editingId]),current.session.bpm); }
  }
  function updateTimbre(track, value) {
    if (automation.isRecording()) return;
    arp.stop();
    editor.edit({ timbres: { ...editor.getSnapshot().drafts[editingId].timbres, [track]: value } });
    if (locked) launchDraft(true);
  }
  function resetPlayback() { effects.reset(true); playback.stop(); }
  function changeBpm(value) { if (automation.isRecording()) return; const bpm = normalizePerformanceBpm(value); patch({ bpm }); playback.setTempo(bpm); }
  function connectHardware() { void audio.startAudio(); void hardwareInput?.onConnect(); }
  function openExport() {
    if (automation.isRecording()) return;
    resetPlayback(); setMessage(''); setCounts({});
    setExportEntries(session.sections.map(s => createExportEntry(s, genreId, profileId)));
  }
  useEffect(() => {
    if (status.playingId && editor.getSnapshot().drafts[status.playingId]) editor.select(status.playingId);
  }, [editor, status.playingId]);
  useEffect(() => { projectStore.initialize(); }, [projectStore]);
  useEffect(() => effects.syncMix(session.volumes, session.mutedTracks), [effects, session.volumes, session.mutedTracks]);
  useEffect(() => {
    const release = () => { arp.stop(); if (automation.isRecording()) playback.cancelRecording(); automation.suspend(); };
    window.addEventListener('blur', release);
    return () => { window.removeEventListener('blur', release); playback.stop(); effects.reset(true); };
  }, [active, effects, playback, automation, arp]);
  useEffect(() => { if (!inputActive || !locked || status.loading) effects.reset(); }, [effects, inputActive, locked, status.loading]);
  useEffect(() => { arp.stop(); automation.releaseRepeats(); }, [automation, arp, hardwareInput?.status]);
  useEffect(() => {
    if (!inputActive) return undefined;
    const key = (e) => {
      if (e.defaultPrevented) return;
      const cmd = mapPerformanceKeyboard(e, templates);
      if (cmd) { e.preventDefault(); triggerPad(cmd.trackId, templates[cmd.trackId].findIndex((p) => p?.id === cmd.templateId)); }
      else if (e.key === ' ' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest?.('input,select,textarea,button,[role=slider],[contenteditable],[popover]:popover-open')) { e.preventDefault(); toggleSequence(); }
      else if (e.key === 'Escape' && !e.target.closest?.('input,select,textarea,[contenteditable], [popover]:popover-open')) { e.preventDefault(); playback.stop(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  useLayoutEffect(() => {
    if (!controlsRef || !inputActive) return undefined;
    const controls = {
      templates,
      dispatch(command) {
        if (command.type === 'template') triggerPad(command.trackId, templates[command.trackId].findIndex((p) => p?.id === command.templateId));
        if (command.type === 'loop') { const s = session.sections[page * 8 + command.index]; if (s) selectSection(s.id); }
        if (command.type === 'save') save();
        if (command.type === 'togglePlayback') toggleSequence();
        if (command.type === 'stop') { effects.reset(); playback.stop(); }
        const track = effects.getSnapshot().selectedTrack;
        if (command.type === 'selectTrack') effects.select(command.trackId, command.additive);
        if (command.type === 'volume') changeMix(track, command.value);
        if (command.type === 'cutoff') effects.getSnapshot().selectedTracks.forEach(t=>effects.cutoff(t, command.value));
        if (command.type === 'effectPage') changeEffectPage(command.page);
        if (command.type === 'recordEffects') toggleRecording();
        if (command.type === 'reverb') effects.reverb(command.value);
        if (['pitch','chopper','brake'].includes(command.type)) {
          if (!command.pressed) effects.release(command.type,command.token);
          else if (playback.isReady()) effects.press(command.type,command.token,command.value,editor.getSnapshot().session.bpm);
        }
        if (command.type === 'arp') { if(command.pressed) pressArp(command.token,command.index); else arp.release(command.token); }
        if (command.type === 'repeat') {
          if (!command.pressed) effects.repeat.release(command.token);
          else if (playback.isReady()) effects.repeat.press(command.token, command.division, editor.getSnapshot().session.bpm);
        }
        if (command.type === 'page') setPage(Math.max(0, Math.min(Math.max(0, Math.ceil(session.sections.length / 8) - 1), page + command.delta)));
      },
      release: () => { arp.stop(); automation.releaseRepeats(); },
      getSurface: () => ({ ...effects.getSnapshot(), arp: arp.getSnapshot(), recording: automation.getSnapshot(), selectedTrack: effects.getSnapshot().selectedTrack, volumes: effects.getSnapshot().volumes, cutoffs: effects.getSnapshot().cutoffs, repeat: effects.getSnapshot().repeats[effects.getSnapshot().selectedTrack], savedAt, storageError: message.includes('失败'), version: 4, templates, sections: session.sections, drafts, editingId, page, status, progress: playback.getProgress(), beatPhase: playback.getBeatPhase() }),
    };
    controlsRef.current = controls;
    return () => { if (controlsRef.current === controls) controlsRef.current = null; };
  });
  let exportLength = 0; let exportError = '';
  try { exportLength = arrangementExportLength(exportEntries ?? [], counts); } catch (error) { exportError = error.message; }
  return <section ref={workspaceRef} className="performance-mode jam-workspace" hidden={!active} aria-label="Jam 演奏">
    <header className="performance-header">
      {createElement(ThemeSwitcher)}
      {onHome ? <button className="performance-home" type="button" aria-label="返回首页" title="返回首页" disabled={recordingLocked} onClick={() => { resetPlayback(); arp.stop(); persist(); onHome(); }}>{renderIcon(Home)}</button> : null}
      <button className="performance-connect" onClick={() => { resetPlayback(); onBack(); }}>← 创作模式</button>
      <div className="performance-title"><span className="performance-eyebrow">PROJECT ARRANGER</span><h1>Jam · 演奏</h1></div>
      <label className="performance-tempo">BPM <input aria-label="演奏速度 BPM" disabled={recordingLocked} type="number" min="40" max="240" value={session.bpm} onChange={(e) => changeBpm(e.target.value)} /></label>
      <button className="performance-connect" onClick={connectHardware}>{hardwareInput?.status === 'connected' ? 'Launchpad 已连接' : '连接 Launchpad'}</button>
      <button className="performance-connect" disabled={recordingLocked || !session.sections.length} onClick={openExport}>导出到创作模式 →</button>
    </header>
    <JamProjectControls project={currentProject} projects={projectLibrary.projects} disabled={recordingLocked || Boolean(exportEntries)}
      onSave={saveProject} onNew={()=>openProject(null)} onOpen={openProject} onRename={renameProject}/>
    <JamView active={active} session={session} drafts={drafts} editingId={editingId} draft={draft}
      templates={templates} status={status} message={message || projectLibrary.error} playback={playback}
      toggleSequence={toggleSequence} recordingLocked={recordingLocked}
      selectedTrack={selectedTrack} selectedTracks={selectedTracks} selectTrack={effects.toggleTrack}
      effectsPanel={<aside className="jam-effects" data-track={selectedTrack}><h2>现场效果</h2><p>{selectedTracks.length ? `效果轨道 · ${selectedTracks.map(t => LABELS[t]).join('、')}` : '未选择效果轨道'}</p>
        <JamPerformanceDeck key={currentProject.id} effects={effects} arp={arp} session={session} enabled={inputActive && locked && !status.loading} recordingLocked={recordingLocked}
          changeMix={changeMix} onPage={changeEffectPage} onArpPress={pressArp} />
        <div className="jam-effect-recording" role="group" aria-label="效果录制">
          <button type="button" className="performance-connect" aria-pressed={recordingLocked}
            disabled={!recordingLocked && (status.loading || !hasSelection(draft.selection))}
            onClick={toggleRecording}>
            {recordingLocked ? '取消录制' : '● 录制效果'}</button>
          <span role="status">{recording.phase === 'armed' ? (status.loading ? '正在准备声音…' : '等待录制 · 下一轮开始') : recording.phase === 'recording' ? '录制中 · 本轮结束后试听' : draft.effectAutomation ? '已录制 · 随 Loop 重放' : '录制一轮 · 保存后保留'}</span>
          <button type="button" className="performance-connect" disabled={recordingLocked || !draft.effectAutomation}
            onClick={() => { editor.edit({ effectAutomation: undefined }); automation.clear(editingId); }}>清除效果录制</button>
        </div></aside>}
      catalog={catalog} replacePad={replacePad} triggerPad={triggerPad} selectSection={selectSection} updateTimbre={updateTimbre}
      reorderSection={(id, target, side) => { if (!locked) { editor.reorder(id, target, side); persist(); } }}
      changeRepeat={(id, repeat) => { if (!locked) { editor.setRepeat(id, repeat); persist(); } }}
      save={save} renameSection={(id, name) => { if (!locked) { editor.rename(id, name); persist(); } }}
      removeSection={(id) => { if (!locked) { editor.remove(id); persist(); } }} />
    {exportEntries && <JamExportDialog entries={exportEntries} sections={session.sections} onEntriesChange={setExportEntries}
      onAdd={(id) => { const s = session.sections.find(s => s.id === id); if (s) setExportEntries([...exportEntries, createExportEntry(s, genreId, profileId)]); }}
      counts={counts} onCountsChange={setCounts} error={exportError || message} length={exportLength} onClose={() => { setExportEntries(null); setMessage(''); }} onConfirm={() => {
        try { const result = createArrangementImport(session, exportEntries, counts); resetPlayback(); onImport(result); setExportEntries(null); }
        catch (error) { setMessage(error.message); }
      }} />}
  </section>;
}
