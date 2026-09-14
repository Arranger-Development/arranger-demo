import {
  STEPS_PER_BAR,
  TOTAL_BARS,
} from '../domain/musicConstants.js';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shouldStartTimelineMarquee({
  button,
  shiftKey,
  tutorialLocked,
} = {}) {
  return button === 0 && shiftKey === true && tutorialLocked !== true;
}

function getTimelineCellFromPoint({
  clientX,
  clientY,
  rect,
  trackIds,
  totalBars = TOTAL_BARS,
}) {
  if (
    !rect
    || rect.width <= 0
    || rect.height <= 0
    || !Array.isArray(trackIds)
    || trackIds.length === 0
  ) {
    return null;
  }

  const normalizedX = clamp((clientX - rect.left) / rect.width, 0, 1 - Number.EPSILON);
  const normalizedY = clamp((clientY - rect.top) / rect.height, 0, 1 - Number.EPSILON);

  return {
    bar: clamp(Math.floor(normalizedX * totalBars), 0, totalBars - 1),
    trackId: trackIds[clamp(
      Math.floor(normalizedY * trackIds.length),
      0,
      trackIds.length - 1,
    )],
  };
}

function createTimelineSelection(anchor, focus, trackIds, totalBars = TOTAL_BARS) {
  if (!anchor || !focus || !Array.isArray(trackIds) || trackIds.length === 0) return null;

  const anchorTrackIndex = trackIds.indexOf(anchor.trackId);
  const focusTrackIndex = trackIds.indexOf(focus.trackId);
  if (
    anchorTrackIndex < 0
    || focusTrackIndex < 0
    || !Number.isInteger(anchor.bar)
    || !Number.isInteger(focus.bar)
  ) {
    return null;
  }

  const startTrackIndex = Math.min(anchorTrackIndex, focusTrackIndex);
  const endTrackIndex = Math.max(anchorTrackIndex, focusTrackIndex);

  return {
    startBar: clamp(Math.min(anchor.bar, focus.bar), 0, totalBars - 1),
    endBar: clamp(Math.max(anchor.bar, focus.bar), 0, totalBars - 1),
    trackIds: trackIds.slice(startTrackIndex, endTrackIndex + 1),
  };
}

function createRulerTimelineSelection(anchorBar, focus, trackIds, totalBars = TOTAL_BARS) {
  if (
    !Number.isInteger(anchorBar)
    || !focus
    || !Array.isArray(trackIds)
    || trackIds.length === 0
  ) {
    return null;
  }

  return createTimelineSelection({
    bar: anchorBar,
    trackId: trackIds[0],
  }, focus, trackIds, totalBars);
}

function isTimelineCellSelected(selection, trackId, bar) {
  return Boolean(
    selection
    && selection.trackIds?.includes(trackId)
    && Number.isInteger(bar)
    && bar >= selection.startBar
    && bar <= selection.endBar,
  );
}

function getTimelineSelectionClipIds(clips, selection) {
  if (!selection) return [];

  return (clips?.ids ?? []).filter((clipId) => {
    const clip = clips?.byId?.[clipId];
    return clip && isTimelineCellSelected(selection, clip.trackId, clip.bar);
  });
}

function getTimelineSelectionPlaybackOptions(selection, totalBars = TOTAL_BARS) {
  if (
    !selection
    || !Number.isInteger(selection.startBar)
    || !Number.isInteger(selection.endBar)
    || selection.startBar < 0
    || selection.startBar >= totalBars
    || selection.startBar > selection.endBar
    || !Array.isArray(selection.trackIds)
    || selection.trackIds.length === 0
  ) {
    return null;
  }

  return {
    audibleTrackIds: [...selection.trackIds],
    bar: selection.startBar,
    maxPlaybackSteps: (Math.min(selection.endBar, totalBars - 1) - selection.startBar + 1) * STEPS_PER_BAR,
    step: 0,
  };
}

export {
  createRulerTimelineSelection,
  createTimelineSelection,
  getTimelineCellFromPoint,
  getTimelineSelectionClipIds,
  getTimelineSelectionPlaybackOptions,
  isTimelineCellSelected,
  shouldStartTimelineMarquee,
};
