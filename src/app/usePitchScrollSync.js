import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  PIANO_ROLL_NOTES_PER_OCTAVE,
  PIANO_ROLL_OCTAVE_COUNT,
  PIANO_ROLL_VISIBLE_ROWS,
} from '../data/pianoRollNotes.js';

const DEFAULT_NOTE_COUNT = PIANO_ROLL_NOTES_PER_OCTAVE * PIANO_ROLL_OCTAVE_COUNT;
const SCROLL_EPSILON = 0.5;

function getMaxPitchScroll(viewport) {
  return viewport ? Math.max(0, viewport.scrollHeight - viewport.clientHeight) : 0;
}

function hasPitchScrollRows(
  noteCount,
  visibleRowCount = PIANO_ROLL_VISIBLE_ROWS,
) {
  return noteCount > visibleRowCount;
}

function getPitchRowStride(
  viewport,
  noteCount = DEFAULT_NOTE_COUNT,
  visibleRowCount = PIANO_ROLL_VISIBLE_ROWS,
) {
  const scrollableRows = Math.max(0, noteCount - visibleRowCount);
  if (!scrollableRows) return 0;
  return getMaxPitchScroll(viewport) / scrollableRows;
}

function getPitchScrollTopForRow(
  viewport,
  rowIndex,
  noteCount = DEFAULT_NOTE_COUNT,
  visibleRowCount = PIANO_ROLL_VISIBLE_ROWS,
) {
  const maxTopRow = Math.max(0, noteCount - visibleRowCount);
  const clampedRow = Math.max(0, Math.min(maxTopRow, rowIndex));
  return clampedRow * getPitchRowStride(viewport, noteCount, visibleRowCount);
}

function getOctavePitchScrollStep(
  viewport,
  noteCount = DEFAULT_NOTE_COUNT,
  visibleRowCount = PIANO_ROLL_VISIBLE_ROWS,
) {
  return (
    getPitchRowStride(viewport, noteCount, visibleRowCount)
    * PIANO_ROLL_NOTES_PER_OCTAVE
  );
}

function getPitchPageStartRow(
  rowIndex,
  noteCount = DEFAULT_NOTE_COUNT,
  visibleRowCount = PIANO_ROLL_VISIBLE_ROWS,
) {
  const maxTopRow = Math.max(0, noteCount - visibleRowCount);
  const pageStart = Math.floor(Math.max(0, rowIndex) / visibleRowCount) * visibleRowCount;
  return Math.min(maxTopRow, pageStart);
}

function isPitchRowFullyVisible(
  viewport,
  scrollTop,
  rowIndex,
  noteCount = DEFAULT_NOTE_COUNT,
  visibleRowCount = PIANO_ROLL_VISIBLE_ROWS,
) {
  const rowStride = getPitchRowStride(viewport, noteCount, visibleRowCount);
  if (!rowStride) return true;

  const rowTop = rowIndex * rowStride;
  const rowBottom = rowTop + rowStride;
  const viewportBottom = scrollTop + visibleRowCount * rowStride;
  return (
    rowTop >= scrollTop - SCROLL_EPSILON
    && rowBottom <= viewportBottom + SCROLL_EPSILON
  );
}

