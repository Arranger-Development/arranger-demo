import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import JamTemplateCard from './JamTemplateCard.jsx';
import { PERFORMANCE_TRACKS as TRACKS, PERFORMANCE_LABELS as LABELS } from '../performanceModel.js';
import { TIMBRE_OPTIONS } from '../performanceSession.js';
import { jamTemplateRange } from '../jamTemplateSlots.js';
import { jamColumnState, jamTemplateState } from '../jamPerformanceState.js';
import { createJamStripController, jamStripLayout, JAM_STRIP_GAP } from '../jamStripController.js';
import useJamReorder from './useJamReorder.js';
import { HUM_SUSTAIN } from '../../data/performanceTimbres.js';
import { isEmptyJamPhrase } from '../jamPhraseContent.js';

export default function JamLauncher({ active, templates, columnCount, bank, onBankChange, navigationRef,
  editingTrack, editingTemplateId, draftsByTrack = {}, auditioning = false, playback, selection, status, mutedTracks, volumes, timbres, timbreLabel, artSources, artNodes,
  onOpenEditor, onTimbreChange, onToggleMute, onTrigger, onLaunchColumn, onRemove, onRemoveDraft, onMove, humButton, humFeedback, humPreview }) {
  const scrollRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const columns = useMemo(() => Object.fromEntries(TRACKS.map(t => [t, jamTemplateRange(templates[t], 0, columnCount)])), [templates, columnCount]);
  const [controller] = useState(() => {
    let element = null;
    const interaction = createJamStripController({
      read: () => {
        const el = element;
        if (!el) return { left: 0, max: 0, pitch: 48 + JAM_STRIP_GAP, visible: 0, columns: 16 };
        const style = getComputedStyle(el), identity = parseFloat(style.getPropertyValue('--identity')) || 120;
        const gap = parseFloat(style.getPropertyValue('--jam-gap')) || JAM_STRIP_GAP;
        return { left: el.scrollLeft, max: Math.max(0, el.scrollWidth - el.clientWidth),
          pitch: (parseFloat(style.getPropertyValue('--jam-pad')) || 48) + gap, gap,
          visible: Math.max(0, el.clientWidth - identity - 6), columns: Number(style.getPropertyValue('--jam-columns')) || 16 };
      },
      write: left => { if (element) element.scrollLeft = left; },
      onBank: onBankChange,
      onEdges: next => setEdges(old => old.left === next.left && old.right === next.right ? old : next),
    });
    return { ...interaction, attach: el => { element = el; } };
  });
  const reorder = useJamReorder({ scrollRef, templates, onMove, onScroll: controller.scroll, navigationRef, enabled: active });
  const { drag } = reorder;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    controller.attach(el);
    const resize = () => {
      if (!el.clientWidth) return;
      const style = getComputedStyle(el), identity = parseFloat(style.getPropertyValue('--identity')) || 120;
      const previousPitch = (parseFloat(style.getPropertyValue('--jam-pad')) || 48) + (parseFloat(style.getPropertyValue('--jam-gap')) || JAM_STRIP_GAP);
      const previousLeft = el.scrollLeft;
      const layout = jamStripLayout(el.clientWidth, identity, humPreview ? 72 : 48);
      el.style.setProperty('--jam-pad', `${layout.pad}px`);
      el.style.setProperty('--jam-gap', `${layout.gap}px`);
      controller.resize(previousPitch, previousLeft);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [controller, columnCount, humPreview]);
  useLayoutEffect(() => {
    const api = { showBank: controller.showBank, revealSlot: controller.revealSlot };
    navigationRef.current = api;
    return () => { if (navigationRef.current === api) navigationRef.current = null; };
  }, [controller, navigationRef]);
  return <section className="studio-launcher" aria-label="乐句浏览" data-left={edges.left} data-right={edges.right}>
    <div className="studio-strip-toolbar">
      <button type="button" aria-label="向左滚动乐句" title="向左滚动八列" disabled={!edges.left} onClick={() => controller.moveBy(-8)}><ChevronLeft size={16}/></button>
      <button type="button" aria-label="向右滚动乐句" title="向右滚动八列" disabled={!edges.right} onClick={() => controller.moveBy(8)}><ChevronRight size={16}/></button>
    </div>
    <div className="studio-strip-frame"><div ref={scrollRef} className="studio-launcher-scroll" role="region" aria-label="连续乐句列表" tabIndex={0}
      style={{ '--jam-columns': columnCount, '--jam-gap': `${JAM_STRIP_GAP}px` }} data-dragging={Boolean(drag)}
      {...reorder.handlers}
      onScroll={() => { controller.scroll(); reorder.refresh(); }}
      onKeyDown={event => {
        reorder.handlers.onKeyDown(event);
        if (event.defaultPrevented) return;
        if (event.target !== event.currentTarget) return;
        const distance = { ArrowLeft: -1, ArrowRight: 1, PageUp: -8, PageDown: 8 }[event.key];
        if (distance) { event.preventDefault(); event.stopPropagation(); controller.moveBy(distance); }
      }}>
      <div className="studio-gallery" aria-label="四轨乐器与模板">
        <div className="studio-column-launchers"><span className="studio-column-label">整列播放</span>{Array.from({ length: columnCount }, (_, index) => {
          const state = auditioning ? 'idle' : jamColumnState(status, columns, index), mapped = Math.floor(index / 8) === bank;
          const action = state === 'idle' ? '播放' : '暂停';
          return TRACKS.some(t => columns[t][index] && !isEmptyJamPhrase(columns[t][index])) ? <button type="button" key={index} className="studio-column-launch" data-slot-index={index} data-state={state} data-mapped={mapped}
            {...reorder.cellProps(null,index)} aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
            aria-label={`${action}第 ${index + 1} 列${state === 'queued' ? '，等待下一小节进入' : ''}`} aria-pressed={state !== 'idle'} title={`点击${action}整列 · 拖动整列排序 · Alt＋方向键移动`} onClick={() => onLaunchColumn(index)}>{state === 'idle' ? <Play size={10}/> : <Pause size={10}/>}<span>{index + 1}</span></button>
            : <span className="studio-column-empty" key={index} data-slot-index={index} {...reorder.cellProps(null,index)} aria-hidden="true"/>;
        })}</div>
        {TRACKS.map(t => <section className="studio-instrument" data-track={t} data-active={editingTrack === t} key={t} aria-label={`${LABELS[t]}模板`}>
          <div className="studio-instrument-top"><button type="button" className="studio-instrument-open" aria-label={`创作${LABELS[t]}模板`} onClick={() => onOpenEditor(t)} aria-expanded={editingTrack === t}>
            <span className="studio-instrument-art" data-art-track={t} ref={node => { artNodes.current[t] = node; }}><img src={artSources[t]} alt="" draggable={false} decoding="async"/></span>
          </button><div className="studio-instrument-label">{t === 'melody' && humButton ? <span className="jam-hum-label"><strong>{LABELS[t]}</strong>{humButton}</span> : <strong>{LABELS[t]}</strong>}<span className="studio-editing-state">{editingTrack === t ? '编辑中' : ''}</span><label className="studio-instrument-timbre" title="切换音色"><select aria-label={`${LABELS[t]}音色`} value={timbres[t]} onChange={e => onTimbreChange(t,e.target.value)}>{(humPreview && t === 'melody' ? [HUM_SUSTAIN, ...TIMBRE_OPTIONS[t]] : TIMBRE_OPTIONS[t]).map(id => <option key={id} value={id}>{timbreLabel(id)}</option>)}</select></label></div><button type="button" className="studio-track-mute" aria-label={`${mutedTracks[t] ? '取消静音' : '静音'}${LABELS[t]}`} aria-pressed={mutedTracks[t]} onClick={() => onToggleMute(t)} title={mutedTracks[t] ? '取消静音' : '静音'}>{mutedTracks[t] ? <VolumeX size={14}/> : <Volume2 size={14}/>}</button></div>
          <div className="studio-template-list" aria-label={`${LABELS[t]}已保存乐句`}>{columns[t].map((p, index) => p
            ? <JamTemplateCard key={p.id} template={{...p,name:p.name || `${LABELS[t]}乐句`}} playback={playback} isEmpty={isEmptyJamPhrase(p)} index={index} reorderProps={reorder.cellProps(t,index)} selected={selection[t] === p.id}
              canCancel={!auditioning && status.playingPhraseIds?.[t] === p.id && status.mode !== 'stopped' && !mutedTracks[t] && volumes[t] > -24}
              state={isEmptyJamPhrase(p) || mutedTracks[t] || volumes[t] <= -24 ? 'idle' : jamTemplateState(status,t,p.id)} editing={editingTemplateId === p.id}
              onSelect={() => isEmptyJamPhrase(p)?onOpenEditor(t,p):onTrigger(t,p.id)} onEdit={() => onOpenEditor(t,p)} onRemove={() => onRemove(p)}/>
            : !draftsByTrack[t]?.editingTemplateId && draftsByTrack[t]?.targetSlot === index
            ? <JamTemplateCard key={`draft-${index}`} isDraft template={{...draftsByTrack[t],name:draftsByTrack[t].name || `${LABELS[t]}草稿`}} index={index}
              editing={editingTrack === t} reorderProps={reorder.cellProps(t,index)}
              onSelect={() => onOpenEditor(t,null,false,index)} onEdit={() => onOpenEditor(t,null,false,index)} onRemove={() => onRemoveDraft(t,draftsByTrack[t])}/>
            : <button type="button" key={`empty-${index}`} className="studio-template studio-template-empty" data-slot-index={index} {...reorder.cellProps(t,index)} aria-label={`新建${LABELS[t]}乐句，第 ${index + 1} 格`} onClick={() => onOpenEditor(t,null,false,index)}/>)}</div>
        </section>)}
      </div>
    </div></div>
    {humFeedback}
    {drag && <div className="studio-reorder-preview" aria-hidden="true" data-valid={drag.valid}>
      {drag.valid && <div className="studio-reorder-insertion" style={{left:drag.targetLeft-4,top:drag.targetTop,height:drag.targetHeight}}/>}
      {drag.ghosts.map(g => g.name && <div className="studio-reorder-ghost" data-track={g.trackId} key={g.trackId}
        style={{left:drag.left+drag.dx,top:g.top,width:drag.width,height:g.height}}><span>{g.name}</span></div>)}
    </div>}
    <span className="studio-reorder-announcement" role="status" aria-live="polite">{drag ? drag.valid ? `移动到第 ${drag.to+1} ${drag.trackId ? '格' : '列'}` : '请移回原轨道或列区域，松手取消' : ''}</span>
  </section>;
}
void [ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, JamTemplateCard];
