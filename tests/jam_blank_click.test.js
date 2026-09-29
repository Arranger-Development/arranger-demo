import test from 'node:test';
import assert from 'node:assert/strict';
import { bindJamBlankClick, returnToNewCombination } from '../src/app/jamBlankClick.js';
import { createSession, createSessionEditor, NEW_COMBINATION_ID } from '../src/app/performanceSession.js';
import { performanceTemplates } from '../src/app/performanceModel.js';

function fixture() {
  const win = new EventTarget();
  const root = new EventTarget();
  const state = { enabled: true, menuOpen: false, clicks: 0 };
  root.ownerDocument = { defaultView: win };
  root.contains = target => target?.inside !== false;
  root.querySelector = () => state.menuOpen ? {} : null;
  const node = className => ({ matches: selectors => selectors.split(',').includes(`.${className}`) });
  const blank = node('jam-workbench'), control = node('jam-effects');
  const cleanup = bindJamBlankClick(root, { isEnabled: () => state.enabled, onClick: () => state.clicks++ });
  function emit(type, props = {}) {
    const event = new Event(type);
    for (const [key, value] of Object.entries({ target: blank, button: 0, pointerId: 1, isPrimary: true, clientX: 40, clientY: 40, detail: 1, ...props })) {
      Object.defineProperty(event, key, { value });
    }
    (['pointerdown', 'click'].includes(type) ? root : win).dispatchEvent(event);
  }
  const click = () => { emit('pointerdown'); emit('pointerup'); emit('click'); };
  return { state, blank, control, node, emit, click, cleanup, win };
}

test('ordinary stopped background clicks work on template gaps, workbench and loop remainder', () => {
  const f = fixture();
  for (const className of ['jam-workspace', 'jam-pad-group', 'jam-row', 'jam-workbench', 'jam-loops']) {
    const target = f.node(className);
    for (const type of ['pointerdown', 'pointerup', 'click']) f.emit(type, { target });
  }
  assert.equal(f.state.clicks, 5);
  f.cleanup(); f.click(); assert.equal(f.state.clicks, 5);
});

test('controls, menu dismissal, non-primary input and synthetic clicks do not dismiss', () => {
  const f = fixture();
  for (const className of ['performance-pad', 'jam-pad-slot', 'performance-loop', 'jam-saved-loop', 'jam-effects', 'jam-loop-menu', 'jam-export-dialog', 'performance-save', 'jam-timbre-select']) {
    f.emit('pointerdown', { target: f.node(className) }); f.emit('pointerup'); f.emit('click');
  }
  f.emit('pointerdown'); f.emit('pointerup', { target: f.control }); f.emit('click');
  f.state.menuOpen = true; f.emit('pointerdown'); f.state.menuOpen = false; f.emit('pointerup'); f.emit('click');
  f.emit('pointerdown', { button: 2 }); f.emit('pointerup'); f.emit('click');
  f.emit('pointerdown', { isPrimary: false }); f.emit('pointerup'); f.emit('click');
  f.emit('click', { detail: 0 });
  assert.equal(f.state.clicks, 0); f.cleanup();
});

test('movement, scrolling, cancellation, losing focus and pointer capture suppress dismissal', () => {
  const f = fixture();
  for (const type of ['wheel', 'scroll', 'pointercancel', 'lostpointercapture', 'blur']) {
    f.emit('pointerdown'); f.emit(type, type === 'blur' ? { target: f.win } : {}); f.emit('pointerup'); f.emit('click');
  }
  f.emit('pointerdown'); f.emit('pointermove', { clientX: 48 }); f.emit('pointermove'); f.emit('pointerup'); f.emit('click');
  f.emit('pointerdown'); f.emit('pointerup', { clientX: 48 }); f.emit('click');
  f.emit('pointerdown'); f.emit('pointerup', { pointerId: 2 }); f.emit('click');
  assert.equal(f.state.clicks, 0); f.click(); assert.equal(f.state.clicks, 1); f.cleanup();
});

test('playback/loading eligibility is checked at press, release and click, without stale dismissals', () => {
  const f = fixture();
  f.state.enabled = false; f.emit('pointerdown'); f.state.enabled = true; f.emit('pointerup'); f.emit('click');
  f.emit('pointerdown'); f.state.enabled = false; f.emit('pointerup'); f.state.enabled = true; f.emit('click');
  f.emit('pointerdown'); f.emit('pointerup'); f.state.enabled = false; f.emit('click');
  assert.equal(f.state.clicks, 0);
  f.state.enabled = true; f.click(); assert.equal(f.state.clicks, 1); f.cleanup();
});

test('normal touch capture release after pointerup still permits a blank click', () => {
  const f = fixture();
  f.emit('pointerdown'); f.emit('pointerup'); f.emit('lostpointercapture'); f.emit('click');
  assert.equal(f.state.clicks, 1); f.cleanup();
});

test('returning from seventh Loop restores new draft and preserves unsaved Loop changes; next save adds a Loop', () => {
  const catalog = performanceTemplates('chill', 'ai-demo-1');
  const editor = createSessionEditor(createSession('chill', 'ai-demo-1'), { catalog });
  const main = catalog.drums.find(p => p.kind !== 'transition').id;
  const fill = catalog.drums.find(p => p.kind === 'transition').id;
  const chord = catalog.chord[0].id;
  const edit = selection => editor.edit({ selection: { drums: null, chord: null, bass: null, melody: null, ...selection } });
  for (let i = 0; i < 7; i++) { edit({ drums: main }); editor.save(); }
  const seventh = editor.getSnapshot().session.sections[6];
  edit({ chord });
  const newDraft = structuredClone(editor.getSnapshot().drafts[NEW_COMBINATION_ID]);
  editor.select(seventh.id); edit({ drums: fill });
  const loopDraft = structuredClone(editor.getSnapshot().drafts[seventh.id]);
  let active = true;
  const playback = { isActive: () => active };
  const before = editor.getSnapshot();
  returnToNewCombination(editor, playback); assert.equal(editor.getSnapshot(), before);
  active = false;
  returnToNewCombination(editor, playback);
  assert.equal(editor.getSnapshot().editingId, NEW_COMBINATION_ID);
  assert.deepEqual(editor.getSnapshot().drafts[NEW_COMBINATION_ID], newDraft);
  assert.deepEqual(editor.getSnapshot().drafts[seventh.id], loopDraft);
  assert.deepEqual(editor.getSnapshot().session, before.session);
  const restored = editor.getSnapshot();
  returnToNewCombination(editor, playback); assert.equal(editor.getSnapshot(), restored);
  editor.save();
  assert.equal(editor.getSnapshot().session.sections.length, 8);
  assert.deepEqual(editor.getSnapshot().session.sections[6], seventh);
  assert.equal(editor.getSnapshot().session.sections[7].selection.chord, chord);
  editor.select(seventh.id); assert.deepEqual(editor.getSnapshot().drafts[seventh.id], loopDraft);
});

test('a focused stop button blurring during blank pointerdown does not cancel the click', () => {
  const f = fixture();
  f.emit('pointerdown'); f.emit('blur', { target: f.control }); f.emit('pointerup'); f.emit('click');
  assert.equal(f.state.clicks, 1); f.cleanup();
});
