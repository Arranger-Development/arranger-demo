import { PianoRoll } from './PianoRoll.jsx';
import { jamEditorNotes, jamMelodyRenderState, jamPitchedNotes, jamPitchedRenderState, resizeJamPitchedNote, setJamPitchedNote } from '../jamNoteEditing.js';
import { editJamSequencerStep, HUM_SOURCE } from '../jamHumExpression.js';

export default function JamChordEditor({ draft, editorBars = draft.bars, bar, step, onChange }) {
  const track = draft.trackId;
  const label = { chord: '和弦', bass: '贝斯', melody: '旋律' }[track];
  const notes = jamEditorNotes(track);
  const sustained = track === 'melody' && draft.sourcePresetId === HUM_SOURCE;
  const maxLength = (index, step) => (sustained ? (draft.bars.length - index) * 16 : 16) - step;
  const cells = editorBars[bar];
  const renderState = (step, note) => {
    const state = sustained ? jamMelodyRenderState(editorBars, bar, step, note) : jamPitchedRenderState(cells, step, note, track);
    if (!state.active) return state;
    const startBar = state.startBar ?? bar;
    const last = startBar * 16 + state.startStep + Math.ceil(state.durationSteps) - 1;
    return { ...state, startBar, end: last === bar * 16 + step };
  };
  const pitches = new Set(cells.flatMap((cell, index) =>
    jamPitchedNotes(cell, index, track, maxLength(bar, index)).map(hit => hit.note)));
  const firstNote = notes.find(({ note }) => pitches.has(note))?.note ?? (track === 'bass' ? 'B1' : 'B4');
  const playingNotes = new Set(step == null ? [] : notes.filter(({ note }) => renderState(step, note).active).map(({ note }) => note));
  return <div className="studio-chord-editor">
    <div className="studio-piano-preview studio-chord-roll"><PianoRoll ariaLabel={`${label}音序器`} trackId={track} notes={notes}
      initialTopNote={firstNote} showStepNumbers activeNoteIds={playingNotes}
      getCellRenderState={renderState} isCellActive={() => false}
      onCellToggle={(step, note, event) => {
        const state = renderState(step, note);
        if (state.active && (!state.start || event.shiftKey)) return;
        onChange(editJamSequencerStep(draft, bar, step, cells => setJamPitchedNote(cells, step, note, 1, state.start, track)));
      }}
      onCellResize={(step, note, delta) => {
        const state = renderState(step, note);
        if (!state.active) return;
        const { startBar, startStep, durationSteps } = state;
        const length = Math.min(maxLength(startBar, startStep), Math.max(1, Math.ceil(durationSteps) + delta));
        if (length === Math.ceil(durationSteps)) return;
        onChange(editJamSequencerStep(draft, startBar, startStep, cells =>
          resizeJamPitchedNote(cells, startStep, note, length, track, maxLength(startBar, startStep))));
      }}/></div>
  </div>;
}
void PianoRoll;
