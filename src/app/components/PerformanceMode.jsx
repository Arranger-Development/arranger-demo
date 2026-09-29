import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import createAudioEngine from '../../audio/createAudioEngine.js';
import { PERFORMANCE_TRACKS as TRACKS, PERFORMANCE_LABELS as LABELS, performanceTemplates, hasSelection, normalizePerformanceBpm } from '../performanceModel.js';
import { fixedPerformancePads, replacePadBinding, createSessionEditor, readSession, writeSession, snapshotSection, createExportEntry, createArrangementImport, arrangementExportLength } from '../performanceSession.js';
import { createSessionPlayback } from '../sessionPlayback.js';
import { mapPerformanceKeyboard } from '../../input/performanceInput.js';
import { loopRepeat } from '../loopOrder.js';
import { createJamEffects } from '../jamEffects.js';
import { bindJamBlankClick, returnToNewCombination } from '../jamBlankClick.js';
import { TrackControls } from './PerformanceControls.jsx';
import JamView from './JamView.jsx';
import JamExportDialog from './JamExportDialog.jsx';
import './performance.css';
import './jamView.css';
import './jamWorkspace.css';

void [JamView, JamExportDialog, TrackControls];
const storage = () => { try { return window.localStorage; } catch { return null; } };

export default function PerformanceMode({ active, genreId, profileId = null, initialBpm, recommendation, onBack, onImport, controlsRef, hardwareInput }) {
  const [editor] = useState(() => createSessionEditor(readSession(storage(), genreId, profileId, initialBpm, recommendation), { catalog: performanceTemplates(genreId, profileId), timbres: recommendation?.timbreByTrackId }));
  const { session, drafts, editingId } = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const [audio] = useState(() => createAudioEngine());
  const [effects] = useState(() => createJamEffects(audio));
  const { selectedTrack, cutoffs } = useSyncExternalStore(effects.subscribe, effects.getSnapshot);
  const [status, setStatus] = useState({ mode: 'stopped', loading: false, playingId: null, pendingId: null });
  const [playback] = useState(() => createSessionPlayback(audio, setStatus));
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
  const persist = () => { if (!writeSession(storage(), genreId, profileId, editor.getSnapshot().session)) setMessage('浏览器未能保存，当前会话仍可继续使用。'); };
  const patch = (value) => { editor.patch(value); persist(); };
  const jamSnapshot = (section) => {
    const value = snapshotSection(section, genreId, profileId);
    const saved = editor.getSnapshot().session.sections.find(s => s.id === section.id);
    return value && { ...value, repeat: loopRepeat(saved ?? { kind: section.kind }), phraseIds: { ...section.selection } };
  };
  const launchDraft = (edit = false) => {
    setMessage('');
    const current = editor.getSnapshot(); const next = jamSnapshot(current.drafts[current.editingId]);
    if (next) playback.launch(next, current.session.bpm, { edit, returnAfterTransition: false }); else if (playback.isActive()) playback.stop();
  };
  function replacePad(track, index, templateId) {
    const current = editor.getSnapshot().session;
    const next = replacePadBinding(current, catalog, track, index, templateId);
    if (next !== current) patch({ pads: next.pads });
  }
  function triggerPad(track, index) {
    const current = editor.getSnapshot();
    const phrase = fixedPerformancePads(catalog, current.session.pads)[track][index];
    if (!phrase) return;
    const selection = { ...current.drafts[current.editingId].selection };
    selection[track] = selection[track] === phrase.id ? null : phrase.id;
    editor.edit({ selection }); launchDraft(true);
  }
  function selectSection(id) {
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
    if (!hasSelection(editor.getSnapshot().drafts[editor.getSnapshot().editingId].selection)) return;
    if (!editor.save((next) => writeSession(storage(), genreId, profileId, next))) {
      setMessage('保存失败，当前组合已保留，请重试。'); return;
    }
    effects.reset(); playback.stop(); setSavedAt(performance.now()); setMessage('已保存，可继续组合下一个 loop。');
  }
  function changeMix(track, volume) {
    const current = editor.getSnapshot().session;
    patch({ volumes: { ...current.volumes, [track]: volume }, mutedTracks: { ...current.mutedTracks, [track]: false } });
    audio.setPerformanceEffect(track, { volume, muted: false });
  }
  function updateTimbre(track, value) {
    editor.edit({ timbres: { ...editor.getSnapshot().drafts[editingId].timbres, [track]: value } });
    if (locked) launchDraft(true);
  }
  function resetPlayback() { effects.reset(true); playback.stop(); }
  function changeBpm(value) { const bpm = normalizePerformanceBpm(value); patch({ bpm }); playback.setTempo(bpm); }
  function connectHardware() { void audio.startAudio(); void hardwareInput?.onConnect(); }
  function openExport() {
    resetPlayback(); setMessage(''); setCounts({});
    setExportEntries(session.sections.map(s => createExportEntry(s, genreId, profileId)));
  }
  useEffect(() => {
    if (status.playingId && editor.getSnapshot().drafts[status.playingId]) editor.select(status.playingId);
  }, [editor, status.playingId]);
  useEffect(() => { writeSession(storage(), genreId, profileId, editor.getSnapshot().session); }, [editor, genreId, profileId]);
  useEffect(() => { for (const track of TRACKS) audio.setPerformanceEffect(track, { volume: session.volumes[track], muted: session.mutedTracks[track] }); }, [audio, session.volumes, session.mutedTracks]);
  useEffect(() => {
    const release = () => effects.reset(true);
    window.addEventListener('blur', release);
    return () => { window.removeEventListener('blur', release); playback.stop(); effects.reset(true); };
  }, [active, effects, playback]);
  useEffect(() => { if (!inputActive || !locked || status.loading) effects.reset(); }, [effects, inputActive, locked, status.loading]);
  useEffect(() => { effects.reset(); }, [effects, hardwareInput?.status]);
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
        if (command.type === 'selectTrack') effects.select(command.trackId);
        if (command.type === 'volume') changeMix(track, command.value);
        if (command.type === 'cutoff') effects.cutoff(track, command.value);
        if (command.type === 'repeat') {
          if (!command.pressed) effects.repeat.release(command.token);
          else if (playback.isReady()) effects.repeat.press(command.token, command.division, editor.getSnapshot().session.bpm);
        }
        if (command.type === 'page') setPage(Math.max(0, Math.min(Math.max(0, Math.ceil(session.sections.length / 8) - 1), page + command.delta)));
      },
      release: () => effects.reset(),
      getSurface: () => ({ selectedTrack: effects.getSnapshot().selectedTrack, volumes: editor.getSnapshot().session.volumes, cutoffs: effects.getSnapshot().cutoffs, repeat: effects.repeat.getSnapshot(), savedAt, storageError: message.includes('失败'), version: 4, templates, sections: session.sections, drafts, editingId, page, status, progress: playback.getProgress(), beatPhase: playback.getBeatPhase() }),
    };
    controlsRef.current = controls;
    return () => { if (controlsRef.current === controls) controlsRef.current = null; };
  });
  let exportLength = 0; let exportError = '';
  try { exportLength = arrangementExportLength(exportEntries ?? [], counts); } catch (error) { exportError = error.message; }
  return <section ref={workspaceRef} className="performance-mode jam-workspace" hidden={!active} aria-label="Jam 演奏">
    <header className="performance-header">
      <button className="performance-connect" onClick={() => { resetPlayback(); onBack(); }}>← 创作模式</button>
      <div className="performance-title"><span className="performance-eyebrow">PROJECT ARRANGER</span><h1>Jam · 演奏</h1></div>
      <label className="performance-tempo">BPM <input aria-label="演奏速度 BPM" type="number" min="40" max="240" value={session.bpm} onChange={(e) => changeBpm(e.target.value)} /></label>
      <button className="performance-connect" onClick={connectHardware}>{hardwareInput?.status === 'connected' ? 'Launchpad 已连接' : '连接 Launchpad'}</button>
      <button className="performance-connect" disabled={!session.sections.length} onClick={openExport}>导出到创作模式 →</button>
    </header>
    <JamView active={active} session={session} drafts={drafts} editingId={editingId} draft={draft}
      templates={templates} status={status} message={message} playback={playback}
      toggleSequence={toggleSequence}
      selectedTrack={selectedTrack} selectTrack={effects.select}
      effectsPanel={<aside className="jam-effects" data-track={selectedTrack}><h2>现场效果</h2><p>当前轨道 · {LABELS[selectedTrack]}</p>
        <TrackControls key={selectedTrack} track={selectedTrack} session={session} changeMix={changeMix} effects={effects} cutoff={cutoffs[selectedTrack]} repeatEnabled={inputActive && locked && !status.loading} />
        <p className="jam-effect-hint">按住重复 · 松开恢复</p></aside>}
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
