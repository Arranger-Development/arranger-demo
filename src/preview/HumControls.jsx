import { createElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { arrangeHumBacking, fitHumTiming, makeHumMelody } from './humArrangement.js';
import { canAdoptHumTempo } from '../app/jamPhraseContent.js';
import { decodeHumRecording, maxHumSeconds, playHumNotes } from './humAudio.js';
import './humPreview.css';

const initial = { phase: 'idle', text: '' };
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

function recordingError(error) {
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return '麦克风权限未开启。允许后再点「哼唱」。';
  if (error.name === 'NotFoundError' || error.name === 'NotReadableError') return '找不到可用的麦克风。检查设备后再试。';
  return '录音未完成，请再哼一次。';
}

function stopStream(stream) {
  stream?.getTracks().forEach(track => track.stop());
}

function releaseCapture(job) {
  clearTimeout(job.timer);
  try {
    if (job.recorder && job.recorder.state !== 'inactive') job.recorder.stop();
  } finally {
    stopStream(job.stream);
    job.stream = null;
  }
}

function stopAudition(audition) {
  audition.current?.();
  audition.current = null;
}

export default function HumControls({ active, enabled, projectStore, projectId, pauseJam, showRecording, emptyMelodyId, jamPlaying, children }) {
  const [status, setStatus] = useState(initial);
  const [take, setTake] = useState(null);
  const task = useRef(null), worker = useRef(null), available = useRef(false);
  const audition = useRef(null), recordingUrl = useRef(null);

  useLayoutEffect(() => {
    if (!enabled) return;
    available.current = true;
    return () => {
      available.current = false;
      const job = task.current;
      task.current = null;
      if (job) {
        releaseCapture(job);
        job.finishAnalysis?.(new Error('Recording cancelled'));
      }
      worker.current?.terminate();
      worker.current = null;
      stopAudition(audition);
      setStatus(initial);
    };
  }, [enabled]);

  useLayoutEffect(() => {
    if (!active) return;
    return () => {
      if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current);
      recordingUrl.current = null;
      setTake(null);
    };
  }, [active]);

  useEffect(() => { if (jamPlaying) stopAudition(audition); }, [jamPlaying]);

  const isAvailable = () => available.current && projectStore.current().id === projectId;
  const isCurrent = job => task.current === job && isAvailable();

  function getWorker() {
    if (worker.current) return worker.current;
    const analyzer = new Worker(new URL('./humPitch.worker.js', import.meta.url), { type: 'module' });
    analyzer.onerror = () => {
      if (worker.current !== analyzer) return;
      analyzer.terminate();
      worker.current = null;
      task.current?.finishAnalysis?.(new Error('无法加载识别模型'));
    };
    worker.current = analyzer;
    return analyzer;
  }

  function transcribe(job, samples) {
    return new Promise((resolve, reject) => {
      const analyzer = getWorker();
      const finish = (error, notes) => {
        clearTimeout(timer);
        analyzer.onmessage = null;
        job.finishAnalysis = null;
        if (error) reject(error); else resolve(notes);
      };
      const timer = setTimeout(() => {
        analyzer.terminate();
        if (worker.current === analyzer) worker.current = null;
        finish(new Error('旋律识别超时'));
      }, 20000);
      job.finishAnalysis = finish;
      analyzer.onmessage = ({ data }) => {
        if (!isCurrent(job) || worker.current !== analyzer) return;
        if (data.type === 'progress') setStatus({ phase: 'transcribing', text: `正在识别旋律 ${Math.round(data.progress * 100)}%` });
        if (data.type === 'result') finish(null, data.notes);
        if (data.type === 'error') finish(new Error(data.message));
      };
      try { analyzer.postMessage({ type: 'analyze', samples }, [samples.buffer]); }
      catch (error) { finish(error); }
    });
  }

  function publishTake(blob, details) {
    stopAudition(audition);
    if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current);
    recordingUrl.current = URL.createObjectURL(blob);
    const currentTake = { url: recordingUrl.current, ...details };
    setTake(currentTake);
    return currentTake;
  }

  function retryBacking(currentTake) {
    if (!isAvailable()) return;
    try {
      const { workspace } = projectStore.current();
      const melody = workspace.templates.melody.find(phrase => phrase.id === currentTake.melodyId);
      if (!melody) throw new Error('旋律格已移除');
      const backing = arrangeHumBacking(melody.bars, workspace.timbres?.melody ?? melody.timbreId);
      if (!projectStore.insertHumPhrases(backing, { projectId, melodyId: melody.id })) throw new Error('伴奏位置已被占用');
      setTake({ ...currentTake, backingReady: true });
      setStatus(initial);
    } catch { setStatus({ phase: 'idle', text: '配轨暂未完成，旋律已保留。' }); }
  }

  async function finishRecording(job, blob) {
    if (!isCurrent(job)) return;
    try {
      let notes;
      try {
        const samples = await decodeHumRecording(blob);
        if (!isCurrent(job)) return;
        const duration = samples.length / 22050;
        if (duration >= 0.18 && samples.some(sample => Math.abs(sample) > 0.008)) notes = await transcribe(job, samples);
      } catch {
        if (isCurrent(job)) {
          publishTake(blob);
          setStatus({ phase: 'idle', text: '旋律识别失败。可以听原声，再录一次。' });
        }
        return;
      }
      if (!isCurrent(job)) return;
      if (!notes?.length) {
        publishTake(blob);
        setStatus({ phase: 'idle', text: '没有识别到有效音符。靠近麦克风，再哼一次。' });
        return;
      }
      const { workspace } = projectStore.current();
      const emptyProject = canAdoptHumTempo(workspace, job.emptyMelodyId);
      const timing = fitHumTiming(notes, workspace.bpm, { emptyProject });
      const melody = makeHumMelody(notes, timing.bpm, timing);
      if (!melody) {
        publishTake(blob, { notes });
        setStatus({ phase: 'idle', text: '这段旋律的音域超出 Jam 范围。可以试听识别结果，或再哼一次。' });
        return;
      }
      let number = 1;
      while (workspace.templates.melody.some(phrase => phrase.name === `哼唱 ${number}`)) number++;
      const [phrase] = projectStore.insertHumPhrases([{ trackId: 'melody', name: `哼唱 ${number}`, bars: melody.bars }], { projectId, emptyMelodyId: job.emptyMelodyId, bpm: timing.bpm }) ?? [];
      if (!isCurrent(job)) return;
      const currentTake = publishTake(blob, { notes, melodyId: phrase?.id });
      if (!phrase) {
        setStatus({ phase: 'idle', text: '旋律未能加入当前项目，请重试。' });
        return;
      }
      showRecording(phrase);
      setStatus({ phase: 'arranging', text: '旋律已就绪，正在自动配三轨…' });
      await nextTask();
      if (isCurrent(job)) retryBacking(currentTake);
    } finally {
      if (isCurrent(job)) task.current = null;
    }
  }

  function stopRecording(job = task.current) {
    if (!job || !isCurrent(job) || job.recorder?.state !== 'recording') return;
    setStatus({ phase: 'transcribing', text: '正在处理录音…' });
    releaseCapture(job);
  }

  async function startRecording() {
    if (!isAvailable() || task.current || status.phase !== 'idle') return;
    const job = { emptyMelodyId };
    task.current = job;
    stopAudition(audition);
    setStatus({ phase: 'requesting', text: '正在打开麦克风…' });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('Microphone unavailable', 'NotFoundError');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (!isCurrent(job)) {
        stopStream(stream);
        return;
      }
      job.stream = stream;
      pauseJam();
      const chunks = [];
      const recorder = job.recorder = new MediaRecorder(stream);
      recorder.ondataavailable = ({ data }) => { if (isCurrent(job) && data.size) chunks.push(data); };
      recorder.onstop = () => {
        if (!isCurrent(job)) return;
        releaseCapture(job);
        if (chunks.length) void finishRecording(job, new Blob(chunks, { type: recorder.mimeType }));
        else {
          task.current = null;
          setStatus({ phase: 'idle', text: '没有录到声音，请重试。' });
        }
      };
      recorder.onerror = () => {
        if (!isCurrent(job)) return;
        task.current = null;
        releaseCapture(job);
        setStatus({ phase: 'idle', text: '录音中断，请重试。' });
      };
      recorder.start();
      job.timer = setTimeout(() => stopRecording(job), maxHumSeconds * 1000);
      setStatus({ phase: 'recording', text: '正在录音 · 最长 10 秒' });
      try { getWorker().postMessage({ type: 'warmup' }); } catch { /* Report a model error when the recording is processed. */ }
    } catch (error) {
      releaseCapture(job);
      if (isCurrent(job)) {
        task.current = null;
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
  const feedback = (status.text || take) && <div className="jam-hum-feedback" role="group" aria-label="哼唱结果">
    {status.text && <span role="status">{status.text}</span>}
    {take?.url && <button type="button" disabled={recording || busy} onClick={() => {
      stopAudition(audition); pauseJam();
      const audio = new Audio(take.url);
      const stop = () => audio.pause();
      audition.current = stop;
      void audio.play().catch(() => {
        if (audition.current === stop && isAvailable()) setStatus({ phase: 'idle', text: '原声播放失败。' });
      });
    }}>听原声</button>}
    {take?.notes?.length > 0 && <button type="button" disabled={recording || busy} onClick={() => {
      stopAudition(audition); pauseJam(); audition.current = playHumNotes(take.notes);
    }}>听识别旋律</button>}
    {take?.melodyId && !take.backingReady && !busy && !recording && <button type="button" onClick={() => retryBacking(take)}>重试配轨</button>}
  </div>;
  return children(button, feedback);
}
