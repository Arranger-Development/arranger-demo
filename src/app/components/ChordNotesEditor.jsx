import { createElement } from 'react';
import { X } from 'lucide-react';
import { MELODY_NOTES } from '../../data/melodyScales.js';
import { getChordCellNotes } from '../../domain/chordCells.js';
import { ClipNameInput } from './ClipNameInput.jsx';
import { EditorTrackIdentity } from './EditorTrackIdentity.jsx';
import { PianoRoll } from './PianoRoll.jsx';
import { TrackBarPager } from './TrackBarPager.jsx';
import { renderIcon } from './icons.js';
import './ChordNotesEditor.css';

export function ChordNotesEditor({
  matrix, selectedBar, clipName, trackName, onNoteToggle, onNotePreview,
  onRenameClip, onClose, onClearBar, onClearTrack, canPageBars,
  onNextBar, onPreviousBar, disabled,
}) {
  return (
    <section className="editor chord-editor chord-notes-editor" data-screen-label="Chord Notes Editor">
      <header className="editor-head">
        <div className="editor-left">
          {createElement(EditorTrackIdentity, { trackId: 'chord', label: trackName })}
          <div className="clip-title">
            <div className="crumb">Chord · Piano</div>
            {createElement(ClipNameInput, { clipName, onRenameClip })}
            <div className="clip-name-meta">PIANO · BAR {selectedBar + 1}</div>
          </div>
        </div>
        <div className="tools">
          <button className="btn-template drum-clear-action" disabled={disabled} onClick={onClearBar}>清空本小节</button>
          <button className="btn-template drum-clear-action" disabled={disabled} onClick={onClearTrack}>清空整轨</button>
          <button className="editor-close" aria-label="Close editor" onClick={onClose}>{renderIcon(X)}</button>
        </div>
      </header>
      {createElement(TrackBarPager, {
        canPageBars, onNextBar, onPreviousBar, trackId: 'chord',
      }, createElement(PianoRoll, {
        ariaLabel: 'Chord piano roll', notes: MELODY_NOTES, initialTopNote: 'B3',
        trackId: 'chord', disabled,
        isCellActive: (step, note) => getChordCellNotes(matrix.chord[selectedBar]?.[step]).includes(note),
        onCellToggle: onNoteToggle, onNotePreview,
      }))}
    </section>
  );
}
