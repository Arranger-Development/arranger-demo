import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, ArrowRightToLine, Check, Drum, Guitar, Music2, Piano, Play, Save, Square } from 'lucide-react';
import createAudioEngine from '../../audio/createAudioEngine.js';
import { getDrumTemplateGenre } from '../../data/drumStyleTemplates.js';
import { AI_PERFORMANCE_PROFILE_ID } from '../../data/aiPerformanceTemplates.js';
import {
  PERFORMANCE_LABELS, PERFORMANCE_TRACKS, createPerformanceMatrix, createPerformanceSequence,
  hasSelection, normalizePerformanceBpm, performanceTemplates, readPerformanceSession,
  sameSelection, selectionSummary, writePerformanceSession,
} from '../performanceModel.js';
import { createPerformancePlayback } from '../performancePlayback.js';
import './performance.css';
import { createPerformanceEditor } from '../performanceEditor.js';
import { mapPerformanceKeyboard, performanceKeyLabel } from '../../input/performanceInput.js';
import { createPerformanceImport } from '../performanceImport.js';

// This repository's lint parser does not count JSX component names as reads.
void [ArrowRightToLine, ArrowLeft, ArrowRightToLine, Check, Play, Save, Square, PerformanceLoops];

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

export default function PerformanceMode({ active, genreId, profileId = null, initialBpm, onBack, onImport, controlsRef, hardwareInput }) {
  const aiTemplates = profileId === AI_PERFORMANCE_PROFILE_ID;
  const [editor] = useState(() => createPerformanceEditor(readPerformanceSession(browserStorage(), genreId, initialBpm, profileId)));
  const { session, drafts, selectedLoop } = useSyncExternalStore(editor.subscribe, editor.getSnapshot);
  const [status, setStatus] = useState({ mode: 'stopped', loading: false, bar: 0, step: 0, error: '' });
  const [message, setMessage] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [sequenceIndices, setSequenceIndices] = useState([]);
  const [playback] = useState(() => createPerformancePlayback(createAudioEngine(), setStatus, {
    melodyTimbreIds: aiTemplates ? ['piano'] : ['yangqin', 'blues'],
    melodyPlaybackMode: aiTemplates ? 'natural' : undefined,
    additionalTimbres: aiTemplates ? [{ trackId: 'chord', timbreId: 'piano', playbackMode: 'natural' }] : [],
  }));
  const importingRef = useRef(false);
  const canImport = session.saved.some(hasSelection);
  const titleRef = useRef(null);
  const saveTimer = useRef(null);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const templates = useMemo(() => performanceTemplates(genreId, profileId), [genreId, profileId]);
  const templateColumns = Math.max(...PERFORMANCE_TRACKS.map((track) => templates[track].length));
  const draft = drafts[selectedLoop];


  useEffect(() => {
    if (active) titleRef.current?.focus();
    return () => { playback.stop(); clearTimeout(saveTimer.current); };
  }, [active, playback]);

  function persist(next) {
    const stored = writePerformanceSession(browserStorage(), genreId, next, profileId);
    setStorageError(!stored);
    return stored;
  }
  function preview(selection) {
    if (hasSelection(selection)) playback.preview(createPerformanceMatrix(selection, genreId, profileId), editor.getSnapshot().session.bpm);
    else playback.stop();
  }
  function resetSaveFeedback() {
    clearTimeout(saveTimer.current);
    setSaveFeedback(false);
  }
  function selectTemplate(trackId, templateId) {
    resetSaveFeedback();
    const next = editor.toggleTemplate(trackId, templateId);
    preview(next);
    setMessage('');
  }
  function selectLoop(index) {
    resetSaveFeedback();
    playback.stop();
    const selection = editor.selectLoop(index);
    if (selection) preview(selection);
    setMessage('');
  }
  function save() {
    resetSaveFeedback();
    const stored = persist(editor.save());
    if (stored) {
      setSaveFeedback(true);
      saveTimer.current = setTimeout(() => setSaveFeedback(false), 1400);
    }
    setMessage('');
  }
  function togglePlayback() {
    // Read the controller synchronously so rapid clicks also cancel loading.
    if (playback.isActive()) { playback.stop(); setMessage(''); return; }
    const currentSession = editor.getSnapshot().session;
    const sequence = createPerformanceSequence(currentSession.saved, genreId, profileId);
    if (!sequence.indices.length) {
      setMessage('先保存至少一个 Loop，再播放整组。');
      return;
    }
    setSequenceIndices(sequence.indices);
    playback.sequence(sequence, currentSession.bpm);
    setMessage('');
  }
  function changeBpm(value) {
    const bpm = normalizePerformanceBpm(value);
    persist(editor.setBpm(bpm));
    playback.setTempo(bpm);
  }
  function importArrangement() {
    if (importingRef.current || !active || !canImport) return;
    importingRef.current = true;
    try {
      const snapshot = createPerformanceImport({ ...editor.getSnapshot().session, genreId, profileId });
      playback.stop();
      resetSaveFeedback();
      onImport(snapshot);
      setMessage('');
    } catch (error) {
      setMessage(error.message || '导入失败，原编曲已保留。');
    } finally {
      importingRef.current = false;
    }
  }
  function back() { resetSaveFeedback(); playback.stop(); onBack(); }

  // The bridge is refreshed at commit time. All actions read the synchronous editor
  // snapshot, so several inputs before the next React render are still ordered.
  useLayoutEffect(() => {
    if (!active || !controlsRef) return undefined;
    const controls = {
      templates,
      dispatch(command) {
        if (importingRef.current) return;
        if (command.type === 'template') selectTemplate(command.trackId, command.templateId);
        else if (command.type === 'loop') selectLoop(command.index);
        else if (command.type === 'save') save();
        else if (command.type === 'togglePlayback') togglePlayback();
      },
      getSurface() {
        const current = editor.getSnapshot();
        return { templates, drafts: current.drafts, saved: current.session.saved,
          selectedLoop: current.selectedLoop, status, sequenceIndices,
          progress: playback.getProgress(), beatPhase: playback.getBeatPhase(), saveFeedback, storageError };
      },
    };
    controlsRef.current = controls;
    return () => { if (controlsRef.current === controls) controlsRef.current = null; };
  });

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event) => {
      const command = mapPerformanceKeyboard(event, templates);
      if (!command || importingRef.current) return;
      event.preventDefault();
      selectTemplate(command.trackId, command.templateId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const connected = hardwareInput?.status === 'connected';
  const connecting = hardwareInput?.status === 'connecting';
  const connectionLabel = connected ? 'Launchpad 已连接' : connecting ? '连接中…' : '连接 Launchpad';
  function connectHardware() {
    void playback.unlockAudio().catch((error) => setMessage(error.message || '音频未能启动，请重试'));
    void hardwareInput?.onConnect();
  }

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
          <span className="performance-eyebrow">{aiTemplates ? 'AI 多模态 · 每段 2–4 小节' : `${getDrumTemplateGenre(genreId).label} · 每段 2 小节`}</span>
          <button type="button" className="performance-connect" onClick={connectHardware}
            disabled={connecting || hardwareInput?.status === 'unsupported'}
            title="Launchpad X 请手动切换至 Programmer Mode" aria-label={connectionLabel}>
            <span className={`performance-connection-light ${connected ? 'is-connected' : ''}`} aria-hidden="true" />
            {connectionLabel}
          </button>
          {hardwareInput?.errorMessage || hardwareInput?.ledErrorMessage || hardwareInput?.status === 'unsupported'
            ? <p className="performance-connection-error" role="status">{hardwareInput.errorMessage || hardwareInput.ledErrorMessage || '此浏览器不支持 MIDI，请使用支持 Web MIDI 的浏览器连接。'}</p> : null}
        </div>

        <div className="performance-workbench">
          <div className="performance-grid" aria-label="四轨模板" style={{ '--template-columns': templateColumns }}>
            {PERFORMANCE_TRACKS.map((trackId) => {
              const Icon = icons[trackId];
              void Icon;
              return <div className="performance-row" data-track={trackId} key={trackId} role="group" aria-label={`${PERFORMANCE_LABELS[trackId]}模板`}>
                <div className="performance-track-label"><Icon size={22} /><strong>{PERFORMANCE_LABELS[trackId]}</strong></div>
                {templates[trackId].map((template, index) => {
                  const selected = draft[trackId] === template.id;
                  return <button type="button" className={`performance-pad ${selected ? 'is-selected' : ''}`}
                    key={template.id} aria-keyshortcuts={performanceKeyLabel(trackId, index)} title={`${template.name} · ${performanceKeyLabel(trackId, index)}`} aria-label={`${PERFORMANCE_LABELS[trackId]}：${template.name}`}
                    aria-pressed={selected} onClick={() => selectTemplate(trackId, template.id)}>
                    <span className="performance-pad-top"><span className="performance-key-hint" aria-hidden="true">{performanceKeyLabel(trackId, index)}</span>{selected ? <Check size={16} /> : <Icon size={16} />}</span>
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
            <button type="button" className="performance-save performance-import" onClick={importArrangement}
              disabled={!canImport} title={canImport ? '将已保存的 Loop 导入编曲，可撤销' : '请先保存一段 Loop'}>
              <ArrowRightToLine size={14} aria-hidden="true" /><span>导入编曲</span>
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
