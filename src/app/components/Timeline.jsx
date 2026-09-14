import {
  Plus,
} from 'lucide-react';
import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import {
  STEPS_PER_BAR,
  TOTAL_BARS,
} from '../../domain/musicConstants.js';
import { getTimelinePlayheadSeekPosition } from '../timelinePlayhead.js';
import {
  createRulerTimelineSelection,
  createTimelineSelection,
  getTimelineCellFromPoint,
  isTimelineCellSelected,
  shouldStartTimelineMarquee,
} from '../timelineSelection.js';
import { renderIcon } from './icons.js';

const DRAG_THRESHOLD_PX = 6;
const DROP_FEEDBACK_MS = 700;
const DROP_FEEDBACK_CLASS_BY_TYPE = {
  move: 'drop-move',
  swap: 'drop-swap',
};

function didPointerDrag(event, dragSession) {
  return Math.abs(event.clientX - dragSession.startX) > DRAG_THRESHOLD_PX
    || Math.abs(event.clientY - dragSession.startY) > DRAG_THRESHOLD_PX;
}

function getBarFromRow(row, clientX, totalBars) {
  if (!row) return null;

  const rect = row.getBoundingClientRect();
  const rawBar = Math.floor(((clientX - rect.left) / rect.width) * totalBars);
  return Math.min(totalBars - 1, Math.max(0, rawBar));
}

function getBarFromTrack(trackId, clientX, totalBars) {
  return getBarFromRow(document.querySelector(`[data-track-row="${trackId}"]`), clientX, totalBars);
}

function findTrackBar(tracks, trackId, barIndex) {
  return tracks
    .find((track) => track.id === trackId)
    ?.bars.find((bar) => bar.bar === barIndex);
}

function createDragFeedback(tracks, dragSession, targetBar) {
  const targetClip = findTrackBar(tracks, dragSession.trackId, targetBar)?.clip;
  const type = targetClip && targetClip.id !== dragSession.clipId ? 'swap' : 'move';

  return {
    sourceBar: dragSession.sourceBar,
    targetBar,
    trackId: dragSession.trackId,
    type,
  };
}

function getDropZoneClass(trackId, bar, dragOverBar, dragFeedback) {
  const classes = ['bar-drop-zone'];
  const hasDropFeedback = dragFeedback?.trackId === trackId
    && (dragFeedback.sourceBar === bar || dragFeedback.targetBar === bar);

  if (dragOverBar?.trackId === trackId && dragOverBar.bar === bar) {
    classes.push('drag-over');
  }

  if (hasDropFeedback) {
    classes.push(DROP_FEEDBACK_CLASS_BY_TYPE[dragFeedback.type]);
  }

  return classes.join(' ');
}

function getClipFeedbackClass(trackId, bar, dragFeedback) {
  if (dragFeedback?.trackId !== trackId) return '';
  if (dragFeedback.sourceBar !== bar && dragFeedback.targetBar !== bar) return '';
  return DROP_FEEDBACK_CLASS_BY_TYPE[dragFeedback.type];
}

function getTimelineSelectionStyle(selection, trackIds) {
  if (!selection || !Array.isArray(trackIds) || trackIds.length === 0) return undefined;

  const selectedTrackIndexes = selection.trackIds
    .map((trackId) => trackIds.indexOf(trackId))
    .filter((trackIndex) => trackIndex >= 0);
  if (selectedTrackIndexes.length === 0) return undefined;

  const startTrackIndex = Math.min(...selectedTrackIndexes);
  const endTrackIndex = Math.max(...selectedTrackIndexes);

  return {
    '--selection-start-bar': selection.startBar,
    '--selection-bar-count': selection.endBar - selection.startBar + 1,
    '--selection-start-track': startTrackIndex,
    '--selection-track-count': endTrackIndex - startTrackIndex + 1,
  };
}

function getTutorialBarRole(tutorialTargets, bar) {
  return tutorialTargets?.timelineBars?.find((target) => target.bar === bar)?.role ?? null;
}

