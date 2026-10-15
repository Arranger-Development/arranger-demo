import { useEffect, useRef } from 'react';
import './templateJam.css';

export default function RotaryKnob({ label, labelAccessory, ticks, value, min = 0, max = 100, step = 25, onChange, onBegin, onEnd, disabled = false, format = String }) {
  const drag = useRef(null), finishRef = useRef(onEnd);
  useEffect(() => { finishRef.current = onEnd; }, [onEnd]);
  const finish = () => { if (drag.current) { drag.current = null; finishRef.current?.(); } };
  useEffect(() => {
    const release = () => { if (drag.current) { drag.current = null; finishRef.current?.(); } };
    window.addEventListener('blur', release); return () => window.removeEventListener('blur', release);
  }, []);
  const update = next => onChange(Math.max(min, Math.min(max, min + Math.round((next - min) / step) * step)));
  return <div className="rotary-control">
    <span className="rotary-label">{label}{labelAccessory}</span>
    <div className="rotary-knob" role="slider" tabIndex={disabled ? -1 : 0} aria-label={label} aria-disabled={disabled}
      aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={format(value)}
      style={{ '--knob-angle': `${-135 + (value - min) / (max - min) * 270}deg` }}
      onPointerDown={e => { if (disabled || e.button !== 0) return; e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); onBegin?.(); drag.current = { y: e.clientY, value, id: e.pointerId }; }}
      onPointerMove={e => { if (drag.current?.id === e.pointerId) update(drag.current.value + (drag.current.y - e.clientY) * (max - min) / 150); }}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onBlur={finish}
      onKeyDown={e => {
        if (disabled) return;
        const delta = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: step * 4, PageDown: -step * 4 }[e.key];
        if (delta !== undefined || ['Home', 'End'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); onBegin?.(); update(e.key === 'Home' ? min : e.key === 'End' ? max : value + delta); onEnd?.(); }
      }}><span className="rotary-face"><span className="rotary-marker" /></span></div>
    <output className="rotary-value">{format(value)}</output>
    <div className="rotary-ticks" aria-hidden="true">{(ticks ?? (step === 25 ? [0,25,50,75,100].map(v => ({value:v,label:v})) : [{value:min,label:min},{value:max,label:max}])).map(tick => <span key={tick.value} data-active={value === tick.value}>{tick.label}</span>)}</div>
  </div>;
}
