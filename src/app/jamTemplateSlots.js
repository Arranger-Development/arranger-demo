export const JAM_PAGE_SIZE = 8;

// Persisted templates remain a dense library; slotIndex owns the performance layout.
export function normalizeJamSlots(templates) {
  const used = new Set();
  return templates.map((template, index) => {
    let slot = template.slotIndex;
    if (!Number.isSafeInteger(slot) || slot < 0 || used.has(slot)) {
      slot = index;
      while (used.has(slot) || templates.some(p => p !== template && p.slotIndex === slot)) slot++;
    }
    used.add(slot);
    return { ...template, slotIndex: slot };
  });
}

export function jamTemplatePage(templates, page = 0) {
  return jamTemplateRange(templates, page * JAM_PAGE_SIZE, JAM_PAGE_SIZE);
}

export function jamTemplateRange(templates, start, count) {
  const slots = new Map(normalizeJamSlots(templates).map(p => [p.slotIndex, p]));
  return Array.from({ length: count }, (_, i) => slots.get(start + i) ?? null);
}

export function jamSavedPageCount(templates) {
  return Math.max(1, ...Object.values(templates).flatMap(row => normalizeJamSlots(row).map(p => Math.floor(p.slotIndex / JAM_PAGE_SIZE) + 1)));
}

export function jamLauncherColumnCount(templates) {
  return Math.max(16, (jamSavedPageCount(templates) + 1) * JAM_PAGE_SIZE);
}

export function firstEmptyJamSlot(templates) {
  const used = new Set(normalizeJamSlots(templates).map(p => p.slotIndex));
  let slot = 0;
  while (used.has(slot)) slot++;
  return slot;
}

// Upgrade legacy layouts once, preserving visual order and dense library order.
export function compactJamSlots(templates) {
  const row = normalizeJamSlots(templates);
  const positions = new Map([...row].sort((a, b) => a.slotIndex - b.slotIndex)
    .map((p, index) => [p.id, index]));
  return row.map(p => ({ ...p, slotIndex: positions.get(p.id) }));
}

// Deleting a phrase never moves another saved phrase or an intentional hole.
export function removeJamSlot(templates, id) {
  const row = normalizeJamSlots(templates);
  const removed = row.find(template => template.id === id);
  if (!removed) return null;
  return row.filter(p => p.id !== id);
}

// A permutation of slots, including holes. The destination is the final index.
export function jamSlotAfterMove(slot, from, to) {
  if (slot === from) return to;
  if (from < to && slot > from && slot <= to) return slot - 1;
  if (from > to && slot >= to && slot < from) return slot + 1;
  return slot;
}

export function moveJamSlots(templates, from, to) {
  return normalizeJamSlots(templates).map(p => ({ ...p, slotIndex: jamSlotAfterMove(p.slotIndex, from, to) }));
}

export function relocateJamDraft(draft, move, templates) {
  if (!draft || move.trackId && draft.trackId !== move.trackId) return draft;
  const saved = templates[draft.trackId]?.find(p => p.id === draft.editingTemplateId);
  const next = { ...draft };
  for (const key of ['slotIndex', 'targetSlot']) if (Number.isSafeInteger(next[key]) && next[key] >= 0) {
    next[key] = jamSlotAfterMove(next[key], move.from, move.to);
  }
  if (saved) next.slotIndex = saved.slotIndex;
  return next;
}

export function relocateJamHistory(history, move, templates) {
  return { ...history, undo: history.undo.map(d => relocateJamDraft(d, move, templates)),
    redo: history.redo.map(d => relocateJamDraft(d, move, templates)) };
}
