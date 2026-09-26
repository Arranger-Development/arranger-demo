import test from 'node:test';
import assert from 'node:assert/strict';
import { performanceTemplates } from '../src/app/performanceModel.js';
import { availablePadTemplates, createSession, readSession, replacePadBinding, sessionKey } from '../src/app/performanceSession.js';

const genre = 'chill', profile = 'ai-demo-1';
const catalog = performanceTemplates(genre, profile);

test('pad choices exclude every used ID in the same track and preserve category and catalog order', () => {
  const session = createSession(genre, profile);
  for (const track of Object.keys(catalog)) {
    for (const index of [0, 6]) {
      const kind = index < 6 ? 'main' : 'transition';
      const choices = availablePadTemplates(catalog, session.pads, track, index);
      assert.deepEqual(choices, catalog[track].filter(p => (p.kind ?? 'main') === kind && !session.pads[track].includes(p.id)));
    }
  }
  assert.deepEqual(availablePadTemplates(catalog, session.pads, 'chord', 7), []);
  assert.equal(replacePadBinding(session, catalog, 'drums', 0, session.pads.drums[1]), session);
  assert.equal(replacePadBinding(session, catalog, 'drums', 0, session.pads.drums[0]), session);
  assert.equal(replacePadBinding(session, catalog, 'drums', 0, session.pads.drums[6]), session);
});

test('replacement releases old template, reserves new one, leaves other tracks and saved music untouched', () => {
  const session = createSession(genre, profile);
  const original = structuredClone(session);
  const oldId = session.pads.drums[0];
  const nextId = availablePadTemplates(catalog, session.pads, 'drums', 0)[0].id;
  const chordChoices = availablePadTemplates(catalog, session.pads, 'chord', 0);
  const next = replacePadBinding(session, catalog, 'drums', 0, nextId);
  const choices = availablePadTemplates(catalog, next.pads, 'drums', 1).map(p => p.id);
  assert.ok(choices.includes(oldId)); assert.ok(!choices.includes(nextId));
  assert.deepEqual(availablePadTemplates(catalog, next.pads, 'chord', 0), chordChoices);
  assert.equal(next.sections, session.sections); assert.equal(next.columns, session.columns);
  assert.deepEqual(session, original);
  const restored = readSession({ getItem: key => key === sessionKey(genre, profile) ? JSON.stringify(next) : null }, genre, profile);
  assert.deepEqual(restored.pads, next.pads);
  assert.deepEqual(availablePadTemplates(catalog, restored.pads, 'drums', 1).map(p => p.id), choices);
});

test('legacy duplicate bindings survive loading and disappear only as the user replaces them', () => {
  const session = createSession(genre, profile);
  const duplicate = session.pads.drums[0]; session.pads.drums[1] = duplicate;
  const restored = readSession({ getItem: key => key === sessionKey(genre, profile) ? JSON.stringify(session) : null }, genre, profile);
  assert.deepEqual(restored.pads, session.pads);
  const first = availablePadTemplates(catalog, restored.pads, 'drums', 0)[0].id;
  const next = replacePadBinding(restored, catalog, 'drums', 0, first);
  assert.equal(next.pads.drums[1], duplicate);
  assert.ok(!availablePadTemplates(catalog, next.pads, 'drums', 1).some(p => p.id === duplicate));
  const second = availablePadTemplates(catalog, next.pads, 'drums', 1)[0].id;
  const final = replacePadBinding(next, catalog, 'drums', 1, second);
  assert.ok(availablePadTemplates(catalog, final.pads, 'drums', 0).some(p => p.id === duplicate));
});
