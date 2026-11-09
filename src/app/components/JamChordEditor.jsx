import { PianoRoll } from './PianoRoll.jsx';
import { jamEditorNotes, jamMelodyRenderState, jamPitchedNotes, jamPitchedRenderState, resizeJamPitchedNote, resizeJamPitchedStart, setJamPitchedNote } from '../jamNoteEditing.js';
import { editJamSequencerStep, HUM_SOURCE } from '../jamHumExpression.js';

export default function JamChordEditor({ draft, editorBars = draft.bars, bar, step, onChange }) {
  const track = draft.trackId;
  const label = { chord: '和弦', bass: '贝斯', melody: '旋律' }[track];
  const notes = jamEditorNotes(track);
  const sustained = draft.sourcePresetId === HUM_SOURCE && (track === 'melody' || draft.humSoundingRanges);
  const maxLength = (index, step) => (sustained ? (draft.bars.length - index) * 16 : 16) - step;
  const cells = editorBars[bar];
  const renderState = (step, note) => {
    const state = sustained ? jamMelodyRenderState(editorBars, bar, step, note, track) : jamPitchedRenderState(cells, step, note, track);
    if (!state.active) return state;
    const startBar = state.startBar ?? bar;
    const last = startBar * 16 + state.startStep + Math.ceil(state.durationSteps) - 1;
    return { ...state, startBar, end: last === bar * 16 + step };
  };
  const pitches = new Set(cells.flatMap((cell, index) =>
    jamPitchedNotes(cell, index, track, maxLength(bar, index)).map(hit => hit.note)));
  const firstNote = notes.find(({ note }) => pitches.has(note) || (sustained && bar > 0 && renderState(0, note).active))?.note
    ?? (track === 'bass' ? 'B1' : 'B4');
  const playingNotes = new Set(step == null ? [] : notes.filter(({ note }) => renderState(step, note).active).map(({ note }) => note));
  return <div className="studio-chord-editor">
    <div className="studio-piano-preview studio-chord-roll"><PianoRoll ariaLabel={`${label}音序器`} trackId={track} notes={notes}
      initialTopNote={firstNote} showStepNumbers activeNoteIds={playingNotes}
      revealPitchOnChange={track === 'chord' && draft.sourcePresetId === HUM_SOURCE ? draft.params?.groove : undefined}
      getCellRenderState={renderState} isCellActive={() => false}
      onCellToggle={(step, note, event) => {
        const state = renderState(step, note);
        if (state.active && (!state.start || event.shiftKey)) return;
        onChange(editJamSequencerStep(draft, bar, step, cells =>
          setJamPitchedNote(cells, step, note, 1, state.start, track, maxLength(bar, step))));
      }}
      onCellResize={(step, note, delta, edge) => {
        const state = renderState(step, note);
        if (!state.active) return;
        const { startBar, startStep, durationSteps } = state;
        const limit = maxLength(startBar, startStep);
        if (edge === 'start') {
          if (sustained && startBar > 0 && delta < 0) {
            const previous = jamMelodyRenderState(editorBars, startBar, 0, note, track);
            if (previous.active && previous.startBar < startBar) {
              const previousEnd = (previous.startBar - startBar) * 16 + previous.startStep + Math.ceil(previous.durationSteps);
              delta = Math.max(delta, Math.min(previousEnd, startStep) - startStep);
            }
          }
          const visibleBassEnd = track === 'bass' && draft.sourcePresetId === HUM_SOURCE ? durationSteps : undefined;
          const next = editJamSequencerStep(draft, startBar, startStep, cells =>
            resizeJamPitchedStart(cells, startStep, note, delta, track, limit, visibleBassEnd));
          if (next !== draft) onChange(next);
          return;
        }
        const length = Math.min(limit, Math.max(1, Math.ceil(durationSteps) + delta));
        if (length === Math.ceil(durationSteps)) return;
        onChange(editJamSequencerStep(draft, startBar, startStep, cells =>
          resizeJamPitchedNote(cells, startStep, note, length, track, limit)));
      }}/></div>
  </div>;
}
void PianoRoll;
