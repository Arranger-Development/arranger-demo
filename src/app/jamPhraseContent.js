export const hasJamPhraseNotes = phrase => Boolean(phrase?.bars?.some(bar => Array.isArray(bar) && bar.some(Boolean)));

// Older input adapters also accept catalog entries without an expanded matrix.
export const isEmptyJamPhrase = phrase => Array.isArray(phrase?.bars) && phrase.bars.every(Array.isArray) && !hasJamPhraseNotes(phrase);
