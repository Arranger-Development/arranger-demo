import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { formatDisplayPosition } from '../src/app/transportPosition.js';

test('formatDisplayPosition exposes one-based bar beat and sixteenth positions', () => {
  assert.equal(formatDisplayPosition(0, 0), '1.1.1');
  assert.equal(formatDisplayPosition(0, 3), '1.1.4');
  assert.equal(formatDisplayPosition(0, 4), '1.2.1');
  assert.equal(formatDisplayPosition(4, 0), '5.1.1');
  assert.equal(formatDisplayPosition(4, 15), '5.4.4');
  assert.equal(formatDisplayPosition(7, 15), '8.4.4');
});

test('formatDisplayPosition rejects positions outside the arrangement', () => {
  assert.equal(formatDisplayPosition(-1, 0), '');
  assert.equal(formatDisplayPosition(8, 0), '');
  assert.equal(formatDisplayPosition(0, -1), '');
  assert.equal(formatDisplayPosition(0, 16), '');
  assert.equal(formatDisplayPosition(0.5, 0), '');
});

test('top bar and Drum Sequencer share the display position formatter', async () => {
  const [topBarSource, drumSequencerSource] = await Promise.all([
    readFile(new URL('../src/app/components/TopBar.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/components/DrumSequencer.jsx', import.meta.url), 'utf8'),
  ]);

  assert.match(topBarSource, /formatDisplayPosition\(currentBar, currentStep, MAX_PROJECT_BARS\)/);
  assert.match(
    drumSequencerSource,
    /stepGroup\.map\(\(stepNumber, beatStepIndex\) => \([\s\S]*\{beatStepIndex \+ 1\}/,
  );
  assert.match(
    drumSequencerSource,
    /const positionLabel = formatDisplayPosition\(selectedBar, stepIndex, MAX_PROJECT_BARS\)/,
  );
  assert.match(
    drumSequencerSource,
    /aria-label=\{`Toggle \$\{row\.label\} at \$\{positionLabel\}`\}/,
  );
});
