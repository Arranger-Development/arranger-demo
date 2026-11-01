import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PianoRoll } from './PianoRoll.jsx';
import { jamEditorNotes, jamPitchedNotes, jamPitchedRenderState, setJamPitchedNote } from '../jamNoteEditing.js';
import { formatNoteLabel } from '../noteDisplay.js';

export default function JamChordEditor({ draft, bar, step, onChange }) {
  const [selection, setSelection] = useState(null);
  const track = draft.trackId;
  const label = { chord: '和弦', bass: '贝斯', melody: '旋律' }[track];
  const notes = jamEditorNotes(track);
  const notesAt = (cell, step) => jamPitchedNotes(cell, step, track);
  const renderState = (step, note) => jamPitchedRenderState(cells, step, note, track);
  const cells = draft.bars[bar];
  const hit = selection?.bar === bar
    ? notesAt(cells[selection.step], selection.step).find(hit => hit.note === selection.note) : null;
  const selected = hit ? selection : null;
  function edit(length, remove = false) {
    if (!selected) return;
    const bars = [...draft.bars];
    bars[bar] = setJamPitchedNote(cells, selected.step, selected.note, length, remove, track);
    onChange({ ...draft, bars });
    if (remove) setSelection(null);
  }
  const pitches = new Set(cells.flatMap((cell, index) => notesAt(cell, index).map(hit => hit.note)));
  const progression = draft.bars.flat().filter(cell => cell?.type === 'chord' || !cell?.type && cell?.root)
    .map(cell => cell.label ?? cell.root).filter((label, index, labels) => index === 0 || label !== labels[index - 1]);
  const firstNote = notes.find(({ note }) => pitches.has(note))?.note ?? (track === 'bass' ? 'B1' : 'B4');
  const playingNotes = new Set(step == null ? [] : notes.filter(({ note }) => renderState(step, note).active).map(({ note }) => note));
  return <div className="studio-chord-editor" onKeyDown={event => {
    if (event.target.closest('input,select,textarea')) return;
    if (selected && ['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); edit(1, true); }
  }}>
    <div className="studio-chord-progression" aria-label={`${label}辅助信息`}>{track === 'chord' ? `和弦进行 · ${progression.join(' → ') || '自由音符'}` : '点击空格添加 · 选中音符后修改时值或删除'}</div>
    <div className="studio-note-tools">
      <span>{selected ? `${formatNoteLabel(selected.note)} · 第 ${selected.step + 1} 步` : '点格子添加音符 · 点音符选择'}</span>
      <label>时值 <input type="number" aria-label={`${label}音符时值（步）`} min="1" max={selected ? 16 - selected.step : 16}
        disabled={!selected} value={hit ? Math.max(1, Math.round(hit.durationSteps)) : 1} onChange={event => edit(event.target.value)}/> 步</label>
      <button type="button" aria-label={`删除${label}音符`} disabled={!selected} onClick={() => edit(1, true)}><Trash2 size={14}/></button>
    </div>
    <div className="studio-piano-preview studio-chord-roll"><PianoRoll ariaLabel={`${label}音序器`} trackId={track} notes={notes}
      initialTopNote={firstNote} showStepNumbers activeNoteIds={playingNotes} highlightedNoteIds={new Set(selected ? [selected.note] : [])}
      getCellRenderState={renderState} isCellActive={() => false}
      onCellToggle={(step, note) => {
        const state = renderState(step, note);
        if (state.active) { setSelection({ bar, step: state.startStep, note }); return; }
        const bars = [...draft.bars]; bars[bar] = setJamPitchedNote(cells, step, note, 1, false, track);
        onChange({ ...draft, bars }); setSelection({ bar, step, note });
      }}/></div>
  </div>;
}
void [PianoRoll, Trash2];
