import { useEffect, useRef } from 'react';
import { PERFORMANCE_LABELS as LABELS } from '../performanceModel.js';
import { TIMBRE_OPTIONS } from '../performanceSession.js';
export function TrackControls({ track, draft, updateTimbre }) {
  return <label>{LABELS[track]}音色<select aria-label={`${LABELS[track]}音色`} value={draft.timbres[track]} onChange={e => updateTimbre(track,e.target.value)}>{TIMBRE_OPTIONS[track].map((id,i) => <option key={id} value={id}>音色 {i+1} · 占位</option>)}</select></label>;
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

