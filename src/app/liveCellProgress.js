export function livePhraseProgress(progress, id, bars) {
  if (!progress || progress.id !== id) return 0;
  if (Number.isFinite(bars) && bars > 0) {
    if (!Number.isFinite(progress.localStep)) return 0;
    const steps = bars * 16;
    return (Math.max(0, progress.localStep) % steps) / steps;
  }
  return Number.isFinite(progress.fraction) ? Math.max(0, Math.min(1, progress.fraction)) : 0;
}

// Start at twelve o'clock; traverse the actual rounded rectangle clockwise.
export function liveProgressPath(width, height) {
  const inset = 3;
  if (width <= inset * 2 || height <= inset * 2) return '';
  const left = inset, top = inset, right = width - inset, bottom = height - inset;
  const radius = Math.min(4, (right - left) / 2, (bottom - top) / 2);
  return `M ${width / 2} ${top} H ${right - radius} A ${radius} ${radius} 0 0 1 ${right} ${top + radius}`
    + ` V ${bottom - radius} A ${radius} ${radius} 0 0 1 ${right - radius} ${bottom}`
    + ` H ${left + radius} A ${radius} ${radius} 0 0 1 ${left} ${bottom - radius}`
    + ` V ${top + radius} A ${radius} ${radius} 0 0 1 ${left + radius} ${top} H ${width / 2} Z`;
}
