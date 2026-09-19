import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import createAudioEngine from '../../audio/createAudioEngine.js';
import { PERFORMANCE_TRACKS as TRACKS, PERFORMANCE_LABELS as LABELS, performanceTemplates, hasSelection, normalizePerformanceBpm } from '../performanceModel.js';
import { createForm, MAIN_PHRASE_SLOTS, EXTRA_PHRASE_PLACEHOLDERS, fixedPerformancePads, createSessionEditor, readSession, writeSession, snapshotSection, replaceLiveColumnTrack, createLiveImport, liveExportLength } from '../performanceSession.js';
import { createSessionPlayback } from '../sessionPlayback.js';
import { mapPerformanceKeyboard } from '../../input/performanceInput.js';
import { Progress, TrackControls } from './PerformanceControls.jsx';
import LiveTransport from './LiveTransport.jsx';
import { PERFORMANCE_TRACK_ICONS, renderIcon } from './icons.js';
import useLiveDrag from './useLiveDrag.js';
import { insertLiveColumn, liveKeyboardCommand } from '../liveInteraction.js';
import JamView from './JamView.jsx';
import SectionEditorDialog from './SectionEditorDialog.jsx';
import './performance.css';
import './performanceWorkspace.css';
import './jamView.css';

void [LiveTransport, Progress, TrackControls, JamView, SectionEditorDialog];
const storage = () => { try { return window.localStorage; } catch { return null; } };

