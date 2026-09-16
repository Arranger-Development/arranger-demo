import { getTimelineBars } from '../domain/projectLength.js';
import { TOTAL_BARS } from '../domain/musicConstants.js';
import { getTrackType } from '../domain/trackInstances.js';
import { hasTrackBarContent } from './trackContent.js';

function createClipPasteDestination(trackId, bar, totalBars = TOTAL_BARS) {
  if (
    typeof trackId !== 'string'
    || trackId.length === 0
    || !Number.isInteger(bar)
    || bar < 0
    || bar >= totalBars
  ) {
    return null;
  }

  return { bar, trackId };
}

function createRulerPasteDestination(clipClipboard, bar, totalBars = TOTAL_BARS) {
  if (
    !clipClipboard
    || !Number.isInteger(bar)
    || bar < 0
    || bar >= totalBars
  ) {
    return null;
  }

  return {
    bar,
    trackId: clipClipboard.kind === 'timeline-range'
      ? null
      : clipClipboard.trackId,
  };
}

function resolveClipPasteTarget({
  clipClipboard,
  pasteDestination,
  state,
}) {
  if (!clipClipboard || !pasteDestination || !state) return null;

  const targetBar = pasteDestination.bar;
  if (clipClipboard.kind === 'timeline-range') {
    const barCount = clipClipboard.sourceEndBar - clipClipboard.sourceStartBar + 1;
    if (
      !Number.isInteger(barCount)
      || barCount < 1
      || !Array.isArray(clipClipboard.items)
      || clipClipboard.items.length === 0
      || !Number.isInteger(targetBar)
      || targetBar < 0
      || targetBar + barCount > getTimelineBars(state)
    ) {
      return null;
    }

    const targetContentCount = clipClipboard.items.filter((item) => (
      hasTrackBarContent(
        state.matrix,
        item.trackId,
        targetBar + item.barOffset,
      )
    )).length;

    return {
      kind: 'timeline-range',
      targetBar,
      targetContentCount,
    };
  }

  const targetTrackId = pasteDestination.trackId;
  if (
    (clipClipboard.trackType ?? getTrackType(state, clipClipboard.trackId))
      !== getTrackType(state, targetTrackId)
    || !Number.isInteger(targetBar)
    || targetBar < 0 || targetBar >= getTimelineBars(state)
    || !Array.isArray(state.matrix[targetTrackId])
    || typeof state.getClipForTrackBar !== 'function'
  ) {
    return null;
  }

  const targetClip = state.getClipForTrackBar(targetTrackId, targetBar);
  return {
    targetBar,
    targetClip,
    targetHasContent: hasTrackBarContent(state.matrix, targetTrackId, targetBar),
    targetTrackId,
  };
}

export {
  createClipPasteDestination,
  createRulerPasteDestination,
  resolveClipPasteTarget,
};
