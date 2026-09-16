const DEFAULT_GAP = 14;
const DEFAULT_MARGIN = 12;

function fits(candidate, cardRect, viewport, margin) {
  return candidate.left >= margin
    && candidate.top >= margin
    && candidate.left + cardRect.width <= viewport.width - margin
    && candidate.top + cardRect.height <= viewport.height - margin;
}

function createCandidate(placement, targetRect, cardRect, gap) {
  if (placement === 'top') {
    return {
      left: targetRect.left + (targetRect.width - cardRect.width) / 2,
      top: targetRect.top - cardRect.height - gap,
    };
  }
  if (placement === 'bottom') {
    return {
      left: targetRect.left + (targetRect.width - cardRect.width) / 2,
      top: targetRect.bottom + gap,
    };
  }
  if (placement === 'right') {
    return {
      left: targetRect.right + gap,
      top: targetRect.top + (targetRect.height - cardRect.height) / 2,
    };
  }
  return {
    left: targetRect.left - cardRect.width - gap,
    top: targetRect.top + (targetRect.height - cardRect.height) / 2,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function getUnionRect(rects = []) {
  const validRects = rects.filter((rect) => (
    rect
    && Number.isFinite(rect.left)
    && Number.isFinite(rect.right)
    && Number.isFinite(rect.top)
    && Number.isFinite(rect.bottom)
  ));
  if (validRects.length === 0) return null;

  const left = Math.min(...validRects.map((rect) => rect.left));
  const right = Math.max(...validRects.map((rect) => rect.right));
  const top = Math.min(...validRects.map((rect) => rect.top));
  const bottom = Math.max(...validRects.map((rect) => rect.bottom));
  return {
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  };
}

function getContextualTutorialPosition({
  cardRect,
  gap = DEFAULT_GAP,
  margin = DEFAULT_MARGIN,
  placements = ['top', 'bottom', 'right', 'left'],
  targetRect,
  viewport,
}) {
  if (!cardRect || !targetRect || !viewport) return null;

  for (const placement of placements) {
    const candidate = createCandidate(placement, targetRect, cardRect, gap);
    if (fits(candidate, cardRect, viewport, margin)) {
      return { ...candidate, placement };
    }
  }

  const fallbackPlacement = placements[0] ?? 'top';
  const fallback = createCandidate(fallbackPlacement, targetRect, cardRect, gap);
  return {
    left: clamp(fallback.left, margin, viewport.width - cardRect.width - margin),
    placement: fallbackPlacement,
    top: clamp(fallback.top, margin, viewport.height - cardRect.height - margin),
  };
}

export {
  DEFAULT_GAP,
  DEFAULT_MARGIN,
  getContextualTutorialPosition,
  getUnionRect,
};
