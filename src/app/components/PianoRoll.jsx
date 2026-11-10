import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  createElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  PIANO_ROLL_VISIBLE_ROWS,
} from '../../data/pianoRollNotes.js';
import { usePianoRollRowIndicator } from '../usePianoRollRowIndicator.js';
import { usePitchScrollSync } from '../usePitchScrollSync.js';
import { BEAT_NUMBERS } from '../uiShellData.js';
import { formatNoteLabel } from '../noteDisplay.js';
import { renderIcon } from './icons.js';

const EMPTY_ACTIVE_NOTE_IDS = new Set();
const EMPTY_HIGHLIGHTED_STEP_IDS = new Set();

function PianoRollRowIndicator() {
  return <span className="piano-roll-row-indicator" aria-hidden="true" />;
}

function PianoRollNoteKey({
  active,
  disabled,
  highlighted,
  note,
  onNotePreview,
  rowIndex,
  trackId,
}) {
  const className = [
    'note-key',
    `${trackId}-note-key`,
    note.sharp ? 'sharp' : '',
    note.root ? 'root' : '',
    highlighted ? 'scale-tone' : '',
    active ? 'playing' : '',
  ].filter(Boolean).join(' ');
  const commonProps = {
    className,
    'data-note': note.note,
    'data-row': rowIndex,
    title: formatNoteLabel(note.note),
  };

  if (!onNotePreview) {
    return <div {...commonProps}>{formatNoteLabel(note.note)}</div>;
  }

  return (
    <button
      {...commonProps}
      type="button"
      disabled={disabled}
      onClick={() => onNotePreview(note.note)}
    >
      {formatNoteLabel(note.note)}
    </button>
  );
}

