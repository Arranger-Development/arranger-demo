import { useEffect, useRef, useSyncExternalStore } from 'react';
import { PERFORMANCE_LABELS as LABELS } from '../performanceModel.js';
import './djEffects.css';

void [RepeatPads, FilterKnob];

function RepeatPads({ controller, track, bpm, enabled }) {
  const held = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => {
    if (!enabled) controller.reset();
    const release = () => controller.reset();
    window.addEventListener('blur', release);
    return () => { window.removeEventListener('blur', release); controller.reset(); };
  }, [controller, enabled]);
  return <div className="dj-repeat-pads" role="group" aria-label={`${LABELS[track]}重复器`}>
    {[4, 8, 16].map((division) => <button type="button" key={division} disabled={!enabled}
      className="dj-repeat-pad" aria-label={`${LABELS[track]}按住重复 1/${division}`} aria-pressed={held === division}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        controller.press(`pointer:${e.pointerId}:${division}`, division, bpm);
      }}
      onPointerUp={(e) => controller.release(`pointer:${e.pointerId}:${division}`)}
      onPointerCancel={(e) => controller.release(`pointer:${e.pointerId}:${division}`)}
      onLostPointerCapture={(e) => controller.release(`pointer:${e.pointerId}:${division}`)}
      onBlur={() => { controller.release(`key:${division}: `); controller.release(`key:${division}:Enter`); }}
      onKeyDown={(e) => {
        if (![' ', 'Enter'].includes(e.key)) return;
        e.preventDefault();
        if (!e.repeat) controller.press(`key:${division}:${e.key}`, division, bpm);
      }}
      onKeyUp={(e) => {
        if (![' ', 'Enter'].includes(e.key)) return;
        e.preventDefault(); controller.release(`key:${division}:${e.key}`);
      }}><span className="dj-pad-led" aria-hidden="true" />1/{division}</button>)}
  </div>;
}

function FilterKnob({ track, value, onChange }) {
  const drag = useRef(null);
  const update = (next) => onChange(Math.max(100, Math.min(20000, Math.round(next / 100) * 100)));
  const end = () => { drag.current = null; };
  useEffect(() => {
    window.addEventListener('blur', end);
    return () => window.removeEventListener('blur', end);
  }, []);
  return <div className="dj-knob" role="slider" tabIndex={0} aria-label={`${LABELS[track]}低通滤波`}
    aria-valuemin={100} aria-valuemax={20000} aria-valuenow={value} aria-valuetext={value === 20000 ? '关闭' : `${value} Hz`}
    aria-orientation="vertical" style={{ '--dj-angle': `${-135 + ((value - 100) / 19900) * 270}deg` }}
    onPointerDown={(e) => {
      if (e.button !== 0 || drag.current) return;
      e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, y: e.clientY, value };
    }}
    onPointerMove={(e) => {
      const start = drag.current;
      if (start?.id === e.pointerId) update(start.value + (start.y - e.clientY) * (19900 / 150));
    }} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onBlur={end}
    onKeyDown={(e) => {
      const steps = { ArrowUp: 100, ArrowRight: 100, ArrowDown: -100, ArrowLeft: -100, PageUp: 1000, PageDown: -1000 };
      if (e.key in steps) { e.preventDefault(); update(value + steps[e.key]); }
      else if (['Home', 'End', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'Home') update(100);
        if (e.key === 'End') update(20000);
      }
    }}><span className="dj-knob-face" aria-hidden="true"><span /></span></div>;
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

export function TrackControls({ track, session, changeMix, effects, cutoff, repeatEnabled = false, beginMixEdit, commitMixEdit }) {
  const volume = session.volumes[track];
  return <div className="dj-controls" data-track={track}>
    <div className="dj-mixer-row">
      <div className="dj-channel-control">
        <span className="dj-control-label">音量</span>
        <output>{session.mutedTracks[track] || volume === -24 ? '静音' : `${volume} dB`}</output>
        <div className="dj-fader-well">
          <span className="dj-fader-scale" aria-hidden="true"><span>+6</span><span>0</span><span>−24</span></span>
          <input className="dj-fader" aria-label={`${LABELS[track]}音量`} type="range" min="-24" max="6" step="1" value={volume}
            onPointerDown={beginMixEdit} onPointerUp={commitMixEdit} onPointerCancel={commitMixEdit}
            onKeyDown={beginMixEdit} onKeyUp={commitMixEdit} onBlur={commitMixEdit}
            onChange={(e) => changeMix(track, Number(e.target.value))} />
        </div>
      </div>
      <div className="dj-channel-control">
        <span className="dj-control-label">低通</span>
        <output>{cutoff === 20000 ? '关闭' : cutoff >= 1000 ? `${(cutoff / 1000).toFixed(1)} kHz` : `${cutoff} Hz`}</output>
        <FilterKnob track={track} value={cutoff} onChange={(value) => effects.cutoff(track, value)} />
        <span className="dj-knob-ends" aria-hidden="true">低<span>关闭</span></span>
      </div>
    </div>
    <div className="dj-repeat-label">重复</div>
    <RepeatPads controller={effects.repeat} track={track} bpm={session.bpm} enabled={repeatEnabled} />
  </div>;
}
