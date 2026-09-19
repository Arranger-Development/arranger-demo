export function insertLiveColumn(columns, id, targetId, side = 'before') {
  if (id === targetId) return columns;
  const source = columns.find(c => c.id === id);
  const target = columns.find(c => c.id === targetId);
  if (!source || !target) return columns;
  const next = columns.filter(c => c.id !== id);
  next.splice(next.findIndex(c => c.id === targetId) + (side === 'after' ? 1 : 0), 0, source);
  return next;
}

