import { useSyncExternalStore } from 'react';
import { PERFORMANCE_LABELS as LABELS } from '../performanceModel.js';
import { EFFECT_FIELDS } from '../jamEffectParameters.js';
import { TrackControls } from './PerformanceControls.jsx';

void [TrackControls, Hold];

function Hold({ label, disabled, pressed, onPress, onRelease }) {
  const releaseKeys = () => { onRelease('key: '); onRelease('key:Enter'); };
  return <button type="button" className="dj-repeat-pad" disabled={disabled} aria-pressed={pressed}
    onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); onPress('pointer:' + e.pointerId); }}
    onPointerUp={e => onRelease('pointer:' + e.pointerId)}
    onPointerCancel={e => onRelease('pointer:' + e.pointerId)}
    onLostPointerCapture={e => onRelease('pointer:' + e.pointerId)}
    onKeyDown={e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) onPress('key:' + e.key); } }}
    onKeyUp={e => { if ([' ', 'Enter'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); onRelease('key:' + e.key); } }}
    onBlur={releaseKeys}>{label}</button>;
}

export default function JamPerformanceDeck({ effects, session, enabled, changeMix }) {
  const fx = useSyncExternalStore(effects.subscribe, effects.getSnapshot);
  const track = fx.selectedTrack, hasTargets = fx.selectedTracks.length > 0;
  const mixed = Object.values(EFFECT_FIELDS).some(field => fx.selectedTracks.some(t => fx[field][t] !== fx[field][track]));
  const momentary = (parameter, value, label) => <Hold key={parameter + ':' + value} label={label}
    disabled={!enabled || !hasTargets} pressed={fx[EFFECT_FIELDS[parameter]][track] === value}
    onPress={token => effects.press(parameter, parameter + ':' + value + ':' + token, value, session.bpm)}
    onRelease={token => effects.release(parameter, parameter + ':' + value + ':' + token)} />;

  return <div className="jam-deck">
    <p className="jam-effect-hint">选择效果目标 · 可选多轨</p>
    {mixed && <p className="jam-effect-status" role="status">多轨参数不同 · 显示{LABELS[track]}</p>}
    {!hasTargets && <p className="jam-effect-status" role="status">在上方选择效果目标</p>}
    <section className="jam-mix-group" aria-label="混音">
      <h3 className="jam-effect-group-title">混音</h3>
      <TrackControls track={track} session={{ ...session, volumes: fx.volumes, mutedTracks: fx.mutedTracks }}
        changeMix={changeMix} effects={effects} cutoff={fx.cutoffs[track]} hideRepeat disabled={!hasTargets}
        onCutoffChange={value => fx.selectedTracks.forEach(t => effects.cutoff(t, value))} />
      <label className="jam-effect-slider">混响 <output>{Math.round(fx.reverbs[track] * 100)}%</output>
        <input aria-label="混响空间感" type="range" min="0" max="1" step="0.01"
          value={fx.reverbs[track]} disabled={!hasTargets} onChange={e => effects.reverb(Number(e.target.value))} />
      </label>
    </section>
    <section className="jam-performance-group" aria-label="演奏效果">
      <h3 className="jam-effect-group-title">演奏效果</h3>
      <label className="jam-effect-slider">弯音 <output>{fx.pitches[track].toFixed(1)} 半音</output>
        <input type="range" aria-label="弯音" min="-12" max="12" step="0.1"
          value={fx.pitches[track]} disabled={!enabled || !hasTargets}
          onChange={e => effects.press('pitch', 'screen:pitch-slider', Number(e.target.value), session.bpm)}
          onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerUp={() => effects.release('pitch', 'screen:pitch-slider')}
          onPointerCancel={() => effects.release('pitch', 'screen:pitch-slider')}
          onLostPointerCapture={() => effects.release('pitch', 'screen:pitch-slider')}
          onKeyUp={() => effects.release('pitch', 'screen:pitch-slider')}
          onBlur={() => effects.release('pitch', 'screen:pitch-slider')} />
      </label>
      <small className="jam-pitch-hint">向左降调 · 向右升调 · 松手回中</small>
      <div className="jam-fixed-effects">
        <div role="group" aria-label="重复">
          <div className="dj-repeat-label">重复</div>
          <div className="dj-repeat-pads">{[4, 8, 16].map(n => <Hold key={n} label={'1/' + n}
            disabled={!enabled || !hasTargets} pressed={fx.repeats[track] === n}
            onPress={token => effects.repeat.press('repeat:' + n + ':' + token, n, session.bpm)}
            onRelease={token => effects.repeat.release('repeat:' + n + ':' + token)} />)}</div>
        </div>
        <div role="group" aria-label="切断">
          <div className="dj-repeat-label">切断</div>
          <div className="jam-chopper-pads">{[4, 8, 16, 32].map(n => momentary('chopper', n, '1/' + n))}</div>
        </div>
      </div>
      <div className="jam-brake-pad" role="group" aria-label="刹停">
        <div className="dj-repeat-label">刹停</div>
        {momentary('brake', 1, '按住刹停 · 松开恢复')}
      </div>
    </section>
  </div>;
}
