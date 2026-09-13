import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Drum, Guitar, Music2, Piano, Play, Save, Square } from 'lucide-react';
import createAudioEngine from '../../audio/createAudioEngine.js';
import { getDrumTemplateGenre } from '../../data/drumStyleTemplates.js';
import {
  PERFORMANCE_LABELS, PERFORMANCE_TRACKS, createPerformanceMatrix, createPerformanceSequence,
  hasSelection, normalizePerformanceBpm, performanceTemplates, readPerformanceSession,
  sameSelection, selectionSummary, writePerformanceSession,
} from '../performanceModel.js';
import { createPerformancePlayback } from '../performancePlayback.js';
import './performance.css';

// This repository's lint parser does not count JSX component names as reads.
void [ArrowLeft, Check, Play, Save, Square, PerformanceLoops];

const icons = { drums: Drum, chord: Piano, bass: Guitar, melody: Music2 };
function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

// Only the five Loop controls repaint each frame; the pad grid stays still.
function PerformanceLoops({ active, playback, status, sequenceIndices, selectedLoop, drafts, saved, onSelect }) {
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    if (!active) return undefined;
    let frame;
    function update() {
      setProgress(playback.getProgress());
      frame = requestAnimationFrame(update);
    }
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [active, playback]);
  const running = active && status.mode !== 'stopped' && !status.loading && progress !== null;
  const playingLoop = running ? (status.mode === 'preview' ? selectedLoop : sequenceIndices[progress.segment]) : null;
  return <div className="performance-loops" aria-label="五个 Loop">
    {drafts.map((selection, index) => {
      const unsaved = !sameSelection(selection, saved[index]);
      const playing = index === playingLoop;
      return <button type="button" key={index} onClick={() => onSelect(index)}
        className={`performance-loop ${index === selectedLoop ? 'is-editing' : ''} ${playing ? 'is-playing' : ''}`}
        aria-label={`编辑 Loop ${index + 1}`} aria-pressed={index === selectedLoop}>
        <span className="performance-loop-dial">
          <svg className="performance-loop-progress" viewBox="0 0 64 64" aria-hidden="true">
            <circle className="performance-loop-rail" cx="32" cy="32" r="29" />
            <circle className="performance-loop-elapsed" cx="32" cy="32" r="29" pathLength="100"
              strokeDasharray="100" strokeDashoffset={playing ? 100 * (1 - progress.fraction) : 100} />
          </svg>
          <span className="performance-loop-circle">Loop {index + 1}</span>
        </span>
        <strong>{hasSelection(saved[index]) ? selectionSummary(saved[index]) : '空位'}</strong>
        <small>{playing ? '播放中' : unsaved ? '未保存' : hasSelection(saved[index]) ? '已保存' : '跳过'}</small>
      </button>;
    })}
  </div>;
}