function usePitchScrollSync(options = {}) {
  const {
    initialTopRow = PIANO_ROLL_VISIBLE_ROWS,
    noteCount = DEFAULT_NOTE_COUNT,
    onPitchInteraction = () => {},
    visibleRowCount = PIANO_ROLL_VISIBLE_ROWS,
  } = options;
  const scalePitchViewportRef = useRef(null);
  const beatCellsViewportRefs = useRef([]);
  const pitchScrollTopRef = useRef(0);
  const pitchRowStrideRef = useRef(0);
  const syncPitchScrollGuardRef = useRef(false);
  const syncPitchScrollFrameRef = useRef(null);
  const syncPitchScrollSourceRef = useRef(null);
  const hasInitializedPitchScrollRef = useRef(false);
  const [pitchScrollTop, setPitchScrollTop] = useState(0);
  const [pitchMaxScroll, setPitchMaxScroll] = useState(0);

  const setBeatCellsViewportRef = useCallback((beatIndex, viewport) => {
    beatCellsViewportRefs.current[beatIndex] = viewport;
    if (viewport) viewport.scrollTop = pitchScrollTopRef.current;
  }, []);

  const syncPitchScroll = useCallback((nextScrollTop, sourceViewport = null) => {
    const scaleViewport = scalePitchViewportRef.current;
    const fallbackViewport = beatCellsViewportRefs.current.find(Boolean);
    const scrollViewport = scaleViewport ?? fallbackViewport;
    const maxScroll = getMaxPitchScroll(scrollViewport);
    const clampedScrollTop = Math.max(0, Math.min(maxScroll, nextScrollTop));
    const viewports = [scaleViewport, ...beatCellsViewportRefs.current].filter(Boolean);

    setPitchMaxScroll((currentMaxScroll) => (
      Math.abs(currentMaxScroll - maxScroll) > SCROLL_EPSILON
        ? maxScroll
        : currentMaxScroll
    ));
    pitchScrollTopRef.current = clampedScrollTop;
    syncPitchScrollGuardRef.current = true;
    syncPitchScrollSourceRef.current = sourceViewport;
    viewports.forEach((viewport) => {
      if (Math.abs(viewport.scrollTop - clampedScrollTop) > SCROLL_EPSILON) {
        viewport.scrollTop = clampedScrollTop;
      }
    });

    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      if (syncPitchScrollFrameRef.current) {
        window.cancelAnimationFrame(syncPitchScrollFrameRef.current);
      }
      syncPitchScrollFrameRef.current = window.requestAnimationFrame(() => {
        syncPitchScrollGuardRef.current = false;
        syncPitchScrollSourceRef.current = null;
        syncPitchScrollFrameRef.current = null;
      });
    } else {
      syncPitchScrollGuardRef.current = false;
      syncPitchScrollSourceRef.current = null;
    }

    setPitchScrollTop((currentScrollTop) => (
      Math.abs(currentScrollTop - clampedScrollTop) > SCROLL_EPSILON
        ? clampedScrollTop
        : currentScrollTop
    ));
    return clampedScrollTop;
  }, []);

  const refreshPitchLayout = useCallback(() => {
    const viewport = scalePitchViewportRef.current
      ?? beatCellsViewportRefs.current.find(Boolean);
    if (!viewport) return;

    const nextRowStride = getPitchRowStride(viewport, noteCount, visibleRowCount);
    const previousRowStride = pitchRowStrideRef.current;
    const maxTopRow = Math.max(0, noteCount - visibleRowCount);
    const logicalTopRow = hasInitializedPitchScrollRef.current && previousRowStride > 0
      ? pitchScrollTopRef.current / previousRowStride
      : Math.max(0, Math.min(maxTopRow, initialTopRow));

    pitchRowStrideRef.current = nextRowStride;
    hasInitializedPitchScrollRef.current = true;
    syncPitchScroll(logicalTopRow * nextRowStride);
  }, [initialTopRow, noteCount, syncPitchScroll, visibleRowCount]);

  const handlePitchViewportScroll = useCallback((event) => {
    if (
      syncPitchScrollGuardRef.current
      && syncPitchScrollSourceRef.current !== event.currentTarget
    ) {
      return;
    }
    syncPitchScroll(event.currentTarget.scrollTop, event.currentTarget);
    onPitchInteraction();
  }, [onPitchInteraction, syncPitchScroll]);

  const handlePitchWheel = useCallback((event) => {
    if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (!hasPitchScrollRows(noteCount, visibleRowCount)) return;

    event.preventDefault();
    onPitchInteraction();
    syncPitchScroll(pitchScrollTopRef.current + event.deltaY);
  }, [noteCount, onPitchInteraction, syncPitchScroll, visibleRowCount]);

  const scrollPitchByOctave = useCallback((direction) => {
    const viewport = scalePitchViewportRef.current
      ?? beatCellsViewportRefs.current.find(Boolean);
    const octaveStep = getOctavePitchScrollStep(viewport, noteCount, visibleRowCount);
    if (!octaveStep) return;

    onPitchInteraction();
    syncPitchScroll(pitchScrollTopRef.current + direction * octaveStep);
  }, [noteCount, onPitchInteraction, syncPitchScroll, visibleRowCount]);

  const revealPitchRow = useCallback((rowIndex) => {
    const viewport = scalePitchViewportRef.current
      ?? beatCellsViewportRefs.current.find(Boolean);
    if (!viewport || !Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= noteCount) {
      return false;
    }
    if (isPitchRowFullyVisible(
      viewport,
      pitchScrollTopRef.current,
      rowIndex,
      noteCount,
      visibleRowCount,
    )) {
      return false;
    }

    const pageStartRow = getPitchPageStartRow(rowIndex, noteCount, visibleRowCount);
    syncPitchScroll(getPitchScrollTopForRow(
      viewport,
      pageStartRow,
      noteCount,
      visibleRowCount,
    ));
    return true;
  }, [noteCount, syncPitchScroll, visibleRowCount]);

  useLayoutEffect(() => {
    refreshPitchLayout();
    const viewport = scalePitchViewportRef.current
      ?? beatCellsViewportRefs.current.find(Boolean);
    if (!viewport || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(refreshPitchLayout);
    observer.observe(viewport);
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild);
    return () => observer.disconnect();
  }, [refreshPitchLayout]);

  useEffect(() => () => {
    if (
      syncPitchScrollFrameRef.current
      && typeof window !== 'undefined'
      && window.cancelAnimationFrame
    ) {
      window.cancelAnimationFrame(syncPitchScrollFrameRef.current);
    }
  }, []);

  return {
    canScrollPitchDown: pitchMaxScroll - pitchScrollTop > 1,
    canScrollPitchUp: pitchScrollTop > 1,
    handlePitchViewportScroll,
    handlePitchWheel,
    pitchMaxScroll,
    pitchScrollTop,
    pitchScrollTopRef,
    revealPitchRow,
    scalePitchViewportRef,
    scrollPitchByOctave,
    setBeatCellsViewportRef,
    syncPitchScroll,
  };
}

export {
  getMaxPitchScroll,
  getOctavePitchScrollStep,
  getPitchPageStartRow,
  getPitchRowStride,
  getPitchScrollTopForRow,
  hasPitchScrollRows,
  isPitchRowFullyVisible,
  usePitchScrollSync,
};
