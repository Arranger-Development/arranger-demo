import { getTimelineBars } from '../domain/projectLength.js';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import useMusicStore from '../store/useMusicStore.js';
import {
  createClipPasteDestination,
  createRulerPasteDestination,
  resolveClipPasteTarget,
} from './clipPasteDestination.js';
import { getTimelineSelectionClipIds } from './timelineSelection.js';

function useClipClipboardActions({
  clips,
  onTimelineSelectionChange = () => {},
  selectedClipId,
  timelineSelection,
  withUndoCheckpoint,
}) {
  const [clipClipboard, setClipClipboard] = useState(null);
  const [pasteDestination, setPasteDestination] = useState(null);
  const [pendingClipPaste, setPendingClipPaste] = useState(null);
  const selectedClip = selectedClipId ? clips.byId[selectedClipId] : null;
  const timelineSelectionClipIds = getTimelineSelectionClipIds(clips, timelineSelection);
  const canCopyClip = Boolean(selectedClip || timelineSelectionClipIds.length);
  const canPasteClip = Boolean(resolveClipPasteTarget({
    clipClipboard,
    pasteDestination,
    state: useMusicStore.getState(),
  }));

  const clearClipClipboardState = useCallback(() => {
    setClipClipboard(null);
    setPasteDestination(null);
    setPendingClipPaste(null);
  }, []);

  const clearClipPasteDestination = useCallback(() => {
    setPasteDestination(null);
    setPendingClipPaste(null);
  }, []);

  const selectClipPasteDestination = useCallback((trackId, bar) => {
    setPendingClipPaste(null);
    setPasteDestination(
      clipClipboard ? createClipPasteDestination(trackId, bar, getTimelineBars(useMusicStore.getState())) : null,
    );
  }, [clipClipboard]);

  const selectRulerPasteDestination = useCallback((bar) => {
    setPendingClipPaste(null);
    setPasteDestination(createRulerPasteDestination(clipClipboard, bar, getTimelineBars(useMusicStore.getState())));
  }, [clipClipboard]);

  const getCurrentClipPasteTarget = useCallback(() => resolveClipPasteTarget({
    clipClipboard,
    pasteDestination,
    state: useMusicStore.getState(),
  }), [clipClipboard, pasteDestination]);

  const pasteClipToTarget = useCallback((target) => {
    if (!target || !clipClipboard) return null;

    let pasteResult = null;
    withUndoCheckpoint(() => {
      pasteResult = target.kind === 'timeline-range'
        ? useMusicStore.getState().pasteTimelineClipboardSnapshot(
          clipClipboard,
          target.targetBar,
        )
        : useMusicStore.getState().pasteClipClipboardSnapshot(
          clipClipboard,
          target.targetTrackId,
          target.targetBar,
        );
    });

    if (pasteResult && target.kind === 'timeline-range') {
      onTimelineSelectionChange({
        startBar: pasteResult.startBar,
        endBar: pasteResult.endBar,
        trackIds: pasteResult.trackIds,
      });
    }

    if (pasteResult) setPasteDestination(null);
    return pasteResult;
  }, [clipClipboard, onTimelineSelectionChange, withUndoCheckpoint]);

  const handleCopySelectedClip = useCallback(() => {
    if (timelineSelectionClipIds.length) {
      const snapshot = useMusicStore.getState().createTimelineClipboardSnapshot(
        timelineSelection,
      );
      if (!snapshot) return;

      setClipClipboard(snapshot);
      setPasteDestination(null);
      setPendingClipPaste(null);
      return;
    }

    if (!selectedClipId) return;

    const snapshot = useMusicStore.getState().createClipClipboardSnapshot(selectedClipId);
    if (!snapshot) return;

    setClipClipboard(snapshot);
    setPasteDestination(null);
    setPendingClipPaste(null);
  }, [selectedClipId, timelineSelection, timelineSelectionClipIds.length]);

  const handlePasteClipRequest = useCallback(() => {
    const target = getCurrentClipPasteTarget();
    if (!target) return;

    if (target.targetHasContent || target.targetContentCount > 0) {
      setPendingClipPaste(target);
      return;
    }

    pasteClipToTarget(target);
  }, [getCurrentClipPasteTarget, pasteClipToTarget]);

  const cancelClipPaste = useCallback(() => {
    setPendingClipPaste(null);
  }, []);

  const confirmClipPaste = useCallback(() => {
    if (!pendingClipPaste || !clipClipboard) {
      setPendingClipPaste(null);
      return;
    }

    pasteClipToTarget(pendingClipPaste);
    setPendingClipPaste(null);
  }, [clipClipboard, pasteClipToTarget, pendingClipPaste]);

  useEffect(() => {
    const handlePasteDestinationEscape = (event) => {
      if (event.key !== 'Escape') return;
      clearClipPasteDestination();
    };

    window.addEventListener('keydown', handlePasteDestinationEscape, true);
    return () => window.removeEventListener('keydown', handlePasteDestinationEscape, true);
  }, [clearClipPasteDestination]);

  return {
    canCopyClip,
    canPasteClip,
    cancelClipPaste,
    clearClipClipboardState,
    clearClipPasteDestination,
    confirmClipPaste,
    handleCopySelectedClip,
    handlePasteClipRequest,
    pendingClipPaste,
    selectClipPasteDestination,
    selectRulerPasteDestination,
    selectedClip,
  };
}

export {
  useClipClipboardActions,
};
