import { createElement, useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { arrangeHumMelody, estimateHumBpm, makeHumMelody } from './humArrangement.js';
import { decodeHumRecording, maxHumSeconds, playHumNotes } from './humAudio.js';
import './humPreview.css';

const initial = { phase: 'idle', text: '' };
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

function recordingError(error) {
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return '麦克风权限未开启。允许后再点「哼唱」。';
  if (error.name === 'NotFoundError' || error.name === 'NotReadableError') return '找不到可用的麦克风。检查设备后再试。';
  return '录音未完成，请再哼一次。';
}

export default function HumControls({ projectStore, projectId, pauseJam, revealSlot, jamPlaying, children }) {
  const [status, setStatus] = useState(initial);
  const [take, setTake] = useState(null);
  const capture = useRef(null), worker = useRef(null), analysis = useRef(null);
  const audition = useRef(null), active = useRef(true), recordingUrl = useRef(null);

  function stopAudition() {
    audition.current?.();
    audition.current = null;
  }

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      const current = capture.current;
      capture.current = null;
      clearTimeout(current?.timer);
      current?.stream?.getTracks().forEach(track => track.stop());
      analysis.current?.(new Error('Preview closed'));
      worker.current?.terminate();
      worker.current = null;
      stopAudition();
      if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current);
    };
  }, []);

  useEffect(() => { if (jamPlaying) stopAudition(); }, [jamPlaying]);

  function getWorker() {
    if (worker.current) return worker.current;
    const analyzer = new Worker(new URL('./humPitch.worker.js', import.meta.url), { type: 'module' });
    analyzer.onerror = () => {
      analyzer.terminate();
      if (worker.current === analyzer) worker.current = null;
      analysis.current?.(new Error('无法加载识别模型'));
    };
    worker.current = analyzer;
    return analyzer;
  }

  function transcribe(samples) {
    return new Promise((resolve, reject) => {
      const analyzer = getWorker();
      const finish = (error, notes) => {
        clearTimeout(timer);
        analyzer.onmessage = null;
        analysis.current = null;
        if (error) reject(error); else resolve(notes);
      };
      const timer = setTimeout(() => {
        analyzer.terminate();
        worker.current = null;
        finish(new Error('旋律识别超时'));
      }, 20000);
      analysis.current = finish;
      analyzer.onmessage = ({ data }) => {
        if (data.type === 'progress') setStatus({ phase: 'transcribing', text: `正在识别旋律 ${Math.round(data.progress * 100)}%` });
        if (data.type === 'result') finish(null, data.notes);
        if (data.type === 'error') finish(new Error(data.message));
      };
      try { analyzer.postMessage({ type: 'analyze', samples }, [samples.buffer]); }
      catch (error) { finish(error); }
    });
  }

  function addBacking(currentTake) {
    const melody = projectStore.current().workspace.templates.melody.find(phrase => phrase.id === currentTake.melodyId);
    if (!melody) throw new Error('旋律格已移除');
    const backing = Object.entries(arrangeHumMelody(melody.bars, projectStore.current().workspace.timbres?.melody ?? melody.timbreId)).map(([trackId, bars]) => ({ trackId, bars }));
    if (!projectStore.insertHumPhrases(backing, { projectId, melodyId: melody.id })) throw new Error('伴奏位置已被占用');
    setTake({ ...currentTake, backingReady: true });
    setStatus(initial);
  }

  async function finishRecording(blob) {
    if (!active.current || projectStore.current().id !== projectId) return;
    if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current);
    recordingUrl.current = URL.createObjectURL(blob);
    const original = { url: recordingUrl.current };
    setTake(original);
    setStatus({ phase: 'transcribing', text: '正在识别旋律…' });
    let notes;
    try {
      const samples = await decodeHumRecording(blob);
      if (!active.current) return;
      const duration = samples.length / 22050;
      if (duration >= 0.18 && samples.some(sample => Math.abs(sample) > 0.008)) notes = await transcribe(samples);
    } catch {
      if (active.current) setStatus({ phase: 'idle', text: '旋律识别失败。可以听原声，再录一次。' });
      return;
    }
    if (!active.current || projectStore.current().id !== projectId) return;
    if (!notes?.length) {
      setStatus({ phase: 'idle', text: '没有识别到有效音符。靠近麦克风，再哼一次。' });
      return;
    }
    const { workspace } = projectStore.current();
    const estimate = Object.values(workspace.templates).every(row => !row.length) ? estimateHumBpm(notes) : null;
    const melody = makeHumMelody(notes, estimate ?? workspace.bpm);
    if (!melody) {
      setTake({ ...original, notes });
      setStatus({ phase: 'idle', text: '这段旋律的音域超出 Jam 范围。可以试听识别结果，或再哼一次。' });
      return;
    }
    let number = 1;
    while (workspace.templates.melody.some(phrase => phrase.name === `哼唱 ${number}`)) number++;
    const [phrase] = projectStore.insertHumPhrases([{ trackId: 'melody', name: `哼唱 ${number}`, bars: melody.bars }], { projectId, bpm: estimate }) ?? [];
    if (!phrase) {
      setStatus({ phase: 'idle', text: '旋律未能加入当前项目，请重试。' });
      return;
    }
    const currentTake = { ...original, notes, melodyId: phrase.id, shift: melody.shift };
    setTake(currentTake);
    revealSlot(phrase.slotIndex);
    setStatus({ phase: 'arranging', text: '旋律已就绪，正在自动配三轨…' });
    await nextTask();
    if (!active.current || projectStore.current().id !== projectId) return;
    retryBacking(currentTake);
  }

  function retryBacking(currentTake) {
    try { addBacking(currentTake); }
    catch { setStatus({ phase: 'idle', text: '配轨暂未完成，旋律已保留。' }); }
  }

  function stopRecording(current = capture.current) {
    if (!current?.recorder || current.recorder.state === 'inactive') return;
    clearTimeout(current.timer);
    setStatus({ phase: 'transcribing', text: '正在处理录音…' });
    current.recorder.stop();
    current.stream.getTracks().forEach(track => track.stop());
  }

  async function startRecording() {
    if (capture.current || status.phase !== 'idle') return;
    const current = {};
    capture.current = current;
    stopAudition();
    setStatus({ phase: 'requesting', text: '正在打开麦克风…' });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('Microphone unavailable', 'NotFoundError');
      current.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (capture.current !== current || !active.current) {
        current.stream.getTracks().forEach(track => track.stop());
        return;
      }
      pauseJam();
      const chunks = [];
      const recorder = current.recorder = new MediaRecorder(current.stream);
      recorder.ondataavailable = ({ data }) => { if (data.size) chunks.push(data); };
      recorder.onstop = () => {
        if (capture.current !== current) return;
        clearTimeout(current.timer);
        current.stream.getTracks().forEach(track => track.stop());
        capture.current = null;
        if (chunks.length) void finishRecording(new Blob(chunks, { type: recorder.mimeType }));
        else setStatus({ phase: 'idle', text: '没有录到声音，请重试。' });
      };
      recorder.onerror = () => {
        if (capture.current !== current) return;
        clearTimeout(current.timer);
        current.stream.getTracks().forEach(track => track.stop());
        capture.current = null;
        setStatus({ phase: 'idle', text: '录音中断，请重试。' });
      };
      recorder.start();
      current.timer = setTimeout(() => stopRecording(current), maxHumSeconds * 1000);
      setStatus({ phase: 'recording', text: '正在录音 · 最长 10 秒' });
      try { getWorker().postMessage({ type: 'warmup' }); } catch { /* Report a model error when the recording is processed. */ }
    } catch (error) {
      current.stream?.getTracks().forEach(track => track.stop());
      if (capture.current === current) {
        capture.current = null;
        setStatus({ phase: 'idle', text: recordingError(error) });
      }
    }
  }

  const recording = status.phase === 'recording';
  const busy = status.phase !== 'idle' && !recording;
  const button = <button type="button" className="jam-hum-record" disabled={busy} aria-pressed={recording}
    onClick={() => recording ? stopRecording() : void startRecording()}>
    {createElement(recording ? Square : Mic, { size: 12 })}{recording ? '停止' : '哼唱'}
  </button>;
  const octaveNotice = take?.shift ? `Jam 旋律${take.shift > 0 ? '升高' : '降低'} ${Math.abs(take.shift / 12)} 个八度` : '';
  const feedbackText = [status.text, octaveNotice].filter(Boolean).join(' · ');
  const feedback = (status.text || take) && <div className="jam-hum-feedback" role="group" aria-label="哼唱结果">
    {feedbackText && <span role="status">{feedbackText}</span>}
    {take?.url && <button type="button" disabled={recording} onClick={() => {
      stopAudition(); pauseJam();
      const audio = new Audio(take.url);
      audition.current = () => audio.pause();
      void audio.play().catch(() => setStatus({ phase: status.phase, text: '原声播放失败。' }));
    }}>听原声</button>}
    {take?.notes?.length > 0 && <button type="button" disabled={recording} onClick={() => {
      stopAudition(); pauseJam(); audition.current = playHumNotes(take.notes);
    }}>听识别旋律</button>}
    {take?.melodyId && !take.backingReady && !busy && !recording && <button type="button" onClick={() => retryBacking(take)}>重试配轨</button>}
  </div>;
  return children(button, feedback);
}