export default function PerformanceMode({ active, genreId, profileId = null, initialBpm, recommendation, onBack, onImport, controlsRef, hardwareInput }) {
  const [editor] = useState(() => createSessionEditor(readSession(storage(), genreId, profileId, initialBpm, recommendation)));
  const { session, drafts, editingId, liveUndo, liveRedo } = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const [audio] = useState(() => createAudioEngine());
  const [status, setStatus] = useState({ mode: 'stopped', loading: false, playingId: null, pendingId: null });
  const [playback] = useState(() => createSessionPlayback(audio, setStatus));
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const editorEntryRef = useRef(null);
  const [counts, setCounts] = useState({});
  const [page, setPage] = useState(0);
  const [librarySelection, setLibrarySelection] = useState('');
  const [selectedLiveTrack, setSelectedLiveTrack] = useState('drums');
  const editingSection = active && editorOpen;
  const locked = !['stopped', 'paused'].includes(status.mode);
  const liveLocked = status.mode === 'live';
  const previewing = status.mode === 'preview';
  const draft = drafts[editingId];
  const catalog = useMemo(() => performanceTemplates(genreId, profileId), [genreId, profileId]);
  const templates = useMemo(() => fixedPerformancePads(catalog), [catalog]);
  const persist = () => { if (!writeSession(storage(), genreId, profileId, editor.getSnapshot().session)) setMessage('浏览器未能保存，当前会话仍可继续使用。'); };
  const patch = (value) => {
    if (editingSection) editor.patch(value);
    else editor.editLive(value, playback.getLivePosition());
    persist();
  };
  const beginLiveEdit = () => editor.beginLiveEdit(playback.getLivePosition());
  const commitLiveEdit = () => editor.commitLiveEdit();
  const columnChange = (columns) => {
    if (liveLocked) return;
    editor.columns(columns, playback.getLivePosition()); playback.syncLiveColumns(columns); persist();
  };
  const { drag: dragState, setScrollElement, ...drag } = useLiveDrag({ disabled: liveLocked,
    onSectionDrop: placeSection,
    onColumnDrop: (id, targetId, side) => columnChange(insertLiveColumn(editor.getSnapshot().session.columns, id, targetId, side)),
  });
  const fieldHistory = { onFocus: beginLiveEdit, onBlur: commitLiveEdit, onKeyDown: (e) => { if (e.key === 'Enter') e.currentTarget.blur(); } };
  function restoreHistory(direction) {
    commitLiveEdit();
    const before = editor.getSnapshot();
    if (!(direction === 'undo' ? before.liveUndo : before.liveRedo).length) return;
    playback.stop();
    const restored = direction === 'undo' ? editor.undoLive(playback.getLivePosition()) : editor.redoLive(playback.getLivePosition());
    playback.restoreLivePosition(restored.livePosition, restored.session.columns);
    playback.setTempo(restored.session.bpm); persist(); setMessage('');
  }
  function playLive(id) {
    commitLiveEdit(); setMessage('');
    if (!playback.live(editor.getSnapshot().session.columns, editor.getSnapshot().session.bpm, id)) setMessage('此处之后没有可播放段落');
  }
  function toggleLive() {
    if (status.mode === 'live') playback.pauseLive(); else playLive();
  }
  function clickColumn(event, columnId, track) {
    if (drag.suppressClick(event)) return;
    selectLiveTrack(track); playLive(columnId);
  }
  const snapshot = (section) => snapshotSection(section, genreId, profileId);
  const launchDraft = (edit = false) => {
    setMessage('');
    const current = editor.getSnapshot(); const next = snapshot(current.drafts[current.editingId]);
    if (next) playback.launch(next, current.session.bpm, { edit }); else if (playback.isActive()) playback.stop();
  };
  function triggerPad(track, index) {
    const current = editor.getSnapshot();
    const phrase = templates[track][index];
    if (!phrase) return;
    const editing = current.drafts[current.editingId];
    if (index >= MAIN_PHRASE_SLOTS && editing.kind !== 'transition') {
      const selection = Object.fromEntries(TRACKS.map((t) => [t, t === track ? phrase.id : null]));
      const preview = snapshot({ ...editing, id: `${editing.id}:transition:${track}:${index}`, kind: 'transition', selection });
      playback.launch(preview, current.session.bpm);
      return;
    }
    const selection = { ...current.drafts[current.editingId].selection };
    selection[track] = selection[track] === phrase.id ? null : phrase.id;
    editor.edit({ selection }); launchDraft(true);
  }
  function selectSection(id) { editor.select(id); launchDraft(); }
  function save() { editor.save(); persist(); setMessage(`${draft.kind === 'transition' ? '转场' : '段落'}已保存，可拖入 Live。`); }
  function changeMix(track, volume) {
    const current = editor.getSnapshot().session;
    patch({ volumes: { ...current.volumes, [track]: volume }, mutedTracks: { ...current.mutedTracks, [track]: false } });
    audio.setPerformanceEffect(track, { volume, muted: false });
  }
  function updateTimbre(track, value) {
    editor.edit({ timbres: { ...editor.getSnapshot().drafts[editingId].timbres, [track]: value } });
    if (locked) launchDraft(true);
  }
  function resetPerformancePlayback() {
    playback.stop();
    for (const track of TRACKS) audio.setPerformanceEffect(track, { cutoff: 20000 });
    setMessage('');
  }
  function openSectionEditor() {
    commitLiveEdit(); resetPerformancePlayback();
    if (librarySelection) editor.select(librarySelection);
    drag.cancel();
    setEditorOpen(true);
  }
  function closeSectionEditor() {
    resetPerformancePlayback();
    setEditorOpen(false);
    window.requestAnimationFrame(() => editorEntryRef.current?.focus({ preventScroll: true }));
  }
  function changeBpm(value) {
    const bpm = normalizePerformanceBpm(value); patch({ bpm }); playback.setTempo(bpm);
  }
  function connectHardware() { void audio.startAudio(); void hardwareInput?.onConnect(); }
  function selectLiveTrack(track) {
    if (track !== selectedLiveTrack) audio.setPerformanceEffect(selectedLiveTrack, { held: false });
    setSelectedLiveTrack(track);
  }
  function previewSection(event, section) {
    if (drag.suppressClick(event)) return;
    setLibrarySelection(section.id);
    setMessage('');
    playback.preview(snapshot(section), session.bpm);
  }
  function placeSection(columnId, sectionId) {
    if (liveLocked) return;
    const section = session.sections.find((s) => s.id === sectionId);
    const copy = section && snapshot(section);
    if (copy && session.columns.some((c) => c.id === columnId)) {
      if (previewing) playback.stop();
      columnChange(session.columns.map((c) => c.id === columnId ? { ...c, snapshot: copy } : c));
    }
  }
  function replaceTrack(columnId, track, templateId) {
    if (liveLocked) return;
    const columns = editor.getSnapshot().session.columns;
    const column = columns.find((c) => c.id === columnId);
    if (!column) return;
    const replacement = replaceLiveColumnTrack(column, track, templateId, genreId, profileId);
    if (replacement === column) return;
    commitLiveEdit();
    if (previewing) playback.stop();
    selectLiveTrack(track);
    columnChange(columns.map((c) => c.id === columnId ? replacement : c));
    setMessage(`${column.name} · ${LABELS[track]}已替换`);
  }
  function moveColumn(id, targetId) {
    const columns = [...session.columns]; const from = columns.findIndex((c) => c.id === id); const to = columns.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    columns.splice(to, 0, columns.splice(from, 1)[0]); columnChange(columns);
  }

  useEffect(() => {
    for (const track of TRACKS) audio.setPerformanceEffect(track, { volume: session.volumes[track], muted: session.mutedTracks[track] });
  }, [audio, session.volumes, session.mutedTracks]);
  useEffect(() => {
    const release = () => audio.resetPerformanceEffects();
    window.addEventListener('blur', release);
    return () => { window.removeEventListener('blur', release); playback.stop(); for (const track of TRACKS) audio.setPerformanceEffect(track, { cutoff: 20000 }); };
  }, [active, audio, playback]);
  useEffect(() => {
    if (!editingSection) return undefined;
    const key = (e) => {
      const cmd = mapPerformanceKeyboard(e, templates);
      if (!cmd) return;
      e.preventDefault(); triggerPad(cmd.trackId, templates[cmd.trackId].findIndex((p) => p?.id === cmd.templateId));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  useEffect(() => {
    if (!active || editingSection || exporting) return undefined;
    const key = (event) => {
      if (event.key === 'Escape' && dragState) { event.preventDefault(); drag.cancel(); return; }
      const command = liveKeyboardCommand(event); if (!command) return;
      event.preventDefault();
      if (command === 'play') toggleLive();
      if (command === 'stop') playback.stop();
      if (command === 'undo' || command === 'redo') restoreHistory(command);
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  useLayoutEffect(() => {
    if (!controlsRef || !editingSection) return undefined;
    const controls = {
      templates,
      dispatch(command) {
        if (command.type === 'template') triggerPad(command.trackId, templates[command.trackId].findIndex((p) => p?.id === command.templateId));
        if (command.type === 'loop') { const s = session.sections[page * 5 + command.index]; if (s) selectSection(s.id); }
        if (command.type === 'save') save();
        if (command.type === 'togglePlayback' || command.type === 'stop') playback.stop();
        if (command.type === 'page') setPage(Math.max(0, Math.min(Math.ceil(session.sections.length / 5) - 1, page + command.delta)));
      },
      getSurface: () => ({ version: 4, templates, sections: session.sections, drafts, editingId, page, status, progress: playback.getProgress(), beatPhase: playback.getBeatPhase() }),
    };
    controlsRef.current = controls;
    return () => { if (controlsRef.current === controls) controlsRef.current = null; };
  });

  let exportLength = 0; let exportError = '';
  try { exportLength = liveExportLength(session.columns, counts); } catch (error) { exportError = error.message; }
  return <><section className="performance-mode pw-workspace" hidden={!active} inert={editingSection ? true : undefined} aria-label="Live 编排">
    <header className="performance-header">
      <button onClick={() => { commitLiveEdit(); playback.stop(); onBack(); }}>← 创作模式</button>
      <div className="performance-title"><span className="performance-eyebrow">PROJECT ARRANGER / 0.4.0</span><h1>Live · 曲式编排</h1></div>
      <label className="performance-tempo">BPM <input aria-label="演奏速度 BPM" {...fieldHistory} type="number" min="40" max="240" value={session.bpm} onChange={(e) => changeBpm(e.target.value)} /></label>
      <button onClick={connectHardware}>{hardwareInput?.status === 'connected' ? 'Launchpad 已连接' : '连接 Launchpad'}</button>
    </header>
    <div className="pw-status" role="status">{status.error || message || (status.loading ? (previewing ? '正在准备试听…' : '正在准备声音…') : status.pendingId ? (previewing ? '待试听 · 下一小节切换' : '已排队 · 下一小节切换') : previewing ? '段落试听中' : status.mode === 'paused' ? '已暂停' : locked ? `播放中${status.cycle ? ` · 第 ${status.cycle} 次` : ''}` : '选择段落开始演奏')}
      {previewing && <button onClick={() => playback.stop()}>停止试听</button>}</div>
    <main className="pw-live">
      <div className="pw-live-toolbar"><label>选择曲式 <select aria-label="选择曲式" disabled={liveLocked} value="" onChange={(e) => columnChange(createForm(e.target.value))}><option value="" disabled>选择曲式模板</option><option value="screenshot">完整曲式 · 截图模板</option><option value="blank">空白自定义</option></select></label><LiveTransport playback={playback} columns={session.columns} status={status} canUndo={liveUndo.length > 0} canRedo={liveRedo.length > 0}
          onUndo={() => restoreHistory('undo')} onRedo={() => restoreHistory('redo')} onPlay={toggleLive} onStop={() => playback.stop()}
          onRewind={() => { setMessage(''); playback.rewindLive(session.columns, session.bpm); }} />
        <button disabled={liveLocked || !session.columns.some((c) => c.snapshot)} onClick={() => { if (previewing) playback.stop(); setCounts(Object.fromEntries(session.columns.filter((c) => c.snapshot && c.repeat === null).map((c) => [c.id, 1]))); setExporting(true); }}>导出到创作模式 →</button>
      </div>
      <aside className="pw-library"><div className="pw-library-head"><h2>段落素材</h2><button type="button" className="pw-library-edit" ref={editorEntryRef} onClick={openSectionEditor}>编辑／保存段落</button><p>点击试听，再点停止；拖入曲式列，或选中后点击“放入”</p></div>{session.sections.map((s) => {
        const playing = previewing && status.playingId === s.id;
        const pending = previewing && status.pendingId === s.id;
        const preparing = previewing && !status.playingId && status.requestedId === s.id;
        return <button key={s.id} className="pw-library-section" disabled={!hasSelection(s.selection)}
          onPointerDown={(e) => drag.begin(e, 'section', s.id)} onPointerMove={drag.move} onPointerUp={drag.end}
          onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel}
          data-playing={playing} data-pending={pending} data-preparing={preparing}
          aria-pressed={librarySelection === s.id} onClick={(e) => previewSection(e, s)}>
          <small>{s.kind === 'transition' ? '转场' : '主段落'}</small><strong>{s.name}</strong>
          <span>{pending ? '待试听' : preparing ? '准备中' : playing ? '试听中' : hasSelection(s.selection) ? '已保存' : '空位'}</span>
          <Progress playback={playback} id={s.id} running={active && playing} />
        </button>;
      })}</aside>
      <div className="pw-live-trackheads"><div className="pw-column-spacer">轨道</div>{TRACKS.map((track) => <button type="button" key={track} className="pw-track-select" data-track={track}
        aria-label={`选择${LABELS[track]}轨道`} aria-pressed={selectedLiveTrack === track} onClick={() => selectLiveTrack(track)}>
        {renderIcon(PERFORMANCE_TRACK_ICONS[track], { size: 22 })}<strong>{LABELS[track]}</strong><span>{session.mutedTracks[track] || session.volumes[track] <= -24 ? '静音' : `${session.volumes[track]} dB`}</span>
      </button>)}</div>
      <div className="pw-live-scroll" ref={setScrollElement}><div className="pw-columns">{session.columns.map((column, index) => <article key={column.id} className="pw-column" data-live-column-id={column.id} data-dragging={dragState?.kind === 'column' && dragState.id === column.id} data-drop-side={dragState?.targetId === column.id ? dragState.side : undefined} data-playing={status.playingId === column.id} data-pending={status.pendingId === column.id}
        onDragOver={(e) => { if (!liveLocked) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (liveLocked) return; const s = e.dataTransfer.getData('application/arranger-section'); const c = e.dataTransfer.getData('application/arranger-column'); if (s) placeSection(column.id, s); if (c) moveColumn(c, column.id); }}>
        <header onPointerDown={(e) => drag.begin(e, 'column', column.id)} onPointerMove={drag.move} onPointerUp={drag.end} onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel}><span className="pw-column-grip" aria-label={`拖动 ${column.name}`}>⠿</span>
          <input aria-label={`曲式 ${index + 1} 名称`} {...fieldHistory} disabled={liveLocked} value={column.name} onChange={(e) => columnChange(session.columns.map((c) => c.id === column.id ? { ...c, name: e.target.value } : c))} />
          <div><button aria-label={`左移 ${column.name}`} disabled={liveLocked || index === 0} onClick={() => moveColumn(column.id, session.columns[index - 1].id)}>←</button><button disabled={liveLocked} aria-label={`删除曲式 ${column.name}`} onClick={() => columnChange(session.columns.filter((c) => c.id !== column.id))}>×</button><button aria-label={`右移 ${column.name}`} disabled={liveLocked || index === session.columns.length - 1} onClick={() => moveColumn(column.id, session.columns[index + 1].id)}>→</button></div>
        </header>
        {TRACKS.map((t) => <div className="pw-live-slot" data-track={t} key={t}><button type="button" className="pw-live-cell" data-track={t} aria-label={`${column.name} · 选择${LABELS[t]}轨道`}
          aria-pressed={selectedLiveTrack === t} onPointerDown={(e) => drag.begin(e, 'column', column.id)} onPointerMove={drag.move} onPointerUp={drag.end} onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel}
          onClick={(e) => clickColumn(e, column.id, t)}><strong>{column.snapshot?.phraseNames[t] ?? '拖入或选择'}</strong><span>{column.snapshot ? `${column.snapshot.totalBars} 小节` : '空槽'}</span><Progress playback={playback} id={column.id} bars={column.snapshot?.phraseBars[t]} running={active && status.playingId === column.id} /></button>
          <select className="pw-live-replace" aria-label={`曲式 ${index + 1} ${LABELS[t]}替换乐句`} disabled={liveLocked} value=""
            onChange={(e) => replaceTrack(column.id, t, e.target.value)}>
            <option value="" disabled>替换乐句</option>
            <optgroup label="已有模板">{catalog[t].map((phrase) => <option key={phrase.id} value={phrase.id}>{phrase.name}</option>)}</optgroup>
            <optgroup label="待提供">{EXTRA_PHRASE_PLACEHOLDERS.map((phrase) => <option key={phrase.id} value={phrase.id} disabled>{phrase.name} · 待提供</option>)}</optgroup>
          </select>
        </div>)}
        <footer><button disabled={!column.snapshot} onClick={() => playLive(column.id)}>▶ {column.snapshot?.name ?? '空列'}</button>
          <div className="pw-repeat-count"><span>×</span><input aria-label={`${column.name}循环次数`} {...fieldHistory} disabled={liveLocked || column.repeat === null} type="number" min="1" value={column.repeat ?? ''} placeholder="∞" onChange={(e) => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n > 0) columnChange(session.columns.map((c) => c.id === column.id ? { ...c, repeat: n } : c)); }} /><button aria-label={`${column.name}无限循环`} disabled={liveLocked} aria-pressed={column.repeat === null} onClick={() => columnChange(session.columns.map((c) => c.id === column.id ? { ...c, repeat: c.repeat === null ? 1 : null } : c))}>∞</button></div>
          <button disabled={liveLocked || !librarySelection} onClick={() => placeSection(column.id, librarySelection)}>放入选中段落</button>
        </footer>
      </article>)}<button className="pw-add-column" aria-label="添加曲式列" disabled={liveLocked} onClick={() => columnChange([...session.columns, { id: crypto.randomUUID(), name: `段落 ${session.columns.length + 1}`, repeat: 1, snapshot: null }])}>＋</button></div></div>
      <aside className="pw-live-effects" aria-label="选中轨道效果器" data-track={selectedLiveTrack}>
        <h2>现场效果</h2><p className="pw-effect-target">当前轨道 · {LABELS[selectedLiveTrack]}</p>
        {TRACKS.map((track) => <div key={`${track}:${editingSection}:${active}`} hidden={selectedLiveTrack !== track}>
          <TrackControls live expanded track={track} session={session} audio={audio} changeMix={changeMix}
            beginMixEdit={beginLiveEdit} commitMixEdit={commitLiveEdit}
            repeatEnabled={active && !editingSection && !status.loading && locked && selectedLiveTrack === track} />
        </div>)}
        <p className="pw-effect-hint">点击轨道头或格子选择轨道。滤波与重复器仅影响现场声音。</p>
      </aside>
    </main>
    {exporting && <div className="pw-dialog-backdrop"><section className="pw-dialog" role="dialog" aria-modal="true" aria-label="导出到创作模式"><h2>展开曲式</h2><p>无限循环仅在本次导出中转换为有限次数。</p>{session.columns.filter((c) => c.snapshot && c.repeat === null).map((c) => <label key={c.id}>{c.name} <input type="number" min="1" aria-label={`${c.name}导出次数`} value={counts[c.id] ?? ''} onChange={(e) => setCounts({ ...counts, [c.id]: e.target.value })} /></label>)}<p role="status">{exportError || `共 ${exportLength} 小节 · 上限 256 小节`}</p><p>将替换当前创作编排，可在创作模式撤销。</p><button onClick={() => setExporting(false)}>取消</button><button className="pw-primary" disabled={Boolean(exportError) || exportLength < 1 || exportLength > 256} onClick={() => {
      try { const result = createLiveImport(session, counts); playback.stop(); onImport(result); setExporting(false); } catch (error) { setMessage(error.message); }
    }}>展开并进入创作</button></section></div>}
  </section>
    {editingSection && <SectionEditorDialog bpm={session.bpm} onBpmChange={changeBpm} onClose={closeSectionEditor} hardwareInput={hardwareInput} onConnect={connectHardware}>
      <JamView active={editingSection} session={session} drafts={drafts} editingId={editingId} draft={draft}
      templates={templates} status={status} message={message} playback={playback} audio={audio}
      triggerPad={triggerPad} selectSection={selectSection} updateTimbre={updateTimbre} changeMix={changeMix}
      save={save} onComplete={closeSectionEditor} editSection={(id) => editor.select(id)}
      addSection={(kind) => { editor.add(kind); persist(); }} renameSection={(name) => editor.edit({ name })}
      removeSection={(id) => { if (status.playingId === id || status.pendingId === id) playback.stop(); editor.remove(id); if (librarySelection === id) setLibrarySelection(''); persist(); }}
      />
    </SectionEditorDialog>}
  </>;
}
