import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createThemeStore, THEME_STORAGE_KEY } from '../src/app/themeStore.js';

function browserPreference(saved) {
  const values = new Map(saved === undefined ? [] : [[THEME_STORAGE_KEY, saved]]);
  const attributes = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const root = { setAttribute: (key, value) => attributes.set(key, value) };
  return { storage, root, values, attributes };
}

test('first load and invalid persisted themes fall back to hardware', () => {
  for (const saved of [undefined, '', 'aurora', '{broken}']) {
    const env = browserPreference(saved);
    const store = createThemeStore(env);
    assert.equal(store.getTheme(), 'hardware');
    assert.equal(env.attributes.get('data-theme'), 'hardware');
  }
});

test('saved Swiss is applied at initialization and restored after switching', () => {
  const env = browserPreference('swiss');
  const store = createThemeStore(env);
  assert.equal(env.attributes.get('data-theme'), 'swiss');
  store.setTheme('hardware');
  assert.equal(env.values.get(THEME_STORAGE_KEY), 'hardware');
  store.setTheme('swiss');
  assert.equal(createThemeStore(env).getTheme(), 'swiss');
});

test('multiple controls see the same theme; unchanged selections and unsubscribed controls do not notify', () => {
  const env = browserPreference();
  const store = createThemeStore(env);
  const first = [], second = [];
  store.subscribe(() => first.push([store.getTheme(), env.attributes.get('data-theme')]));
  const unsubscribe = store.subscribe(() => second.push(store.getTheme()));
  store.setTheme('swiss');
  store.setTheme('swiss');
  unsubscribe();
  store.setTheme('hardware');
  assert.deepEqual(first, [['swiss', 'swiss'], ['hardware', 'hardware']]);
  assert.deepEqual(second, ['swiss']);
});

test('blocked reads and writes keep switching functional for the session', () => {
  const env = browserPreference();
  const blocked = () => { throw new Error('Storage denied'); };
  const store = createThemeStore({ root: env.root, storage: { getItem: blocked, setItem: blocked } });
  assert.equal(store.getTheme(), 'hardware');
  store.setTheme('swiss');
  assert.equal(store.getTheme(), 'swiss');
  assert.equal(env.attributes.get('data-theme'), 'swiss');
  store.setTheme('hardware');
  assert.equal(store.getTheme(), 'hardware');
});

test('preference writes never change other browser keys', () => {
  const env = browserPreference();
  env.values.set('arranger.jam.projects', 'existing music');
  createThemeStore(env).setTheme('swiss');
  assert.deepEqual([...env.values], [['arranger.jam.projects', 'existing music'], [THEME_STORAGE_KEY, 'swiss']]);
});
