export function insertLiveColumn(columns, id, targetId, side = 'before') {
  if (id === targetId) return columns;
  const source = columns.find(c => c.id === id);
  const target = columns.find(c => c.id === targetId);
  if (!source || !target) return columns;
  const next = columns.filter(c => c.id !== id);
  next.splice(next.findIndex(c => c.id === targetId) + (side === 'after' ? 1 : 0), 0, source);
  return next;
}

export function liveKeyboardCommand(event) {
  if (event.repeat || event.defaultPrevented || event.target?.isContentEditable
    || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')) return null;
  const key = event.key?.toLowerCase();
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  // Effect buttons consume their own Space event before it reaches this handler.
  if (key === ' ') return 'play';
  if (key === 'escape') return 'stop';
  return null;
}
