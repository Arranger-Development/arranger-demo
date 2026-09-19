import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {Drum, Piano, Guitar, Music2} from 'lucide-react';
import createAudioEngine from '../../audio/createAudioEngine.js';
import {PERFORMANCE_TRACKS as TRACKS, PERFORMANCE_LABELS as LABELS, performanceTemplates, normalizePerformanceBpm} from '../performanceModel.js';
import {createSessionEditor, readSession, writeSession, snapshotSection} from '../performanceSession.js';
import {createSessionPlayback} from '../sessionPlayback.js';
import {createPerformanceImport} from '../performanceImport.js';
import './performance.css';
const storage = () => { try { return window.localStorage; } catch { return null; } };
const icons = { drums: Drum, chord: Piano, bass: Guitar, melody: Music2 };
export default function PerformanceMode({ active, genreId, profileId = null, initialBpm, onBack, onImport }) {
  const [editor] = useState(() => createSessionEditor(readSession(storage(), genreId, profileId, initialBpm)));
  const { session, drafts, editingId } = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const [audio] = useState(() => createAudioEngine());
  const [status, setStatus] = useState({ mode: 'stopped' });
  const [playback] = useState(() => createSessionPlayback(audio, setStatus));
  const [message, setMessage] = useState('');
  const [newKind, setNewKind] = useState('main');
  const draft = drafts[editingId];
  const catalog = useMemo(() => performanceTemplates(genreId, profileId), [genreId, profileId]);
  const templates = useMemo(() => catalog, [catalog]);
  const persist = () => { if (!writeSession(storage(), genreId, profileId, editor.getSnapshot().session)) setMessage('浏览器未能保存，当前会话仍可继续使用。'); };
  const launchDraft = (edit = false) => { const current = editor.getSnapshot(); const copy = snapshotSection(current.drafts[current.editingId], genreId, profileId); if (copy) playback.launch(copy, current.session.bpm, { edit }); else playback.stop(); };
  function triggerPad(track, index) {
    const current = editor.getSnapshot(); const phrase = templates[track][index]; if (!phrase) return;
    const editing = current.drafts[current.editingId];
    
    const selection = { ...editing.selection, [track]: editing.selection[track] === phrase.id ? null : phrase.id };
    editor.edit({ selection }); launchDraft(true);
  }
  function selectSection(id) { editor.select(id); playback.stop(); }
  function save() { editor.save(); persist(); setMessage('段落已保存'); }
  function changeBpm(value) { const bpm = normalizePerformanceBpm(value); editor.patch({ bpm }); playback.setTempo(bpm); persist(); }
  useEffect(() => () => playback.stop(), [active, playback]);
  return <section className="performance-mode jam-workspace" hidden={!active} aria-label="演奏模式">
    <header className="performance-header"><button onClick={() => { playback.stop(); onBack(); }}>返回编曲</button><h1>演奏模式</h1>
      <label className="performance-tempo">BPM <input aria-label="演奏速度 BPM" type="number" value={session.bpm} onChange={(e) => changeBpm(e.target.value)} /></label>
      <button onClick={() => launchDraft()}>播放／停止</button><button onClick={() => { try { playback.stop(); onImport(createPerformanceImport({ bpm: session.bpm, saved: session.sections.map(s => s.selection), genreId, profileId })); } catch (error) { setMessage(error.message); } }}>导入编曲</button>
    </header>
    <main className="performance-body"><div className="performance-workbench"><div className="performance-grid" style={{ '--template-columns': 5 }}>{TRACKS.map(track => { const Icon = icons[track]; void Icon; return <div className="performance-row" data-track={track} key={track}><div className="performance-track-label"><Icon size={22} /><strong>{LABELS[track]}</strong></div>{templates[track].slice(0,5).map((phrase,index) => <button className={`performance-pad ${draft.selection[track] === phrase?.id ? 'is-selected' : ''}`} key={index} disabled={!phrase} onClick={() => triggerPad(track,index)}><strong>{phrase?.name ?? '空位'}</strong></button>)}</div>; })}</div><div className="performance-save-panel"><button className="performance-save" onClick={save}>保存段落</button><label>名称<input aria-label="当前段落名称" value={draft.name} onChange={e => editor.edit({ name: e.target.value })}/></label><button disabled={session.sections.length===1} onClick={() => { playback.stop(); editor.remove(editingId); persist(); }}>删除当前段落</button></div></div><div className="performance-loops" style={{ overflowX:'auto',display:'flex' }}>{session.sections.map(section => <button className={`performance-loop ${section.id===editingId?'is-editing':''}`} key={section.id} onClick={() => selectSection(section.id)}><span className="performance-loop-dial"><span className="performance-loop-circle">{section.kind==='transition'?'单次':'∞'}</span></span><strong>{drafts[section.id].name}</strong></button>)}</div><div><select aria-label="新增段落类型" value={newKind} onChange={e => setNewKind(e.target.value)}><option value="main">段落模板</option><option value="transition">转场模板</option></select><button onClick={() => { editor.add(newKind); persist(); }}>＋ Add</button></div><p role="status">{message || status.error}</p></main>
  </section>;
}
