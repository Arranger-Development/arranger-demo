import { useEffect, useRef, useState } from 'react';
import { ArrowRightToLine, Check, Drum, Guitar, Music2, Piano, Save, Settings2 } from 'lucide-react';
import { PERFORMANCE_TRACKS as TRACKS, PERFORMANCE_LABELS as LABELS, hasSelection } from '../performanceModel.js';
import { EXTRA_PHRASE_PLACEHOLDERS, MAIN_PHRASE_SLOTS, TRANSITION_PHRASE_SLOTS } from '../performanceSession.js';
import { performanceKeyLabel } from '../../input/performanceInput.js';
import { Progress, TrackControls } from './PerformanceControls.jsx';

void [ArrowRightToLine, Check, Save, Settings2, Progress, TrackControls, SectionDial];
const icons = { drums: Drum, chord: Piano, bass: Guitar, melody: Music2 };

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

export default function JamView({ active, session, drafts, editingId, draft, templates, status, message, playback, audio,
  triggerPad, selectSection, updateTimbre, changeMix, save, onComplete, editSection, addSection, renameSection, removeSection }) {
  const locked = status.mode !== 'stopped';
  const [newSectionKind, setNewSectionKind] = useState('main');
  const sectionsRef = useRef(null);
  useEffect(() => {
    const button = [...(sectionsRef.current?.children ?? [])].find((el) => el.dataset.sectionId === editingId);
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [editingId]);
  return <main className="performance-body jam-body">
    <div className="performance-intro"><span className="performance-eyebrow">四轨乐句 · JAM</span><span className="jam-zone-label">主乐句 × {MAIN_PHRASE_SLOTS} <span>转场 × {TRANSITION_PHRASE_SLOTS}</span></span>      <aside className="performance-save-panel jam-save-panel">
        <button type="button" className="performance-save" onClick={save}><Save size={14} /><span>{draft.kind === 'transition' ? '保存转场' : '保存段落'}</span></button>
        <button type="button" className="performance-save" onClick={onComplete}><ArrowRightToLine size={14} /><span>完成编辑</span></button>
        <details className="jam-manage"><summary className="performance-connect">段落管理</summary>
          <div className="jam-manage-panel">
            <label>编辑段落<select aria-label="编辑段落" value={editingId} onChange={(e) => editSection(e.target.value)}>{session.sections.map((s) => <option key={s.id} value={s.id}>{drafts[s.id].name}</option>)}</select></label>
            <label>名称<input aria-label="当前段落名称" value={draft.name} onChange={(e) => renameSection(e.target.value)} onBlur={() => { if (!draft.name.trim()) renameSection('未命名段落'); }} /></label>
            <button type="button" className="performance-connect" disabled={session.sections.length === 1} onClick={() => removeSection(editingId)}>删除当前段落</button>
          </div>
        </details>
      </aside></div>
    <div className="performance-workbench jam-workbench">
      <div className="performance-grid jam-grid" aria-label="四轨乐句" style={{ '--jam-main-slots': MAIN_PHRASE_SLOTS, '--jam-transition-slots': TRANSITION_PHRASE_SLOTS, '--jam-total-slots': MAIN_PHRASE_SLOTS + TRANSITION_PHRASE_SLOTS }}>
        {TRACKS.map((track) => {
          const Icon = icons[track]; void Icon;
          return <div className="performance-row jam-row" data-track={track} key={track} role="group" aria-label={`${LABELS[track]}乐句`}>
            <details className="jam-track-settings" onToggle={(e) => { if (!e.currentTarget.open) audio.setPerformanceEffect(track, { held: false }); }}>
              <summary className="performance-track-label" aria-label={`${LABELS[track]}轨道设置`}><Icon size={22} /><strong>{LABELS[track]}</strong><Settings2 size={12} /></summary>
              <div className="jam-track-popover"><TrackControls track={track} session={session} draft={draft} updateTimbre={updateTimbre} changeMix={changeMix} audio={audio} /></div>
            </details>
            {[0, 1].map((group) => <div className={`jam-pad-group ${group ? 'jam-transitions' : ''}`} key={group}>
              {Array.from({ length: group ? TRANSITION_PHRASE_SLOTS : MAIN_PHRASE_SLOTS }, (_, n) => n + (group ? MAIN_PHRASE_SLOTS : 0)).map((index) => {
                const phrase = templates[track][index]; const selected = phrase && draft.selection[track] === phrase.id;
                const key = performanceKeyLabel(track, index);
                return <div className="jam-pad-slot" key={index}>
                  <button type="button" className={`performance-pad ${selected ? 'is-selected' : ''}`} disabled={!phrase}
                    aria-keyshortcuts={key} aria-label={`${LABELS[track]}：${phrase?.name ?? `空槽 ${index + 1}`}`} aria-pressed={Boolean(selected)}
                    title={phrase ? `${phrase.name} · ${phrase.barCount ?? 2} 小节 · ${key}` : '待提供素材'} onClick={() => triggerPad(track, index)}>
                    <span className="performance-pad-top"><span className="performance-key-hint" aria-hidden="true">{key}</span>{selected ? <Check size={16} /> : <Icon size={16} />}</span>
                    <strong>{phrase?.name ?? '空位'}</strong>
                    {selected && <Progress playback={playback} id={editingId} bars={phrase.barCount ?? 2} running={active && status.playingId === editingId} />}
                  </button>
                  <select className="jam-pad-replace" aria-label={`${LABELS[track]}${group ? '转场' : '主乐句'} ${group ? index - MAIN_PHRASE_SLOTS + 1 : index + 1} 更多模板`}
                    defaultValue="">
                    <option value="" disabled>更多模板</option>{EXTRA_PHRASE_PLACEHOLDERS.map((p) => <option key={p.id} value={p.id} disabled>{p.name} · 待提供</option>)}
                  </select>
                </div>;
              })}
            </div>)}
          </div>;
        })}
      </div>

    </div>
    <section className="performance-sequence jam-sequence" aria-label="保存的段落"><div ref={sectionsRef} className="performance-loops jam-loops">
      {session.sections.map((s) => <SectionDial key={s.id} playback={playback} section={{ ...s, name: drafts[s.id].name }}
        playing={active && status.playingId === s.id} pending={status.pendingId === s.id} editing={editingId === s.id}
        unsaved={JSON.stringify(drafts[s.id]) !== JSON.stringify(s)} onSelect={() => selectSection(s.id)} />)}
    </div><div className="jam-add-section">
      <select aria-label="新增段落类型" value={newSectionKind} onChange={(e) => setNewSectionKind(e.target.value)}>
        <option value="main">段落模板</option><option value="transition">转场模板</option>
      </select>
      <button type="button" className="performance-connect" onClick={() => addSection(newSectionKind)}>＋ Add</button>
    </div></section>
    <footer className="performance-footer jam-footer"><span role="status">{status.error || message || (status.loading ? '正在准备声音…' : status.pendingId ? '已排队 · 下一小节切换' : locked ? '播放中' : '选择段落开始演奏')}</span>
      {locked && <button type="button" className="performance-connect" onClick={() => playback.stop()}>停止</button>}
    </footer>
  </main>;
}