function getTutorialBarClass(role) {
  if (role === 'completed') return 'tutorial-bar-completed';
  if (role === 'target') return 'tutorial-bar-target';
  return '';
}

function Clip({
  active,
  clip,
  dragFeedbackClass,
  dragging,
  onMouseDownClip,
  onOpenClip,
  onTutorialOpenClip,
  rangeSelected,
  shouldIgnoreClick,
  tutorialLocked,
  tutorialBarRole,
  tutorialTimelineBarsCount,
  track,
}) {
  if (!clip) return null;

  const handleClick = (event) => {
    event.stopPropagation();
    if (shouldIgnoreClick()) return;
    if (
      tutorialLocked
      && track.type === 'drums'
      && tutorialTimelineBarsCount
      && tutorialBarRole !== 'target'
    ) {
      return;
    }

    if (onTutorialOpenClip(clip) === false) return;
    onOpenClip(clip.id);
  };
  const chordLabel = track.type === 'chord' ? clip.chordLabel : null;
  const loopName = /^(Loop [1-5]) · (.+)$/.exec(clip.name);
  const loopLabel = loopName?.[1];
  const clipName = loopName?.[2] ?? clip.name;
  const description = chordLabel ? `${clip.name} · ${chordLabel}` : clip.name;
  const isEmpty = !chordLabel && !clip.hasContent;

  return (
    <button
      className={[
        'clip',
        active ? 'selected' : '',
        dragging ? 'clip-dragging' : '',
        rangeSelected ? 'range-selected' : '',
        dragFeedbackClass,
        getTutorialBarClass(tutorialBarRole),
      ].filter(Boolean).join(' ')}
      data-type={track.type}
      data-track-id={track.id}
      data-bar-index={clip.bar}
      data-tutorial-anchor={`${track.id}-bar-${clip.bar}`}
      style={{ '--bar-index': clip.bar }}
      aria-label={`${track.label} clip bar ${clip.bar + 1}`}
      aria-description={description}
      title={description}
      type="button"
      onClick={handleClick}
      onMouseDown={(event) => {
        if (
          tutorialLocked
          && track.type === 'drums'
          && tutorialTimelineBarsCount
          && tutorialBarRole !== 'target'
        ) {
          return;
        }
        onMouseDownClip(event, clip, track.id);
      }}
    >
      <div className="clip-copy">
        {loopLabel || chordLabel || isEmpty ? (
          <div className="clip-meta">
            {loopLabel ? <span className="clip-loop-label">{loopLabel}</span> : null}
            {chordLabel ? <span className="clip-chord-name">{chordLabel}</span> : null}
            {isEmpty ? <span className="clip-empty-tag">empty</span> : null}
          </div>
        ) : null}
        <div className="clip-name">{clipName}</div>
      </div>
    </button>
  );
}

