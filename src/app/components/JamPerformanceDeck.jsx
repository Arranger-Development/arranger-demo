import { useSyncExternalStore } from 'react';
import { PERFORMANCE_LABELS as LABELS } from '../performanceModel.js';
import { EFFECT_FIELDS } from '../jamEffectParameters.js';
import { TrackControls } from './PerformanceControls.jsx';

void [TrackControls, Hold];

function Hold({ label, disabled, pressed, onPress, onRelease }) {
  const releaseKeys = () => { onRelease('key: '); onRelease('key:Enter'); };
  return <button type="button" className="dj-repeat-pad" disabled={disabled} aria-pressed={pressed}
    onPointerDown={e=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);onPress(`pointer:${e.pointerId}`);}}
    onPointerUp={e=>onRelease(`pointer:${e.pointerId}`)} onPointerCancel={e=>onRelease(`pointer:${e.pointerId}`)} onLostPointerCapture={e=>onRelease(`pointer:${e.pointerId}`)}
    onKeyDown={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();if(!e.repeat)onPress(`key:${e.key}`);}}}
    onKeyUp={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();e.stopPropagation();onRelease(`key:${e.key}`);}}} onBlur={releaseKeys}>{label}</button>;
}

export default function JamPerformanceDeck({effects,arp,session,enabled,recordingLocked,changeMix,onPage,onArpPress}) {
  const fx=useSyncExternalStore(effects.subscribe,effects.getSnapshot), ar=useSyncExternalStore(arp.subscribe,arp.getSnapshot);
  const track=fx.selectedTrack, hasTargets=fx.selectedTracks.length>0;
  const mixed=Object.values(EFFECT_FIELDS).some(field=>fx.selectedTracks.some(t=>fx[field][t]!==fx[field][track]));
  const momentary=(parameter,value,label)=> <Hold key={`${parameter}:${value}`} label={label} disabled={!enabled||!hasTargets} pressed={fx[EFFECT_FIELDS[parameter]][track]===value}
    onPress={token=>effects.press(parameter,`${parameter}:${value}:${token}`,value,session.bpm)} onRelease={token=>effects.release(parameter,`${parameter}:${value}:${token}`)}/>;
  return <div className="jam-deck">
    <p className="jam-effect-hint">点击轨道头选中／取消 · 可选多轨</p>
    {mixed&&<p role="status">多轨参数不同 · 显示{LABELS[track]}</p>}
    <div className="jam-deck-pages" role="group" aria-label="中间两行功能页">
      {[['mix','混音'],['expression','表现'],['arp','琶音']].map(([id,label])=><button type="button" key={id} aria-pressed={fx.effectPage===id} onClick={()=>onPage(id)}>{label}</button>)}
    </div>
    {!hasTargets&&<p role="status">点击左侧轨道头选择效果目标</p>}
    {hasTargets&&fx.effectPage==='mix'&&<TrackControls track={track} session={{...session,volumes:fx.volumes,mutedTracks:fx.mutedTracks}} changeMix={changeMix} effects={effects} cutoff={fx.cutoffs[track]} hideRepeat
      onCutoffChange={value=>fx.selectedTracks.forEach(t=>effects.cutoff(t,value))}/>}
    {hasTargets&&fx.effectPage==='expression'&&<div className="jam-expression-controls">
      <label>Pitch <output>{fx.pitches[track].toFixed(1)} 半音</output>
        <input type="range" aria-label="Pitch 弯音" min="-12" max="12" step="0.1" value={fx.pitches[track]} disabled={!enabled||!hasTargets}
          onChange={e=>effects.press('pitch','screen:pitch-slider',Number(e.target.value),session.bpm)}
          onPointerDown={e=>e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerUp={()=>effects.release('pitch','screen:pitch-slider')} onPointerCancel={()=>effects.release('pitch','screen:pitch-slider')}
          onLostPointerCapture={()=>effects.release('pitch','screen:pitch-slider')} onKeyUp={()=>effects.release('pitch','screen:pitch-slider')} onBlur={()=>effects.release('pitch','screen:pitch-slider')}/>
      </label><small>向左降调 · 向右升调 · 松手回中</small>
      <label>混响 <output>{Math.round(fx.reverbs[track]*100)}%</output><input aria-label="混响空间感" type="range" min="0" max="1" step="0.01" value={fx.reverbs[track]} onChange={e=>effects.reverb(Number(e.target.value))}/></label>
    </div>}
    {fx.effectPage==='arp'&&<div className="jam-arp-controls">
      <label className="jam-arp-note-input">配置音组
        <input aria-label="琶音音组" disabled={recordingLocked} defaultValue={ar.presets[0]?.join(' ')??''} placeholder="C4 E4 G4"
          onChange={e=>{e.target.setCustomValidity('');arp.configure(0,e.target.value);}} onBlur={e=>{if(!arp.configure(0,e.target.value)){e.target.setCustomValidity('填写1–8个音符，范围C3–B5，例如C4 E4 G4');e.target.reportValidity();}}}/>
      </label>
      <Hold label="按住琶音" disabled={!enabled||recordingLocked||!ar.presets[0]} pressed={ar.index===0}
        onPress={token=>onArpPress(`arp:${token}`,0)} onRelease={token=>arp.release(`arp:${token}`)}/>
      <small>{recordingLocked ? '效果录制中暂不可用' : !ar.presets[0] ? '先填写音组，例如 C4 E4 G4' : !enabled ? '先播放组合或 Loop，再按住琶音' : '旋律轨音色 · 松开停止'}</small>
      <span role="status">{ar.loading?'正在准备琶音…':ar.error}</span>
    </div>}
    <div className="jam-fixed-effects"><div><div className="dj-repeat-label">Repeater · 重复</div><div className="dj-repeat-pads">
      {[4,8,16].map(n=><Hold key={n} label={`1/${n}`} disabled={!enabled||!hasTargets} pressed={fx.repeats[track]===n}
        onPress={token=>effects.repeat.press(`repeat:${n}:${token}`,n,session.bpm)} onRelease={token=>effects.repeat.release(`repeat:${n}:${token}`)}/>)}</div></div>
    <div><div className="dj-repeat-label">Chopper · 切断</div><div className="jam-chopper-pads">{[4,8,16,32].map(n=>momentary('chopper',n,`1/${n}`))}</div></div></div>
    <div className="jam-brake-pad">{momentary('brake',1,'刹停 · 松开恢复')}</div>
  </div>;
}
