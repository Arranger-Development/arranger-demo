import { PianoRoll } from './PianoRoll.jsx';
import { MELODY_NOTES } from '../../data/melodyScales.js';
import { BASS_NOTES } from '../../data/bassNotes.js';
import { getChordCellNotes } from '../../domain/chordCells.js';
import { getMelodyCellNotes } from '../../domain/melodyCells.js';
import { getMelodyCellRenderState } from '../melodyActions.js';

export default function JamPhrasePreview({ draft, bar, step }) {
  const notesAt = index => draft.trackId === 'chord' ? getChordCellNotes(draft.bars[bar][index])
    : draft.trackId === 'melody' ? getMelodyCellNotes(draft.bars[bar][index]) : [draft.bars[bar][index]?.note].filter(Boolean);
  const first = draft.bars.flat().find(Boolean);
  const firstNote = draft.trackId === 'chord' ? getChordCellNotes(first)[0] : draft.trackId === 'melody' ? getMelodyCellNotes(first)[0] : first?.note;
  return <div className="studio-piano-preview" aria-label="乐句预览">
    <PianoRoll ariaLabel={`${draft.trackId}乐句预览`} trackId={draft.trackId} notes={draft.trackId === 'bass' ? BASS_NOTES : MELODY_NOTES}
      initialTopNote={firstNote ?? (draft.trackId === 'bass' ? 'D1' : 'B3')} isCellActive={(index,note) => notesAt(index).includes(note)}
      getCellRenderState={draft.trackId === 'melody' ? (index,note) => getMelodyCellRenderState({melody:draft.bars},bar,index,note) : undefined}
      activeNoteIds={new Set(step == null ? [] : notesAt(step))} disabled onCellToggle={() => {}}/>
  </div>;
}
void PianoRoll;