function PianoRoll({
  activeHighlightedStep = null,
  activeNoteIds = EMPTY_ACTIVE_NOTE_IDS,
  ariaLabel,
  autoRevealActiveNote = false,
  disabled = false,
  highlightedNoteIds = EMPTY_ACTIVE_NOTE_IDS,
  highlightedStepIds = EMPTY_HIGHLIGHTED_STEP_IDS,
  initialTopNote,
  revealPitchOnChange,
  getCellRenderState,
  isCellActive,
  notes,
  onCellPressEnd,
  onCellPressStart,
  onCellResize,
  onCellToggle,
  onNotePreview,
  onPitchInteraction,
  showStepNumbers = false,
  trackId,
}) {
  const noteIndexById = useMemo(() => new Map(
    notes.map(({ note }, rowIndex) => [note, rowIndex]),
  ), [notes]);
  const initialTopRow = noteIndexById.get(initialTopNote)
    ?? Math.min(PIANO_ROLL_VISIBLE_ROWS, Math.max(0, notes.length - PIANO_ROLL_VISIBLE_ROWS));
  const previousActiveNoteIdsRef = useRef(new Set());
  const previousPitchReveal = useRef(revealPitchOnChange);
  const durationDrag = useRef(null);
  const resizeConsumedClick = useRef(false);
  const [resizeTarget, setResizeTarget] = useState(null);
  const {
    canScrollPitchDown,
    canScrollPitchUp,
    handlePitchViewportScroll,
    handlePitchWheel,
    revealPitchRow,
    scalePitchViewportRef,
    scrollPitchByOctave,
    setBeatCellsViewportRef,
  } = usePitchScrollSync({
    initialTopRow,
    noteCount: notes.length,
    onPitchInteraction,
  });
  const {
    handleBlurCapture,
    handleFocusCapture,
    handlePointerLeave,
    handlePointerOver,
    pianoRollRef,
  } = usePianoRollRowIndicator();

  useEffect(() => {
    const pianoRoll = pianoRollRef.current;
    if (!pianoRoll) return undefined;

    pianoRoll.addEventListener('wheel', handlePitchWheel, { passive: false });
    return () => pianoRoll.removeEventListener('wheel', handlePitchWheel);
  }, [handlePitchWheel, pianoRollRef]);

  useLayoutEffect(() => {
    const changed = previousPitchReveal.current !== revealPitchOnChange;
    previousPitchReveal.current = revealPitchOnChange;
    if (changed && revealPitchOnChange !== undefined && !durationDrag.current) {
      revealPitchRow(noteIndexById.get(initialTopNote));
    }
  }, [initialTopNote, noteIndexById, revealPitchOnChange, revealPitchRow]);

  useLayoutEffect(() => {
    const nextActiveNoteIds = activeNoteIds instanceof Set
      ? activeNoteIds
      : new Set(activeNoteIds ?? []);
    let latestAddedNoteId = null;

    if (autoRevealActiveNote) {
      nextActiveNoteIds.forEach((noteId) => {
        if (!previousActiveNoteIdsRef.current.has(noteId)) latestAddedNoteId = noteId;
      });
    }
    previousActiveNoteIdsRef.current = new Set(nextActiveNoteIds);

    if (latestAddedNoteId) {
      revealPitchRow(noteIndexById.get(latestAddedNoteId));
    }
  }, [activeNoteIds, autoRevealActiveNote, noteIndexById, revealPitchRow]);

  function startResize(event, step, note, edge) {
    if (event.button !== 0 || durationDrag.current) return;
    const handle = event.currentTarget;
    const cell = handle.closest('.pitch-step-cell');
    const row = cell.dataset.row;
    const side = edge === 'start' ? 'left' : 'right';
    const edges = Array.from(pianoRollRef.current.querySelectorAll(`.pitch-step-cell[data-row="${row}"]`),
      element => ({ step: Number(element.dataset.step), x: element.getBoundingClientRect()[side] }));
    const anchor = cell.getBoundingClientRect()[side];
    event.stopPropagation();
    event.preventDefault();
    cell.focus({ preventScroll: true });
    handle.setPointerCapture(event.pointerId);
    resizeConsumedClick.current = true;
    durationDrag.current = { pointer: event.pointerId, step, note, edge, edges, anchor, origin: event.clientX };
  }

  function resizeStep(event, drag) {
    const target = drag.anchor + event.clientX - drag.origin;
    return drag.edges.reduce((nearest, edge) =>
      Math.abs(edge.x - target) < Math.abs(nearest.x - target) ? edge : nearest).step;
  }

  function moveResize(event) {
    const drag = durationDrag.current;
    if (drag?.pointer !== event.pointerId) return;
    const step = resizeStep(event, drag);
    if (drag.target === step) return;
    drag.target = step;
    setResizeTarget({ note: drag.note, step });
  }

  function finishResize(event, commit = false) {
    const drag = durationDrag.current;
    if (drag?.pointer !== event.pointerId) return;
    durationDrag.current = null;
    setResizeTarget(null);
    if (!commit) return;
    const delta = resizeStep(event, drag) - drag.step;
    if (delta) onCellResize(drag.step, drag.note, delta, drag.edge);
  }

  return (
    <div
      className={`seq-body piano-roll ${trackId}-seq-body`}
      ref={pianoRollRef}
      role="group"
      aria-label={ariaLabel}
      data-rhythm-template={highlightedStepIds.size > 0 ? 'true' : undefined}
      data-track-id={trackId}
      style={{ '--piano-roll-total-rows': notes.length }}
      onBlurCapture={handleBlurCapture}
      onFocusCapture={handleFocusCapture}
      onPointerLeave={handlePointerLeave}
      onPointerOver={handlePointerOver}
      onPointerDownCapture={onCellResize ? () => { resizeConsumedClick.current = false; } : undefined}
    >
      <aside className={`scale-rail ${trackId}-scale-rail`} aria-label={`${ariaLabel} note ruler`}>
        <button
          className="scale-arrow"
          aria-label="Scroll up an octave"
          title="Scroll up an octave"
          type="button"
          disabled={!canScrollPitchUp}
          onClick={() => scrollPitchByOctave(-1)}
        >
          {renderIcon(ChevronUp)}
        </button>
        <div
          className="scale-notes-viewport"
          ref={scalePitchViewportRef}
          onScroll={handlePitchViewportScroll}
        >
          <div className={`scale-notes ${trackId}-scale-notes`}>
            {createElement(PianoRollRowIndicator)}
            {notes.map((note, rowIndex) => (
              createElement(PianoRollNoteKey, {
                active: activeNoteIds.has(note.note),
                disabled,
                highlighted: highlightedNoteIds.has(note.note),
                key: note.note,
                note,
                onNotePreview,
                rowIndex,
                trackId,
              })
            ))}
          </div>
        </div>
        <button
          className="scale-arrow"
          aria-label="Scroll down an octave"
          title="Scroll down an octave"
          type="button"
          disabled={!canScrollPitchDown}
          onClick={() => scrollPitchByOctave(1)}
        >
          {renderIcon(ChevronDown)}
        </button>
      </aside>

      <div className={`piano-roll-grid ${trackId}-grid`}>
        {BEAT_NUMBERS.map((beatNumber) => {
          const beatIndex = beatNumber - 1;

          return (
            <div
              className={`beat-group piano-roll-beat-group ${trackId}-beat-group`}
              key={beatNumber}
            >
              <div
                className="pitch-grid-head-spacer rhythm-step-ruler"
                aria-hidden="true"
              >
                {BEAT_NUMBERS.map((_stepNumber, colIndex) => {
                  const step = beatIndex * 4 + colIndex;
                  const rhythmHighlighted = highlightedStepIds.has(step);
                  const activeRhythmStep = rhythmHighlighted && activeHighlightedStep === step;

                  return (
                    <span
                      className={[
                        'rhythm-step-marker',
                        rhythmHighlighted ? 'highlighted' : '',
                        activeRhythmStep ? 'next' : '',
                      ].filter(Boolean).join(' ')}
                      data-step={step}
                      key={step}
                    >{showStepNumbers ? step + 1 : null}</span>
                  );
                })}
              </div>
              <div
                className="beat-cells-viewport"
                ref={(viewport) => setBeatCellsViewportRef(beatIndex, viewport)}
                onScroll={handlePitchViewportScroll}
              >
                <div className={`beat-cells ${trackId}-beat-cells`}>
                  {createElement(PianoRollRowIndicator)}
                  {notes.flatMap((note, rowIndex) => (
                    BEAT_NUMBERS.map((stepNumber, colIndex) => {
                      const step = beatIndex * 4 + colIndex;
                      const renderState = getCellRenderState?.(step, note.note) ?? null;
                      const active = renderState?.active ?? isCellActive(step, note.note);
                      const noteStart = renderState?.start ?? active;
                      const sustained = active && !noteStart;
                      const highlighted = highlightedNoteIds.has(note.note);
                      const rhythmHighlighted = highlightedStepIds.has(step);
                      const previewing = activeNoteIds.has(note.note);
                      const resizeEdges = !disabled && onCellResize && active
                        ? [noteStart && 'start', renderState?.end && 'end'].filter(Boolean) : [];

                      return (
                        <button
                          className={[
                            'pitch-step-cell',
                            `${trackId}-cell`,
                            note.sharp ? 'sharp' : '',
                            highlighted ? 'scale-tone' : '',
                            rhythmHighlighted ? 'rhythm-column' : '',
                            rhythmHighlighted && activeHighlightedStep === step
                              ? 'rhythm-column-next'
                              : '',
                            active ? 'active' : '',
                            noteStart ? 'note-start' : '',
                            sustained ? 'note-sustain' : '',
                            previewing ? 'previewing' : '',
                          ].filter(Boolean).join(' ')}
                          data-duration-steps={noteStart && renderState?.durationSteps > 1
                            ? renderState.durationSteps
                            : undefined}
                          data-attack-count={renderState?.attackCount > 1 ? renderState.attackCount : undefined}
                          data-row={rowIndex}
                          data-col={colIndex}
                          data-note={note.note}
                          data-step={step}
                          data-resize-target={resizeTarget?.note === note.note && resizeTarget.step === step || undefined}
                          key={`${note.note}-${step}`}
                          type="button"
                          aria-label={`${formatNoteLabel(note.note)} beat ${beatNumber}.${stepNumber}${renderState?.attackCount > 1 ? `，${renderState.attackCount}次起音` : ''}`}
                          aria-pressed={active}
                          aria-keyshortcuts={active && onCellResize ? 'Shift+ArrowLeft Shift+ArrowRight Alt+Shift+ArrowLeft Alt+Shift+ArrowRight' : undefined}
                          disabled={disabled}
                          onClick={(event) => {
                            if (onCellPressStart || (event.detail && resizeConsumedClick.current)) return;
                            onCellToggle(step, note.note, event);
                          }}
                          onPointerDown={(event) => {
                            if (!onCellPressStart) return;
                            event.currentTarget.setPointerCapture?.(event.pointerId);
                            onCellPressStart(step, note.note, event);
                          }}
                          onPointerUp={(event) => {
                            if (!onCellPressEnd) return;
                            event.currentTarget.releasePointerCapture?.(event.pointerId);
                            onCellPressEnd(step, note.note);
                          }}
                          onPointerCancel={() => onCellPressEnd?.(step, note.note)}
                          onKeyDown={active && onCellResize ? event => {
                            if (!event.shiftKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                            event.preventDefault();
                            onCellResize(step, note.note, event.key === 'ArrowLeft' ? -1 : 1, event.altKey ? 'start' : 'end');
                          } : undefined}
                        >{resizeEdges.map(edge => <span key={edge} className="pitch-duration-handle" data-edge={edge}
                          title={edge === 'start' ? '拖动调整起音' : '拖动调整结束'} aria-hidden="true"
                          onPointerDown={event => startResize(event, step, note.note, edge)}
                          onPointerMove={moveResize} onPointerUp={event => finishResize(event, true)}
                          onPointerCancel={finishResize} onLostPointerCapture={finishResize}
                          onClick={event => event.stopPropagation()}/>)}
                        </button>
                      );
                    })
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PianoRoll };
