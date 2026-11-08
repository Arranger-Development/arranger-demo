import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PianoRoll } from './PianoRoll.jsx';
import { jamEditorNotes, jamMelodyRenderState, jamPitchedNotes, jamPitchedRenderState, setJamPitchedNote } from '../jamNoteEditing.js';
import { editJamSequencerStep, HUM_SOURCE } from '../jamHumExpression.js';
import { formatNoteLabel } from '../noteDisplay.js';

export default function JamChordEditor({ draft, editorBars = draft.bars, bar, step, onChange }) {
  const [selection, setSelection] = useState(null);
  const track = draft.trackId;
  const toggleNotes = track === 'melody';
  const label = { chord: '和弦', bass: '贝斯', melody: '旋律' }[track];
  const notes = jamEditorNotes(track);
  const sustained = track === 'melody' && draft.sourcePresetId === HUM_SOURCE;
  const maxLength = (index, step) => (sustained ? (draft.bars.length - index) * 16 : 16) - step;
  const notesAt = (cell, step, index = bar) => jamPitchedNotes(cell, step, track, maxLength(index, step));
  const renderState = (step, note) => sustained ? jamMelodyRenderState(editorBars, bar, step, note) : jamPitchedRenderState(cells, step, note, track);
  const cells = editorBars[bar];
  const hit = selection && (sustained || selection.bar === bar)
    ? notesAt(editorBars[selection.bar]?.[selection.step], selection.step, selection.bar).find(hit => hit.note === selection.note) : null;
  const selected = hit ? selection : null;
  function changeNote(index, step, note, length, remove = false) {
    onChange(editJamSequencerStep(draft, index, step, cells =>
      setJamPitchedNote(cells, step, note, length, remove, track, maxLength(index, step))));
  }
  function edit(length, remove = false) {
    if (!selected) return;
    changeNote(selected.bar, selected.step, selected.note, length, remove);
    if (remove) setSelection(null);
  }
  const pitches = new Set(cells.flatMap((cell, index) => notesAt(cell, index).map(hit => hit.note)));
  const progression = draft.bars.flat().filter(cell => cell?.type === 'chord' || !cell?.type && cell?.root)
    .map(cell => cell.label ?? cell.root).filter((label, index, labels) => index === 0 || label !== labels[index - 1]);
  const firstNote = notes.find(({ note }) => pitches.has(note))?.note ?? (track === 'bass' ? 'B1' : 'B4');
  const playingNotes = new Set(step == null ? [] : notes.filter(({ note }) => renderState(step, note).active).map(({ note }) => note));
  return <div className="studio-chord-editor" onKeyDown={event => {
    if (toggleNotes || event.target.closest('input,select,textarea')) return;
    if (selected && ['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); edit(1, true); }
  }}>
    <div className="studio-chord-progression" aria-label={`${label}辅助信息`}>{track === 'chord' ? `和弦进行 · ${progression.join(' → ') || '自由音符'}` : toggleNotes ? '点空格添加 · 点起音格删除 · Shift 点击选音改时值' : '点击空格添加 · 选中音符后修改时值或删除'}</div>
    <div className="studio-note-tools">
      <span>{selected ? `${formatNoteLabel(selected.note)} · 第 ${selected.step + 1} 步` : toggleNotes ? '未选中音符' : '点格子添加音符 · 点音符选择'}</span>
      <label>时值 <input type="number" aria-label={`${label}音符时值（步）`} min="1" max={selected ? maxLength(selected.bar, selected.step) : 16}
        disabled={!selected} value={hit ? Math.max(1, Math.round(hit.durationSteps)) : 1} onChange={event => edit(event.target.value)}/> 步</label>
      {!toggleNotes && <button type="button" aria-label={`删除${label}音符`} disabled={!selected} onClick={() => edit(1, true)}><Trash2 size={14}/></button>}
    </div>
    <div className="studio-piano-preview studio-chord-roll"><PianoRoll ariaLabel={`${label}音序器`} trackId={track} notes={notes}
      initialTopNote={firstNote} showStepNumbers activeNoteIds={playingNotes} highlightedNoteIds={new Set(selected ? [selected.note] : [])}
      getCellRenderState={renderState} isCellActive={() => false}
      onCellToggle={(step, note, event) => {
        const state = renderState(step, note);
        if (toggleNotes && state.start && !event.shiftKey) {
          changeNote(bar, step, note, 1, true);
          if (selected?.bar === bar && selected.step === step && selected.note === note) setSelection(null);
          return;
        }
        if (state.active) { setSelection({ bar: state.startBar ?? bar, step: state.startStep, note }); return; }
        changeNote(bar, step, note, 1);
        setSelection({ bar, step, note });
      }}/></div>
  </div>;
}
void [PianoRoll, Trash2];
