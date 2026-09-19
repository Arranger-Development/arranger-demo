import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import createAudioEngine from '../../audio/createAudioEngine.js';
import {performanceTemplates, normalizePerformanceBpm} from '../performanceModel.js';
import {createSessionEditor, readSession, writeSession, snapshotSection, fixedPerformancePads} from '../performanceSession.js';
import { createSessionPlayback } from '../sessionPlayback.js';
import { createPerformanceImport } from '../performanceImport.js';
import JamView from './JamView.jsx';
import './performance.css';
import './jamView.css';
const storage = () => { try { return window.localStorage; } catch { return null; } };
void JamView;
export default function PerformanceMode({ active, genreId, profileId = null, initialBpm, onBack, onImport }) {
  const [editor] = useState(() => createSessionEditor(readSession(storage(), genreId, profileId, initialBpm)));
  const { session, drafts, editingId } = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const [audio] = useState(() => createAudioEngine());
  const [status, setStatus] = useState({ mode: 'stopped' });
  const [playback] = useState(() => createSessionPlayback(audio, setStatus));
  const [message, setMessage] = useState('');
  const draft = drafts[editingId];
  const catalog = useMemo(() => performanceTemplates(genreId, profileId), [genreId, profileId]);
  const templates = useMemo(() => fixedPerformancePads(catalog), [catalog]);
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
    <JamView active={active} session={session} drafts={drafts} editingId={editingId} draft={draft}
      templates={templates} status={status} message={message} playback={playback} audio={audio}
      triggerPad={triggerPad} selectSection={selectSection}
      save={save} onComplete={onBack} editSection={(id) => editor.select(id)}
      addSection={(kind) => { editor.add(kind); persist(); }} renameSection={(name) => editor.edit({ name })}
      removeSection={(id) => { playback.stop(); editor.remove(id); persist(); }} />
  </section>;
}
