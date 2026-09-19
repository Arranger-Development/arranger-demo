import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import createAudioEngine from '../../audio/createAudioEngine.js';
import { PERFORMANCE_TRACKS as TRACKS, PERFORMANCE_LABELS as LABELS, performanceTemplates, hasSelection, normalizePerformanceBpm } from '../performanceModel.js';
import {createForm, MAIN_PHRASE_SLOTS, fixedPerformancePads, createSessionEditor, readSession, writeSession, snapshotSection} from '../performanceSession.js';
import { createSessionPlayback } from '../sessionPlayback.js';
import { mapPerformanceKeyboard } from '../../input/performanceInput.js';
import { Progress, TrackControls } from './PerformanceControls.jsx';
import useLiveDrag from './useLiveDrag.js';
import {insertLiveColumn} from '../liveInteraction.js';
import JamView from './JamView.jsx';
import './performance.css';
import './performanceWorkspace.css';
import './jamView.css';

void [Progress, TrackControls, JamView];
const storage = () => { try { return window.localStorage; } catch { return null; } };

export default function PerformanceMode({ active, genreId, profileId = null, initialBpm, onBack, hardwareInput }) {
  const [editor] = useState(() => createSessionEditor(readSession(storage(), genreId, profileId, initialBpm)));
  const { session, drafts, editingId } = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const [audio] = useState(() => createAudioEngine());
  const [status, setStatus] = useState({ mode: 'stopped', loading: false, playingId: null, pendingId: null });
  const [playback] = useState(() => createSessionPlayback(audio, setStatus));
  const [message, setMessage] = useState('');
  const [editorOpen, setEditorOpen] = useState(true);
  const [librarySelection, setLibrarySelection] = useState('');
  const editingSection = active && editorOpen;
  const locked = !['stopped', 'paused'].includes(status.mode);
  const liveLocked = status.mode === 'live';
  const draft = drafts[editingId];
  const catalog = useMemo(() => performanceTemplates(genreId, profileId), [genreId, profileId]);
  const templates = useMemo(() => fixedPerformancePads(catalog), [catalog]);
  const persist = () => { if (!writeSession(storage(), genreId, profileId, editor.getSnapshot().session)) setMessage('浏览器未能保存，当前会话仍可继续使用。'); };
  const patch = (value) => {
    editor.patch(value);
    persist();
  };
  const columnChange = (columns) => {
    if (liveLocked) return;
    editor.columns(columns); persist();
  };
  const { drag: dragState, setScrollElement, ...drag } = useLiveDrag({ disabled: liveLocked,
    onSectionDrop: placeSection,
    onColumnDrop: (id, targetId, side) => columnChange(insertLiveColumn(editor.getSnapshot().session.columns, id, targetId, side)),
  });
  function playLive() { setMessage(''); if (!playback.live(editor.getSnapshot().session.columns, editor.getSnapshot().session.bpm)) setMessage('此处之后没有可播放段落'); }
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
  function updateTimbre(track, value) {
    editor.edit({ timbres: { ...editor.getSnapshot().drafts[editingId].timbres, [track]: value } });
    if (locked) launchDraft(true);
  }
  function resetPerformancePlayback() {
    playback.stop();
    setMessage('');
  }
  function openSectionEditor() {
    resetPerformancePlayback();
    if (librarySelection) editor.select(librarySelection);
    drag.cancel();
    setEditorOpen(true);
  }
  function closeSectionEditor() {
    resetPerformancePlayback();
    setEditorOpen(false);
  }
  function changeBpm(value) {
    const bpm = normalizePerformanceBpm(value); patch({ bpm }); playback.setTempo(bpm);
  }
  function connectHardware() { void audio.startAudio(); void hardwareInput?.onConnect(); }
  function previewSection(event, section) {
    if (drag.suppressClick(event)) return;
    setLibrarySelection(section.id);
    setMessage('');
  }
  function placeSection(columnId, sectionId) {
    if (liveLocked) return;
    const section = session.sections.find((s) => s.id === sectionId);
    const copy = section && snapshot(section);
    if (copy && session.columns.some((c) => c.id === columnId)) {
      columnChange(session.columns.map((c) => c.id === columnId ? { ...c, snapshot: copy } : c));
    }
  }
  function moveColumn(id, targetId) {
    const columns = [...session.columns]; const from = columns.findIndex((c) => c.id === id); const to = columns.findIndex((c) => c.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    columns.splice(to, 0, columns.splice(from, 1)[0]); columnChange(columns);
  }

  useEffect(() => () => playback.stop(), [active, playback]);
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



  return <><section className="performance-mode pw-workspace" hidden={!active || editorOpen} aria-label="Live 编排">
    <header className="performance-header">
      <button onClick={() => { playback.stop(); onBack(); }}>← 创作模式</button>
      <div className="performance-title"><span className="performance-eyebrow">PROJECT ARRANGER / 0.4.0</span><h1>Live · 曲式编排</h1></div><button onClick={openSectionEditor}>Jam 段落编辑</button>
      <label className="performance-tempo">BPM <input aria-label="演奏速度 BPM" type="number" min="40" max="240" value={session.bpm} onChange={(e) => changeBpm(e.target.value)} /></label>
      <button onClick={connectHardware}>{hardwareInput?.status === 'connected' ? 'Launchpad 已连接' : '连接 Launchpad'}</button>
    </header>
    <div className="pw-status" role="status">{status.error || message || (status.loading ? '正在准备声音…' : status.pendingId ? '已排队 · 下一小节切换' : status.mode === 'paused' ? '已暂停' : locked ? `播放中${status.cycle ? ` · 第 ${status.cycle} 次` : ''}` : '选择段落开始演奏')}
</div>
    <main className="pw-live">
      <div className="pw-live-toolbar"><label>选择曲式 <select aria-label="选择曲式" disabled={liveLocked} value="" onChange={(e) => columnChange(createForm(e.target.value))}><option value="" disabled>选择曲式模板</option><option value="screenshot">完整曲式 · 截图模板</option><option value="blank">空白自定义</option></select></label><button disabled={liveLocked || !session.columns.some(c => c.snapshot)} onClick={playLive}>播放曲式</button><button onClick={() => playback.stop()}>停止</button>

      </div>
      <aside className="pw-library"><div className="pw-library-head"><h2>段落素材</h2><p>拖入曲式列，或选中后点击“放入”</p></div>{session.sections.map((s) => {
        return <button key={s.id} className="pw-library-section" disabled={!hasSelection(s.selection)}
          onPointerDown={(e) => drag.begin(e, 'section', s.id)} onPointerMove={drag.move} onPointerUp={drag.end}
          onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel}
          aria-pressed={librarySelection === s.id} onClick={(e) => previewSection(e, s)}>
          <small>{s.kind === 'transition' ? '转场' : '主段落'}</small><strong>{s.name}</strong>
          <span>{hasSelection(s.selection) ? '已保存' : '空位'}</span>
        </button>;
      })}</aside>
      <div className="pw-live-trackheads"><div className="pw-column-spacer">轨道</div>{TRACKS.map((track) => <button type="button" key={track} className="pw-track-select" data-track={track}
        aria-label={`选择${LABELS[track]}轨道`} >
        <strong>{LABELS[track]}</strong><span>{session.mutedTracks[track] || session.volumes[track] <= -24 ? '静音' : `${session.volumes[track]} dB`}</span>
      </button>)}</div>
      <div className="pw-live-scroll" ref={setScrollElement}><div className="pw-columns">{session.columns.map((column, index) => <article key={column.id} className="pw-column" data-live-column-id={column.id} data-dragging={dragState?.kind === 'column' && dragState.id === column.id} data-drop-side={dragState?.targetId === column.id ? dragState.side : undefined} data-playing={status.playingId === column.id} data-pending={status.pendingId === column.id}
        onDragOver={(e) => { if (!liveLocked) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (liveLocked) return; const s = e.dataTransfer.getData('application/arranger-section'); const c = e.dataTransfer.getData('application/arranger-column'); if (s) placeSection(column.id, s); if (c) moveColumn(c, column.id); }}>
        <header onPointerDown={(e) => drag.begin(e, 'column', column.id)} onPointerMove={drag.move} onPointerUp={drag.end} onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel}><span className="pw-column-grip" aria-label={`拖动 ${column.name}`}>⠿</span>
          <input aria-label={`曲式 ${index + 1} 名称`} disabled={liveLocked} value={column.name} onChange={(e) => columnChange(session.columns.map((c) => c.id === column.id ? { ...c, name: e.target.value } : c))} />
          <div><button aria-label={`左移 ${column.name}`} disabled={liveLocked || index === 0} onClick={() => moveColumn(column.id, session.columns[index - 1].id)}>←</button><button disabled={liveLocked} aria-label={`删除曲式 ${column.name}`} onClick={() => columnChange(session.columns.filter((c) => c.id !== column.id))}>×</button><button aria-label={`右移 ${column.name}`} disabled={liveLocked || index === session.columns.length - 1} onClick={() => moveColumn(column.id, session.columns[index + 1].id)}>→</button></div>
        </header>
        {TRACKS.map((t) => <button type="button" className="pw-live-cell" data-track={t} key={t} aria-label={`${column.name} · 选择${LABELS[t]}轨道`}
          onPointerDown={(e) => drag.begin(e, 'column', column.id)} onPointerMove={drag.move} onPointerUp={drag.end} onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel}
          ><strong>{column.snapshot?.phraseNames[t] ?? '拖入段落'}</strong><span>{column.snapshot ? `${column.snapshot.totalBars} 小节` : '空槽'}</span><Progress playback={playback} id={column.id} bars={column.snapshot?.phraseBars[t]} running={active && status.playingId === column.id} /></button>)}
        <footer><button disabled={!column.snapshot} onClick={() => playLive(column.id)}>▶ {column.snapshot?.name ?? '空列'}</button>
          <div className="pw-repeat-count"><span>×</span><input aria-label={`${column.name}循环次数`} disabled={liveLocked || column.repeat === null} type="number" min="1" value={column.repeat ?? ''} placeholder="∞" onChange={(e) => { const n = Number(e.target.value); if (Number.isSafeInteger(n) && n > 0) columnChange(session.columns.map((c) => c.id === column.id ? { ...c, repeat: n } : c)); }} /><button aria-label={`${column.name}无限循环`} disabled={liveLocked} aria-pressed={column.repeat === null} onClick={() => columnChange(session.columns.map((c) => c.id === column.id ? { ...c, repeat: c.repeat === null ? 1 : null } : c))}>∞</button></div>
          <button disabled={liveLocked || !librarySelection} onClick={() => placeSection(column.id, librarySelection)}>放入选中段落</button>
        </footer>
      </article>)}<button className="pw-add-column" aria-label="添加曲式列" disabled={liveLocked} onClick={() => columnChange([...session.columns, { id: crypto.randomUUID(), name: `段落 ${session.columns.length + 1}`, repeat: 1, snapshot: null }])}>＋</button></div></div>
    </main>

  </section>
    {editingSection && <section className="performance-mode jam-workspace"><header className="performance-header"><button onClick={() => { playback.stop(); onBack(); }}>返回编曲</button><h1>Jam · 段落编辑</h1><label className="performance-tempo">BPM <input aria-label="演奏速度 BPM" value={session.bpm} type="number" onChange={e => changeBpm(e.target.value)} /></label><button onClick={closeSectionEditor}>前往 Live</button></header>
      <JamView active={editingSection} session={session} drafts={drafts} editingId={editingId} draft={draft}
      templates={templates} status={status} message={message} playback={playback} audio={audio}
      triggerPad={triggerPad} selectSection={selectSection} updateTimbre={updateTimbre}
      save={save} onComplete={closeSectionEditor} editSection={(id) => editor.select(id)}
      addSection={(kind) => { editor.add(kind); persist(); }} renameSection={(name) => editor.edit({ name })}
      removeSection={(id) => { if (status.playingId === id || status.pendingId === id) playback.stop(); editor.remove(id); if (librarySelection === id) setLibrarySelection(''); persist(); }}
      />
    </section>}
  </>;
}