const Timeline = forwardRef(function Timeline(
  {
    activeTrackId,
    currentBar,
    currentStep,
    totalBars = TOTAL_BARS,
    onAddClip,
    onMoveClip,
    onOpenClip,
    onTransportSeek = () => {},
    onTutorialOpenClip = () => true,
    onTrackSelect,
    onTimelineSelectionChange = () => {},
    selectedClipId,
    timelineSelection,
    tutorialLocked = false,
    tutorialTargets,
    tracks,
  },
  scrollRef,
) {
  const [dragSession, setDragSession] = useState(null);
  const [dragFeedback, setDragFeedback] = useState(null);
  const [dragOverBar, setDragOverBar] = useState(null);
  const [isPlayheadDragging, setIsPlayheadDragging] = useState(false);
  const [marqueeSelection, setMarqueeSelection] = useState(null);
  const [marqueeSession, setMarqueeSession] = useState(null);
  const [suppressNextClick, setSuppressNextClick] = useState(false);
  const feedbackTimerRef = useRef(null);
  const gridClickResetTimerRef = useRef(null);
  const gridRef = useRef(null);
  const rulerClickResetTimerRef = useRef(null);
  const rulerRef = useRef(null);
  const suppressGridClickRef = useRef(false);
  const suppressRulerClickRef = useRef(false);
  const trackIds = useMemo(() => tracks.map((track) => track.id), [tracks]);
  const displayedTimelineSelection = marqueeSelection ?? timelineSelection;
  const timelineSelectionStyle = getTimelineSelectionStyle(
    displayedTimelineSelection,
    trackIds,
  );
  const flatStep = currentBar * STEPS_PER_BAR + currentStep;
  const playheadLeft = `${(flatStep / (totalBars * STEPS_PER_BAR)) * 100}%`;
  const tutorialPlayheadRole = tutorialTargets?.playhead?.role ?? null;
  const getPlayheadTutorialClass = (baseClass) => [
    baseClass,
    tutorialPlayheadRole === 'target' ? 'tutorial-playhead-target' : '',
    tutorialPlayheadRole === 'completed' ? 'tutorial-playhead-completed' : '',
  ].filter(Boolean).join(' ');
  const playheadLineClass = getPlayheadTutorialClass('ruler-playhead');
  const playheadGridClass = getPlayheadTutorialClass('playhead');
  const playheadHitClass = 'playhead-hit';
  const tutorialTimelineBars = new Set(
    (tutorialTargets?.timelineBars ?? []).map((target) => target.bar),
  );

  const shouldIgnoreClick = () => {
    if (!suppressNextClick) return false;

    setSuppressNextClick(false);
    return true;
  };

  const suppressClipClickAfterDrag = useCallback(() => {
    setSuppressNextClick(true);
    window.setTimeout(() => {
      setSuppressNextClick(false);
    }, 0);
  }, []);

  const suppressGridClickAfterMarquee = useCallback(() => {
    window.clearTimeout(gridClickResetTimerRef.current);
    suppressGridClickRef.current = true;
    gridClickResetTimerRef.current = window.setTimeout(() => {
      suppressGridClickRef.current = false;
    }, 0);
  }, []);

  const startMarqueeSession = (event, anchor, source) => {
    flushSync(() => setMarqueeSession({
      anchor,
      source,
      startX: event.clientX,
      startY: event.clientY,
    }));
  };

  const handleClipMouseDown = (event, clip, trackId) => {
    event.stopPropagation();
    if (event.shiftKey) return;

    flushSync(() => setDragSession({
      clipId: clip.id,
      sourceBar: clip.bar,
      startX: event.clientX,
      startY: event.clientY,
      trackId,
    }));
  };

  const showDragFeedback = useCallback((feedback) => {
    window.clearTimeout(feedbackTimerRef.current);
    setDragFeedback(feedback);
    feedbackTimerRef.current = window.setTimeout(() => {
      setDragFeedback(null);
    }, DROP_FEEDBACK_MS);
  }, []);

  const handleTrackRowClick = (event, trackId) => {
    const target = event.target;
    if (target.closest('button')) return;

    const barIndex = target.dataset.barIndex
      ? Number(target.dataset.barIndex)
      : getBarFromRow(event.currentTarget, event.clientX, totalBars);

    if (
      tutorialLocked
      && trackId === 'drums'
      && tutorialTimelineBars.size
      && !tutorialTimelineBars.has(barIndex)
    ) {
      return;
    }

    onTimelineSelectionChange(null);
    onTrackSelect(trackId, Number.isInteger(barIndex) ? barIndex : undefined);
  };

  const handleGridMouseDownCapture = (event) => {
    if (!shouldStartTimelineMarquee({
      button: event.button,
      shiftKey: event.shiftKey,
      tutorialLocked,
    })) {
      return;
    }

    const anchor = getTimelineCellFromPoint({
      clientX: event.clientX,
      clientY: event.clientY,
      rect: gridRef.current?.getBoundingClientRect(),
      trackIds,
      totalBars,
    });
    if (!anchor) return;

    event.preventDefault();
    event.stopPropagation();
    startMarqueeSession(event, anchor, 'track');
  };

  const handleGridClickCapture = (event) => {
    if (!suppressGridClickRef.current) return;

    window.clearTimeout(gridClickResetTimerRef.current);
    suppressGridClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleRulerMouseDown = (event) => {
    if (event.button !== 0 || tutorialLocked) return;

    const bar = getBarFromRow(event.currentTarget, event.clientX, totalBars);
    if (bar === null) return;

    startMarqueeSession(event, {
      bar,
      trackId: trackIds[0],
    }, 'ruler');
  };

  const seekPlayheadFromClientX = useCallback((clientX) => {
    const nextPosition = getTimelinePlayheadSeekPosition(
      clientX,
      rulerRef.current?.getBoundingClientRect(),
      totalBars,
    );
    if (!nextPosition) return;

    onTransportSeek(nextPosition.bar, nextPosition.step);
  }, [onTransportSeek, totalBars]);

  const handlePlayheadMouseDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.clearTimeout(rulerClickResetTimerRef.current);
    suppressRulerClickRef.current = true;
    setIsPlayheadDragging(true);
    seekPlayheadFromClientX(event.clientX);
  };

  const handleRulerClick = (event) => {
    if (suppressRulerClickRef.current) {
      window.clearTimeout(rulerClickResetTimerRef.current);
      suppressRulerClickRef.current = false;
      return;
    }

    seekPlayheadFromClientX(event.clientX);
  };

  useEffect(() => () => {
    window.clearTimeout(feedbackTimerRef.current);
    window.clearTimeout(gridClickResetTimerRef.current);
    window.clearTimeout(rulerClickResetTimerRef.current);
  }, []);

  useEffect(() => {
    if (!timelineSelection) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onTimelineSelectionChange(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTimelineSelectionChange, timelineSelection]);

  useEffect(() => {
    if (!dragSession) return undefined;

    const handleMouseMove = (event) => {
      if (!didPointerDrag(event, dragSession)) return;

      const targetBar = getBarFromTrack(dragSession.trackId, event.clientX, totalBars);
      if (targetBar === null) return;

      setDragOverBar({ trackId: dragSession.trackId, bar: targetBar });
    };

    const handleMouseUp = (event) => {
      setDragSession(null);
      setDragOverBar(null);

      if (!didPointerDrag(event, dragSession)) return;

      const targetBar = getBarFromTrack(dragSession.trackId, event.clientX, totalBars);
      if (targetBar === null) return;

      suppressClipClickAfterDrag();
      showDragFeedback(createDragFeedback(tracks, dragSession, targetBar));
      onMoveClip(dragSession.clipId, targetBar);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    dragSession,
    onMoveClip,
    showDragFeedback,
    suppressClipClickAfterDrag,
    tracks,
    totalBars,
  ]);

  useEffect(() => {
    if (!marqueeSession) return undefined;

    let dragged = false;
    let latestSelection = marqueeSession.source === 'track'
      ? createTimelineSelection(marqueeSession.anchor, marqueeSession.anchor, trackIds, totalBars)
      : null;

    const getSelectionAtPoint = (clientX, clientY) => {
      const gridRect = gridRef.current?.getBoundingClientRect();
      if (!gridRect) return null;
      if (
        marqueeSession.source === 'ruler'
        && (
          clientY < gridRect.top
          || clientY > gridRect.bottom
        )
      ) {
        return null;
      }
      if (
        marqueeSession.source === 'track'
        && (
          clientX < gridRect.left
          || clientX > gridRect.right
          || clientY < gridRect.top
          || clientY > gridRect.bottom
        )
      ) {
        return null;
      }

      const focus = getTimelineCellFromPoint({
        clientX,
        clientY,
        rect: gridRect,
        trackIds,
        totalBars,
      });
      if (marqueeSession.source === 'ruler') {
        return createRulerTimelineSelection(
          marqueeSession.anchor.bar,
          focus,
          trackIds,
          totalBars,
        );
      }

      return createTimelineSelection(marqueeSession.anchor, focus, trackIds, totalBars);
    };

    const handleMouseMove = (event) => {
      if (!didPointerDrag(event, marqueeSession)) return;

      const selection = getSelectionAtPoint(event.clientX, event.clientY);
      if (!selection) return;

      event.preventDefault();
      dragged = true;
      latestSelection = selection;
      setMarqueeSelection(selection);
    };

    const handleMouseUp = (event) => {
      const selection = dragged
        ? getSelectionAtPoint(event.clientX, event.clientY) ?? latestSelection
        : latestSelection;

      if (selection) {
        if (marqueeSession.source === 'track') {
          suppressGridClickAfterMarquee();
        } else if (marqueeSession.source === 'ruler') {
          window.clearTimeout(rulerClickResetTimerRef.current);
          suppressRulerClickRef.current = true;
          rulerClickResetTimerRef.current = window.setTimeout(() => {
            suppressRulerClickRef.current = false;
          }, 0);
        }
        onTimelineSelectionChange(selection);
      }

      setMarqueeSession(null);
      setMarqueeSelection(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    marqueeSession,
    onTimelineSelectionChange,
    suppressGridClickAfterMarquee,
    trackIds,
    totalBars,
  ]);

  useEffect(() => {
    if (!isPlayheadDragging) return undefined;

    const handleMouseMove = (event) => {
      seekPlayheadFromClientX(event.clientX);
    };
    const handleMouseUp = (event) => {
      seekPlayheadFromClientX(event.clientX);
      setIsPlayheadDragging(false);
      window.clearTimeout(rulerClickResetTimerRef.current);
      rulerClickResetTimerRef.current = window.setTimeout(() => {
        suppressRulerClickRef.current = false;
      }, 0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPlayheadDragging, seekPlayheadFromClientX]);

  return (
    <section
      className={[
        'timeline-col',
        isPlayheadDragging ? 'playhead-dragging' : '',
      ].filter(Boolean).join(' ')}
      data-tutorial-target="track-area"
      ref={scrollRef}
      style={{ '--bars': totalBars, '--timeline-min-width': `${totalBars * 80}px`, '--track-count': tracks.length }}
    >
      <div className="timeline-bezel" aria-hidden="true" />
      <div
        className="ruler"
        aria-label="Timeline bars"
        onClick={handleRulerClick}
        onMouseDown={handleRulerMouseDown}
        ref={rulerRef}
      >
        {Array.from({ length: totalBars }, (_, index) => index + 1).map((barNumber) => (
          <div
            className={`bar-label${barNumber === 1 || barNumber === 5 ? ' major' : ''} mono`}
            key={barNumber}
          >
            {barNumber}
          </div>
        ))}
        <div className={playheadLineClass} style={{ left: playheadLeft }}>
          <div
            aria-label="Drag transport playhead"
            aria-valuemax={totalBars * STEPS_PER_BAR - 1}
            aria-valuemin={0}
            aria-valuenow={flatStep}
            className={playheadHitClass}
            onMouseDown={handlePlayheadMouseDown}
            role="slider"
            tabIndex={0}
          />
        </div>
      </div>

      <div
        className={[
          'grid',
          marqueeSession ? 'marquee-selecting' : '',
        ].filter(Boolean).join(' ')}
        onClickCapture={handleGridClickCapture}
        onMouseDownCapture={handleGridMouseDownCapture}
        ref={gridRef}
      >
        <div className="grid-glass" aria-hidden="true" />
        <div className="grid-rows" aria-hidden="true">
          {tracks.map((track) => (
            <div className="row" key={track.id} />
          ))}
        </div>

        <div className="hover-rows">
          {tracks.map((track, trackIndex) => (
            <div
              className={[
                'hover-row',
                track.hasClip ? 'has-phrase' : '',
                track.id === activeTrackId ? 'active' : '',
              ].filter(Boolean).join(' ')}
              data-type={track.type}
              data-track-row={track.id}
              data-track-index={trackIndex}
              key={track.id}
              onClick={(event) => handleTrackRowClick(event, track.id)}
            >
              {track.bars.map((bar) => {
                const dropZoneClass = getDropZoneClass(track.id, bar.bar, dragOverBar, dragFeedback);
                const rangeSelected = isTimelineCellSelected(
                  displayedTimelineSelection,
                  track.id,
                  bar.bar,
                );
                const tutorialBarRole = track.type === 'drums' && track.id === 'drums'
                  ? getTutorialBarRole(tutorialTargets, bar.bar)
                  : null;
                const dropZoneTutorialRole = bar.clip ? null : tutorialBarRole;

                return (
                  <div
                    className={[
                      dropZoneClass,
                      rangeSelected ? 'range-selected' : '',
                      getTutorialBarClass(dropZoneTutorialRole),
                    ]
                      .filter(Boolean).join(' ')}
                    aria-label={`Drop clip on ${track.label} bar ${bar.barNumber}`}
                    data-bar-index={bar.bar}
                    data-tutorial-anchor={bar.clip
                      ? undefined
                      : `${track.id}-bar-${bar.bar}`}
                    data-tutorial-role={dropZoneTutorialRole ?? undefined}
                    key={`${track.id}-drop-${bar.bar}`}
                    style={{ '--bar-index': bar.bar }}
                  />
                );
              })}
              {track.bars.map((bar) => createElement(Clip, {
                active: bar.clip?.id === selectedClipId,
                clip: bar.clip,
                dragFeedbackClass: getClipFeedbackClass(track.id, bar.bar, dragFeedback),
                dragging: dragSession?.clipId === bar.clip?.id,
                key: bar.clip?.id ?? `${track.id}-empty-${bar.bar}`,
                onMouseDownClip: handleClipMouseDown,
                onOpenClip,
                onTutorialOpenClip,
                shouldIgnoreClick,
                rangeSelected: isTimelineCellSelected(
                  displayedTimelineSelection,
                  track.id,
                  bar.bar,
                ),
                tutorialLocked,
                tutorialBarRole: track.type === 'drums' && track.id === 'drums'
                  ? getTutorialBarRole(tutorialTargets, bar.bar)
                  : null,
                tutorialTimelineBarsCount: tutorialTimelineBars.size,
                track,
              }))}
              {track.bars.map((bar) => (
                bar.canAddClip ? (
                  <button
                    className="add-clip"
                    aria-label={`Add clip to ${track.label} bar ${bar.barNumber}`}
                    data-bar-index={bar.bar}
                    key={`${track.id}-add-${bar.bar}`}
                    style={{ '--bar-index': bar.bar }}
                    type="button"
                    disabled={tutorialLocked
                      && track.type === 'drums'
                      && track.id === 'drums'
                      && tutorialTimelineBars.size
                      && !tutorialTimelineBars.has(bar.bar)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (
                        tutorialLocked
                        && track.type === 'drums'
                        && track.id === 'drums'
                        && tutorialTimelineBars.size
                        && !tutorialTimelineBars.has(bar.bar)
                      ) {
                        return;
                      }
                      onAddClip(track.id, bar.bar);
                    }}
                  >
                    {renderIcon(Plus)}
                  </button>
                ) : null
              ))}
            </div>
          ))}
        </div>

        {timelineSelectionStyle ? (
          <div
            aria-label={`Selected bars ${displayedTimelineSelection.startBar + 1} through ${displayedTimelineSelection.endBar + 1}`}
            className="timeline-marquee-selection"
            role="status"
            style={timelineSelectionStyle}
          />
        ) : null}

        <div className={playheadGridClass} style={{ left: playheadLeft }}>
          <div
            aria-label="Drag transport playhead"
            aria-valuemax={totalBars * STEPS_PER_BAR - 1}
            aria-valuemin={0}
            aria-valuenow={flatStep}
            className={playheadHitClass}
            onMouseDown={handlePlayheadMouseDown}
            role="slider"
            tabIndex={0}
          />
        </div>
      </div>
    </section>
  );
});

export { Timeline };