export default function PerformanceMode({ active, genreId, initialBpm, onBack }) {
  const [session, setSession] = useState(() => readPerformanceSession(browserStorage(), genreId, initialBpm));
  const [drafts, setDrafts] = useState(() => session.saved.map((selection) => ({ ...selection })));
  const [selectedLoop, setSelectedLoop] = useState(0);
  const [status, setStatus] = useState({ mode: 'stopped', loading: false, bar: 0, step: 0, error: '' });
  const [message, setMessage] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [sequenceIndices, setSequenceIndices] = useState([]);
  const [playback] = useState(() => createPerformancePlayback(createAudioEngine(), setStatus));
  const titleRef = useRef(null);
  const saveTimer = useRef(null);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const templates = useMemo(() => performanceTemplates(genreId), [genreId]);
  const draft = drafts[selectedLoop];


  useEffect(() => {
    if (active) titleRef.current?.focus();
    return () => { playback.stop(); clearTimeout(saveTimer.current); };
  }, [active, playback]);

  function persist(next) {
    setSession(next);
    const stored = writePerformanceSession(browserStorage(), genreId, next);
    setStorageError(!stored);
    return stored;
  }
  function preview(selection) {
    if (hasSelection(selection)) playback.preview(createPerformanceMatrix(selection, genreId), session.bpm);
    else playback.stop();
  }
  function resetSaveFeedback() {
    clearTimeout(saveTimer.current);
    setSaveFeedback(false);
  }
  function selectTemplate(trackId, templateId) {
    resetSaveFeedback();
    const next = { ...draft, [trackId]: draft[trackId] === templateId ? null : templateId };
    setDrafts((current) => current.map((value, index) => index === selectedLoop ? next : value));
    preview(next);
    setMessage('');
  }
  function selectLoop(index) {
    resetSaveFeedback();
    playback.stop();
    setSelectedLoop(index);
    preview(drafts[index]);
    setMessage('');
  }
  function save() {
    resetSaveFeedback();
    const stored = persist({ ...session, saved: session.saved.map((value, index) => index === selectedLoop ? { ...draft } : value) });
    if (stored) {
      setSaveFeedback(true);
      saveTimer.current = setTimeout(() => setSaveFeedback(false), 1400);
    }
    setMessage('');
  }
  function togglePlayback() {
    // Read the controller synchronously so rapid clicks also cancel loading.
    if (playback.isActive()) { playback.stop(); setMessage(''); return; }
    const sequence = createPerformanceSequence(session.saved, genreId);
    if (!sequence.indices.length) {
      setMessage('先保存至少一个 Loop，再播放整组。');
      return;
    }
    setSequenceIndices(sequence.indices);
    playback.sequence(sequence, session.bpm);
    setMessage('');
  }
  function changeBpm(value) {
    const bpm = normalizePerformanceBpm(value);
    persist({ ...session, bpm });
    playback.setTempo(bpm);
  }
  function back() { resetSaveFeedback(); playback.stop(); onBack(); }

  return (
    <section className="performance-mode" hidden={!active} aria-label="演奏模式">
      <header className="performance-header">
        <button type="button" className="performance-back" onClick={back}><ArrowLeft size={17} />返回编曲</button>
        <div className="performance-title">
          <span className="performance-eyebrow">PROJECT ARRANGER / PERFORMANCE</span>
          <h1 ref={titleRef} tabIndex={-1}>演奏模式</h1>
        </div>
        <label className="performance-tempo">BPM
          <input aria-label="演奏速度 BPM" type="number" min="40" max="240" key={session.bpm}
            defaultValue={session.bpm} onBlur={(event) => changeBpm(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
        </label>
      </header>

      <main className="performance-body">
        <div className="performance-intro">
          <span className="performance-eyebrow">{getDrumTemplateGenre(genreId).label} · 每段 2 小节</span>
        </div>

        <div className="performance-workbench">
          <div className="performance-grid" aria-label="四轨模板">
            {PERFORMANCE_TRACKS.map((trackId) => {
              const Icon = icons[trackId];
              void Icon;
              return <div className="performance-row" data-track={trackId} key={trackId} role="group" aria-label={`${PERFORMANCE_LABELS[trackId]}模板`}>
                <div className="performance-track-label"><Icon size={22} /><strong>{PERFORMANCE_LABELS[trackId]}</strong></div>
                {templates[trackId].map((template, index) => {
                  const selected = draft[trackId] === template.id;
                  return <button type="button" className={`performance-pad ${selected ? 'is-selected' : ''}`}
                    key={template.id} aria-label={`${PERFORMANCE_LABELS[trackId]}：${template.name}`}
                    aria-pressed={selected} onClick={() => selectTemplate(trackId, template.id)}>
                    <span className="performance-pad-top"><span>0{index + 1}</span>{selected ? <Check size={16} /> : <Icon size={16} />}</span>
                    <strong>{template.name}</strong>
                  </button>;
                })}
              </div>;
            })}
          </div>

          <div className="performance-save-panel">
            <button type="button" className="performance-save" onClick={save} aria-live="polite">
              {saveFeedback ? <Check size={14} aria-hidden="true" /> : <Save size={14} aria-hidden="true" />}
              <span>{saveFeedback ? '已保存' : `保存到 Loop ${selectedLoop + 1}`}</span>
            </button>
          </div>
        </div>

        <div className="performance-sequence">
          <div className="performance-transport">
            <button type="button" className="performance-play" onClick={togglePlayback}
              aria-label={status.mode === 'stopped' ? '播放整组' : status.loading ? '取消加载' : '停止播放'}
              title={status.mode === 'stopped' ? '播放整组' : status.loading ? '取消加载' : '停止播放'}>
              {status.mode === 'stopped' ? <Play size={23} fill="currentColor" aria-hidden="true" />
                : <Square size={21} fill="currentColor" aria-hidden="true" />}
            </button>
          </div>
          <PerformanceLoops active={active} playback={playback} status={status} sequenceIndices={sequenceIndices}
            selectedLoop={selectedLoop} drafts={drafts} saved={session.saved} onSelect={selectLoop} />
        </div>
        <footer className="performance-footer" role="status">{status.error || message}</footer>
        {storageError ? <p className="performance-warning" role="alert">浏览器暂时无法保存，当前页面仍可使用；关闭页面后这些更改会丢失。</p> : null}
      </main>
    </section>
  );
}
