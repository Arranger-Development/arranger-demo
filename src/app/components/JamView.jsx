import { PERFORMANCE_SAMPLE_BANKS } from '../../data/performanceTimbres.js';
import { useEffect, useRef } from 'react';
import { Check, ChevronDown, Save } from 'lucide-react';
import { PERFORMANCE_TRACKS as TRACKS, PERFORMANCE_LABELS as LABELS, hasSelection } from '../performanceModel.js';
import { availablePadTemplates, EXTRA_PHRASE_PLACEHOLDERS, MAIN_PHRASE_SLOTS, TRANSITION_PHRASE_SLOTS, TIMBRE_OPTIONS } from '../performanceSession.js';
import { performanceKeyLabel } from '../../input/performanceInput.js';
import PhrasePerimeterProgress from './PhrasePerimeterProgress.jsx';
import { PERFORMANCE_TRACK_ICONS } from './icons.js';

void [Check, ChevronDown, Save, PhrasePerimeterProgress, SectionDial, LoopActions];

const DEFAULT_TIMBRE_LABELS = {
  'soft-electronic-kit': '柔和电子鼓',
  'warm-electric-piano': '温暖电钢琴',
  'round-electric-bass': '圆润电贝司',
  'airy-synth-lead': '空气感合成器',
};

function SectionDial({ playback, section, playing, editing, pending, unsaved, onSelect }) {
  const ring = useRef(null);
  useEffect(() => {
    if (!playing) { ring.current?.setAttribute('stroke-dashoffset', '100'); return undefined; }
    let frame;
    const tick = () => {
      const progress = playback.getProgress();
      ring.current?.setAttribute('stroke-dashoffset', String(progress?.id === section.id ? 100 * (1 - progress.fraction) : 100));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playback, section.id, playing]);
  return <button type="button" onClick={onSelect} data-section-id={section.id} aria-pressed={editing}
    className={`performance-loop ${editing ? 'is-editing' : ''} ${playing ? 'is-playing' : ''} ${pending ? 'is-pending' : ''}`}>
    <span className="performance-loop-dial">
      <svg className="performance-loop-progress" viewBox="0 0 64 64" aria-hidden="true">
        <circle className="performance-loop-rail" cx="32" cy="32" r="29" />
        <circle ref={ring} className="performance-loop-elapsed" cx="32" cy="32" r="29" pathLength="100" strokeDasharray="100" strokeDashoffset="100" />
      </svg>
      <span className="performance-loop-circle">{section.kind === 'transition' ? '单次' : '∞'}</span>
    </span>
    <strong>{section.name}</strong>
    <small>{pending ? '待播放' : playing ? '播放中' : editing ? '编辑中' : section.kind === 'transition' ? '转场' : '主段落'} · {unsaved ? '未保存' : hasSelection(section.selection) ? '已保存' : '空位'}</small>
  </button>;
}

export default function JamView({ active, session, drafts, editingId, draft, templates, status, message, playback,
  triggerPad, replacePad, catalog, selectSection, updateTimbre, save, renameSection, removeSection }) {
  const locked = status.mode !== 'stopped';
  const sectionsRef = useRef(null);
  useEffect(() => {
    const button = [...(sectionsRef.current?.children ?? [])].find((el) => el.dataset.sectionId === editingId);
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [editingId]);
  return <main className="performance-body jam-body">
    <div className="performance-intro"><span className="performance-eyebrow">四轨乐句 · JAM</span><span className="jam-zone-label">主乐句 × {MAIN_PHRASE_SLOTS} <span>转场 × {TRANSITION_PHRASE_SLOTS}</span></span></div>
    <div className="performance-workbench jam-workbench">
      <div className="performance-grid jam-grid" aria-label="四轨乐句" style={{ '--jam-main-slots': MAIN_PHRASE_SLOTS, '--jam-transition-slots': TRANSITION_PHRASE_SLOTS, '--jam-total-slots': MAIN_PHRASE_SLOTS + TRANSITION_PHRASE_SLOTS }}>
        {TRACKS.map((track) => {
          const Icon = PERFORMANCE_TRACK_ICONS[track]; void Icon;
          return <div className="performance-row jam-row" data-track={track} key={track} role="group" aria-label={`${LABELS[track]}乐句`}>
            <label className="performance-track-label jam-track-timbre" title={`切换${LABELS[track]}音色`}>
              <Icon size={22} aria-hidden="true" /><strong>{LABELS[track]}</strong><ChevronDown size={12} aria-hidden="true" />
              <select aria-label={`${LABELS[track]}音色`} value={TIMBRE_OPTIONS[track].includes(draft.timbres[track]) ? draft.timbres[track] : TIMBRE_OPTIONS[track][0]} onChange={(e) => updateTimbre(track, e.target.value)}>
                {TIMBRE_OPTIONS[track].map((id, i) => <option key={id} value={id}>{PERFORMANCE_SAMPLE_BANKS[id]?.label ?? DEFAULT_TIMBRE_LABELS[id] ?? `音色 ${i + 1} · 占位`}</option>)}
              </select>
            </label>
            {[0, 1].map((group) => <div className={`jam-pad-group ${group ? 'jam-transitions' : ''}`} key={group}>
              {Array.from({ length: group ? TRANSITION_PHRASE_SLOTS : MAIN_PHRASE_SLOTS }, (_, n) => n + (group ? MAIN_PHRASE_SLOTS : 0)).map((index) => {
                const phrase = templates[track][index]; const selected = phrase && draft.selection[track] === phrase.id;
                const available = availablePadTemplates(catalog, session.pads, track, index);
                const key = performanceKeyLabel(track, index);
                return <div className="jam-pad-slot" key={index}>
                  <button type="button" className={`performance-pad ${selected ? 'is-selected' : ''}`} disabled={!phrase}
                    aria-keyshortcuts={key} aria-label={`${LABELS[track]}：${phrase?.name ?? `空槽 ${index + 1}`}`} aria-pressed={Boolean(selected)}
                    title={phrase ? `${phrase.name} · ${phrase.barCount ?? 2} 小节 · ${key}` : '待提供素材'} onClick={() => triggerPad(track, index)}>
                    <span className="performance-pad-top"><span className="performance-key-hint" aria-hidden="true">{key}</span>{selected ? <Check size={16} /> : <Icon size={16} />}</span>
                    <strong>{phrase?.name ?? '空位'}</strong>
                    {phrase && <PhrasePerimeterProgress playback={playback} track={track} phraseId={phrase.id}
                      running={active && status.mode === 'jam'} inset={0} radius={9} />}
                  </button>
                  <select className="jam-pad-replace" aria-label={`${LABELS[track]}${group ? '转场' : '主乐句'} ${group ? index - MAIN_PHRASE_SLOTS + 1 : index + 1} 更多模板`}
                    value={phrase?.id ?? ""} onChange={(e) => replacePad(track, index, e.target.value)}>
                    <option value="" disabled>{available.length ? '更多模板' : '暂无可替换模板'}</option>
                    {phrase && <option value={phrase.id} hidden disabled>{phrase.name}</option>}
                    {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}{EXTRA_PHRASE_PLACEHOLDERS.map((p) => <option key={p.id} value={p.id} disabled>{p.name} · 待提供</option>)}
                  </select>
                </div>;
              })}
            </div>)}
          </div>;
        })}
      </div>

    </div>
    <div className="jam-combination-actions">
      <span role="status">{status.error || message || (status.loading ? '正在准备声音…' : status.pendingId ? '已排队 · 下一小节切换' : '')}</span>
      {locked && <button type="button" className="performance-connect" onClick={() => playback.stop()}>停止</button>}
      <button type="button" className="performance-save" disabled={!hasSelection(draft.selection)} onClick={save}>
        <Save size={14} /><span>{session.sections.some((s) => s.id === editingId) ? '更新' : '保存'}{draft.kind === 'transition' ? '转场' : '段落'}</span>
      </button>
    </div>
    <section className="performance-sequence jam-sequence" aria-label="保存的 loop">
      {session.sections.length ? <div ref={sectionsRef} className="performance-loops jam-loops">
        {session.sections.map((s) => <div className="jam-saved-loop" key={s.id} data-section-id={s.id}>
          <SectionDial playback={playback} section={s}
            playing={active && status.playingId === s.id} pending={status.pendingId === s.id} editing={editingId === s.id}
            unsaved={JSON.stringify(drafts[s.id]) !== JSON.stringify(s)} onSelect={() => selectSection(s.id)} />
          <LoopActions section={s} rename={renameSection} remove={removeSection} />
        </div>)}
      </div> : <p className="jam-empty-library">保存后，loop 会显示在这里</p>}
    </section>
  </main>;
}

function LoopActions({ section, rename, remove }) {
  const menu = useRef(null);
  const trigger = useRef(null);
  const close = () => { menu.current?.hidePopover(); trigger.current?.focus(); };
  return <>
    <button ref={trigger} type="button" className="performance-connect jam-loop-more" aria-label={`${section.name}操作`}
      popoverTarget={`loop-menu-${section.id}`} onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        menu.current.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - 240))}px`;
        menu.current.style.top = `${Math.max(12, rect.top - 135)}px`;
      }}>⋯</button>
    <div ref={menu} id={`loop-menu-${section.id}`} popover="auto" className="jam-loop-menu">
      <form onSubmit={(event) => { event.preventDefault(); const name = new FormData(event.currentTarget).get('name').trim(); if (name) { rename(section.id, name); close(); } }}>
        <label>名称<input key={section.name} name="name" aria-label={`重命名 ${section.name}`} defaultValue={section.name} required /></label>
        <button type="submit" className="performance-connect">重命名</button>
        <button type="button" className="performance-connect" onClick={() => { close(); remove(section.id); }}>删除</button>
      </form>
    </div>
  </>;
}
