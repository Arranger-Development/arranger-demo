import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import viteConfig from '../vite.config.js';

const requiredFiles = [
  'src/data/bassNotes.js',
  'src/data/melodyScales.js',
  'src/data/drumsNotes.js',
  'public/samples/Chords/Chord_C4_v0.3.wav',
  'public/samples/Bass/Bass_C1_v0.22.wav',
  'public/samples/Melody/Melody_C4_v0.22.wav',
  'public/samples/Drums/Kick_v0.22.wav',
];

test('foundation assets and music data are present', () => {
  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `${file} should exist`);
  }
});

test('stale chord pitch library is removed from the runtime data set', () => {
  assert.equal(existsSync('src/data/chords.js'), false);
});

test('new v0.22 sample assets are playable wav files', () => {
  for (const file of requiredFiles.slice(3)) {
    const header = readFileSync(file).subarray(0, 12);
    assert.equal(header.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(header.subarray(8, 12).toString('ascii'), 'WAVE');
  }
});

test('runtime sample sources avoid old backup folders', () => {
  const source = readFileSync('src/audio/AudioEngine.js', 'utf8');

  assert.doesNotMatch(source, /samples\/(?:808|bass|chords|lead)-old\//);
});

test('local sample backups and generated metadata are ignored', () => {
  const gitignore = readFileSync('.gitignore', 'utf8');

  assert.match(gitignore, /\/public\/samples\/\*-old\//);
  assert.match(gitignore, /\/public\/samples\/\.DS_Store/);
  assert.match(gitignore, /\/public\/samples\/\*\/\.DS_Store/);
});

for (const outDir of ['dist', 'custom-output']) {
  test(`build removes metadata and sample backups only from ${outDir}`, (t) => {
    const root = mkdtempSync(join(tmpdir(), 'arranger-build-cleanup-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const discarded = ['.DS_Store', 'samples/.DS_Store', 'assets/art/.DS_Store', 'samples/chords-old/backup.wav'];
    const retained = ['index.html', 'assets/app.js', 'assets/art-old/image.png', 'samples/Chords/chord.wav'];
    const sourceFiles = ['public/.DS_Store', 'public/samples/chords-old/backup.wav'];
    for (const file of [...discarded, ...retained].map((file) => join(outDir, file)).concat(sourceFiles)) {
      const path = join(root, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, 'fixture');
    }
    const plugin = viteConfig.plugins.find(({ name }) => name === 'prune-public-sample-backups');
    plugin.configResolved({ root, build: { outDir } });
    plugin.closeBundle();
    for (const file of discarded) assert.equal(existsSync(join(root, outDir, file)), false, file);
    for (const file of retained) assert.equal(existsSync(join(root, outDir, file)), true, file);
    for (const file of sourceFiles) assert.equal(existsSync(join(root, file)), true, file);
  });
}
