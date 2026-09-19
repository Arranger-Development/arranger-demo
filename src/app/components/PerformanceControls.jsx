import { useEffect, useRef, useState } from 'react';
import { PERFORMANCE_LABELS as LABELS } from '../performanceModel.js';
import { TIMBRE_OPTIONS } from '../performanceSession.js';

void HoldRepeatButton;

function HoldRepeatButton({ audio, track, bpm, division }) {
  const [held, setHeld] = useState(false);
  const release = () => { audio.setPerformanceEffect(track, { held: false }); setHeld(false); };
  const press = () => { audio.setPerformanceEffect(track, { held: true, bpm, division }); setHeld(true); };
  useEffect(() => {
    const blur = () => { audio.setPerformanceEffect(track, { held: false }); setHeld(false); };
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('blur', blur); audio.setPerformanceEffect(track, { held: false }); };
  }, [audio, track]);
  return <button type="button" aria-label={`${LABELS[track]}按住重复`} aria-pressed={held}
    onPointerDown={(e) => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); press(); }}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
    onKeyDown={(e) => { if ([' ', 'Enter'].includes(e.key) && !e.repeat) { e.preventDefault(); press(); } }}
    onKeyUp={(e) => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); release(); } }}>{held ? '重复中 · 松开恢复' : '按住重复'}</button>;
}

export function Progress({ playback, id, bars, running }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!running) { if (ref.current) ref.current.style.transform = 'scaleX(0)'; return undefined; }
    let frame;
    const tick = () => {
      const p = playback.getProgress();
      const progress = p?.id === id ? (bars ? (p.localStep % (bars * 16)) / (bars * 16) : p.fraction) : 0;
      if (ref.current) ref.current.style.transform = `scaleX(${progress})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playback, id, bars, running]);
  return <span className="pw-progress" aria-hidden="true"><span ref={ref} /></span>;
}

export function TrackControls({ track, session, draft, updateTimbre, changeMix, audio, live, expanded = false, repeatEnabled = true, beginMixEdit, commitMixEdit }) {
  const [cutoff, setCutoff] = useState(20000);
  const [division, setDivision] = useState(8);
  return <div className="pw-track-controls" data-track={track}>
    <strong>{LABELS[track]}</strong>
    {!live && <select aria-label={`${LABELS[track]}音色`} value={draft.timbres[track]} onChange={(e) => updateTimbre(track, e.target.value)}>
      {TIMBRE_OPTIONS[track].map((id, i) => <option key={id} value={id}>音色 {i + 1} · 占位</option>)}
    </select>}
    <label>音量 <output>{session.mutedTracks[track] || session.volumes[track] === -24 ? '静音' : `${session.volumes[track]} dB`}</output>
      <input aria-label={`${LABELS[track]}音量`} onPointerDown={beginMixEdit} onPointerUp={commitMixEdit} onPointerCancel={commitMixEdit} onKeyDown={beginMixEdit} onKeyUp={commitMixEdit} onBlur={commitMixEdit} type="range" min="-24" max="6" value={session.volumes[track]} onChange={(e) => changeMix(track, Number(e.target.value))} />
    </label>
    <details className="pw-fx-details" open={!live || expanded ? true : undefined}><summary hidden={!live || expanded}>现场效果</summary><label>低通 <output>{cutoff === 20000 ? '关闭' : `${cutoff} Hz`}</output>
      <input aria-label={`${LABELS[track]}低通滤波`} type="range" min="100" max="20000" step="100" value={cutoff} onChange={(e) => {
        const value = Number(e.target.value); setCutoff(value); audio.setPerformanceEffect(track, { cutoff: value });
      }} />
    </label>
    <div className="pw-repeat-control"><select aria-label={`${LABELS[track]}重复器长度`} value={division} onChange={(e) => setDivision(Number(e.target.value))}>
      {[4, 8, 16].map((d) => <option key={d} value={d}>1/{d}</option>)}
    </select>{repeatEnabled ? <HoldRepeatButton audio={audio} track={track} bpm={session.bpm} division={division} />
      : <button type="button" disabled>播放后按住重复</button>}</div></details>
  </div>;
}
