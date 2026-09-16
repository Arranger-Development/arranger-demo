import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACK_IDS } from '../src/domain/musicConstants.js';
import useMusicStore from '../src/store/useMusicStore.js';

beforeEach(() => {
  useMusicStore.setState(useMusicStore.getInitialState(), true);
});

test('clips slice starts with drums only and does not preseed chord clips', () => {
  const state = useMusicStore.getState();

  assert.deepEqual(state.clips.ids, ['drums-bar-0']);
  assert.deepEqual(state.clips.byId['drums-bar-0'], {
    id: 'drums-bar-0',
    trackId: 'drums',
    bar: 0,
    name: 'Drum 01',
  });
  assert.equal(state.getClipForTrackBar('chord', 0), null);
});

test('getClipForTrackBar returns a clip for one track and bar only', () => {
  const state = useMusicStore.getState();

  assert.equal(state.getClipForTrackBar('drums', 0).id, 'drums-bar-0');
  assert.equal(state.getClipForTrackBar('drums', 1), null);
  assert.equal(state.getClipForTrackBar('bass', 0), null);
});

test('createClip adds a new track clip and selects it', () => {
  const state = useMusicStore.getState();

  const clip = state.createClip('bass', 2);

  assert.deepEqual(clip, {
    id: 'bass-bar-2',
    trackId: 'bass',
    bar: 2,
    name: 'Bass 03',
  });
  assert.equal(useMusicStore.getState().clips.ids.includes('bass-bar-2'), true);
  assert.equal(useMusicStore.getState().selectedClipId, 'bass-bar-2');
  assert.equal(useMusicStore.getState().activeTrackId, 'bass');
  assert.equal(useMusicStore.getState().selectedBar, 2);
});

test('createClip names clips from bar 1 through bar 8', () => {
  const state = useMusicStore.getState();

  assert.equal(state.createClip('melody', 0).name, 'Melody 01');
  assert.equal(useMusicStore.getState().createClip('melody', 7).name, 'Melody 08');
});

test('createClip re-selects an existing clip without duplicating it', () => {
  const state = useMusicStore.getState();

  const first = state.createClip('drums', 0);
  const second = useMusicStore.getState().createClip('drums', 0);

  assert.equal(first.id, 'drums-bar-0');
  assert.equal(second.id, 'drums-bar-0');
  assert.deepEqual(useMusicStore.getState().clips.ids, ['drums-bar-0']);
  assert.equal(useMusicStore.getState().selectedClipId, 'drums-bar-0');
});

test('renameClip updates clip names across tracks and preserves custom names on move', () => {
  const state = useMusicStore.getState();
  state.createClip('bass', 2);

  const renamedClip = useMusicStore.getState().renameClip('bass-bar-2', 'Warm Bass');

  assert.equal(renamedClip.name, 'Warm Bass');
  assert.equal(renamedClip.customName, true);
  assert.equal(useMusicStore.getState().getClipForTrackBar('bass', 2).name, 'Warm Bass');

  const movedClip = useMusicStore.getState().moveClipToBar('bass-bar-2', 4);

  assert.equal(movedClip.id, 'bass-bar-4');
  assert.equal(movedClip.name, 'Warm Bass');
  assert.equal(movedClip.customName, true);
  assert.equal(useMusicStore.getState().getClipForTrackBar('bass', 4).name, 'Warm Bass');
});

test('renameClip ignores missing clips and non-string names', () => {
  const beforeClips = structuredClone(useMusicStore.getState().clips);

  assert.equal(useMusicStore.getState().renameClip('missing-clip', 'Nope'), null);
  assert.equal(useMusicStore.getState().renameClip('drums-bar-0', 123), null);
  assert.deepEqual(useMusicStore.getState().clips, beforeClips);
});

test('moveClipToBar moves a clip and its matrix bar data to an empty bar', () => {
  const state = useMusicStore.getState();
  state.setCell('bass', 2, 0, { note: 'C3' });
  state.setCell('bass', 2, 5, { note: 'G3' });
  state.createClip('bass', 2);

  const movedClip = useMusicStore.getState().moveClipToBar('bass-bar-2', 4);

  assert.deepEqual(movedClip, {
    id: 'bass-bar-4',
    trackId: 'bass',
    bar: 4,
    name: 'Bass 05',
  });
  assert.equal(useMusicStore.getState().getClipForTrackBar('bass', 2), null);
  assert.equal(useMusicStore.getState().getClipForTrackBar('bass', 4).id, 'bass-bar-4');
  assert.equal(useMusicStore.getState().selectedClipId, 'bass-bar-4');
  assert.equal(useMusicStore.getState().activeTrackId, 'bass');
  assert.equal(useMusicStore.getState().selectedBar, 4);
  assert.deepEqual(useMusicStore.getState().matrix.bass[4][0], { note: 'C3' });
  assert.deepEqual(useMusicStore.getState().matrix.bass[4][5], { note: 'G3' });
  assert.equal(useMusicStore.getState().matrix.bass[2].every((cell) => cell === null), true);
});

test('moveClipToBar swaps same-track clips and their matrix bar data', () => {
  const state = useMusicStore.getState();
  state.setCell('drums', 0, 0, { instruments: ['kick'] });
  state.setCell('drums', 2, 4, { instruments: ['snare'] });
  state.createClip('drums', 2);

  const movedClip = useMusicStore.getState().moveClipToBar('drums-bar-0', 2);

  assert.equal(movedClip.id, 'drums-bar-2');
  assert.equal(movedClip.name, 'Drum 03');
  assert.deepEqual(useMusicStore.getState().clips.ids, ['drums-bar-0', 'drums-bar-2']);
  assert.equal(useMusicStore.getState().getClipForTrackBar('drums', 0).id, 'drums-bar-0');
  assert.equal(useMusicStore.getState().getClipForTrackBar('drums', 0).name, 'Drum 01');
  assert.equal(useMusicStore.getState().getClipForTrackBar('drums', 2).id, 'drums-bar-2');
  assert.deepEqual(useMusicStore.getState().matrix.drums[2][0], { instruments: ['kick'] });
  assert.deepEqual(useMusicStore.getState().matrix.drums[0][4], { instruments: ['snare'] });
  assert.equal(useMusicStore.getState().selectedClipId, 'drums-bar-2');
  assert.equal(useMusicStore.getState().selectedBar, 2);
});

test('moveClipToBar ignores invalid clips and bars without changing state', () => {
  const beforeClips = structuredClone(useMusicStore.getState().clips);
  const beforeMatrix = structuredClone(useMusicStore.getState().matrix);

  assert.equal(useMusicStore.getState().moveClipToBar('missing-clip', 1), null);
  assert.equal(useMusicStore.getState().moveClipToBar('drums-bar-0', -1), null);
  assert.equal(useMusicStore.getState().moveClipToBar('drums-bar-0', 8), null);
  assert.equal(useMusicStore.getState().moveClipToBar('drums-bar-0', 1.5), null);
  assert.deepEqual(useMusicStore.getState().clips, beforeClips);
  assert.deepEqual(useMusicStore.getState().matrix, beforeMatrix);
});

test('createClipClipboardSnapshot captures clip metadata and deep cloned bar data', () => {
  const state = useMusicStore.getState();
  state.setCell('chord', 2, 0, { root: 'G', span: 1 });
  state.setCell('chord', 2, 4, { root: 'Cmaj7', span: 2 });
  state.createClip('chord', 2);
  state.renameClip('chord-bar-2', 'Bright Chords');

  const snapshot = useMusicStore.getState().createClipClipboardSnapshot('chord-bar-2');

  assert.equal(snapshot.sourceClipId, 'chord-bar-2');
  assert.equal(snapshot.trackId, 'chord');
  assert.equal(snapshot.sourceBar, 2);
  assert.equal(snapshot.name, 'Bright Chords');
  assert.equal(snapshot.customName, true);
  assert.deepEqual(snapshot.barData[0], { root: 'G', span: 1 });
  assert.deepEqual(snapshot.barData[4], { root: 'Cmaj7', span: 2 });

  useMusicStore.getState().setCell('chord', 2, 0, { root: 'F', span: 1 });
  snapshot.barData[4].root = 'Am';

  assert.deepEqual(snapshot.barData[0], { root: 'G', span: 1 });
  assert.deepEqual(useMusicStore.getState().matrix.chord[2][4], { root: 'Cmaj7', span: 2 });
});

test('pasteClipClipboardSnapshot creates an empty target clip with copied content and default target name', () => {
  const state = useMusicStore.getState();
  state.setCell('bass', 1, 0, { note: 'C2' });
  state.setCell('bass', 1, 8, { note: 'G2' });
  state.createClip('bass', 1);
  const snapshot = useMusicStore.getState().createClipClipboardSnapshot('bass-bar-1');

  const pastedClip = useMusicStore.getState().pasteClipClipboardSnapshot(snapshot, 'bass', 4);

  assert.deepEqual(pastedClip, {
    id: 'bass-bar-4',
    trackId: 'bass',
    bar: 4,
    name: 'Bass 05',
  });
  assert.equal(useMusicStore.getState().getClipForTrackBar('bass', 4).id, 'bass-bar-4');
  assert.deepEqual(useMusicStore.getState().matrix.bass[4][0], { note: 'C2' });
  assert.deepEqual(useMusicStore.getState().matrix.bass[4][8], { note: 'G2' });
  assert.deepEqual(useMusicStore.getState().matrix.bass[1][0], { note: 'C2' });
  assert.equal(useMusicStore.getState().selectedClipId, 'bass-bar-4');
  assert.equal(useMusicStore.getState().activeTrackId, 'bass');
  assert.equal(useMusicStore.getState().selectedBar, 4);
});

test('pasteClipClipboardSnapshot preserves names and strips legacy per-clip Melody templates', () => {
  const state = useMusicStore.getState();
  state.setCell('melody', 0, 0, { type: 'melody', note: 'C4' });
  state.createClip('melody', 0);
  state.renameClip('melody-bar-0', 'Hook Lead');
  useMusicStore.setState((current) => ({
    clips: {
      ids: current.clips.ids,
      byId: {
        ...current.clips.byId,
        'melody-bar-0': {
          ...current.clips.byId['melody-bar-0'],
          melodyRhythmTemplateId: 'syncopation',
        },
      },
    },
  }));
  const snapshot = useMusicStore.getState().createClipClipboardSnapshot('melody-bar-0');
  useMusicStore.getState().createClip('melody', 3);
  useMusicStore.getState().setCell('melody', 3, 0, { type: 'melody', note: 'G4' });

  const pastedClip = useMusicStore.getState().pasteClipClipboardSnapshot(snapshot, 'melody', 3);

  assert.deepEqual(pastedClip, {
    id: 'melody-bar-3',
    trackId: 'melody',
    bar: 3,
    name: 'Hook Lead',
    customName: true,
  });
  assert.deepEqual(useMusicStore.getState().clips.ids.filter((id) => id === 'melody-bar-3'), ['melody-bar-3']);
  assert.deepEqual(useMusicStore.getState().matrix.melody[3][0], { type: 'melody', note: 'C4' });
  assert.deepEqual(useMusicStore.getState().matrix.melody[0][0], { type: 'melody', note: 'C4' });
});

test('pasteClipClipboardSnapshot rejects cross-track and invalid paste targets without changing state', () => {
  const state = useMusicStore.getState();
  state.setCell('drums', 0, 0, { instruments: ['kick'] });
  const snapshot = state.createClipClipboardSnapshot('drums-bar-0');
  const beforeClips = structuredClone(useMusicStore.getState().clips);
  const beforeMatrix = structuredClone(useMusicStore.getState().matrix);

  assert.equal(useMusicStore.getState().pasteClipClipboardSnapshot(snapshot, 'bass', 0), null);
  assert.equal(useMusicStore.getState().pasteClipClipboardSnapshot(snapshot, 'drums', -1), null);
  assert.equal(useMusicStore.getState().pasteClipClipboardSnapshot(snapshot, 'drums', 8), null);
  assert.equal(useMusicStore.getState().pasteClipClipboardSnapshot(null, 'drums', 1), null);
  assert.deepEqual(useMusicStore.getState().clips, beforeClips);
  assert.deepEqual(useMusicStore.getState().matrix, beforeMatrix);
});

test('timeline clipboard copies multiple tracks and preserves relative bar offsets on paste', () => {
  const state = useMusicStore.getState();
  state.setCell('drums', 1, 0, { instruments: ['kick'] });
  state.createClip('drums', 1);
  state.setCell('chord', 3, 4, { type: 'chord', chord: 'Am' });
  state.createClip('chord', 3);
  state.renameClip('chord-bar-3', 'Turnaround');

  const snapshot = useMusicStore.getState().createTimelineClipboardSnapshot({
    startBar: 1,
    endBar: 3,
    trackIds: ['drums', 'chord'],
  });

  assert.equal(snapshot.kind, 'timeline-range');
  assert.deepEqual(snapshot.trackIds, ['drums', 'chord']);
  assert.deepEqual(
    snapshot.items.map((item) => [item.trackId, item.barOffset]),
    [['drums', 0], ['chord', 2]],
  );

  const pasted = useMusicStore.getState().pasteTimelineClipboardSnapshot(snapshot, 4);
  const nextState = useMusicStore.getState();

  assert.deepEqual(pasted, {
    clips: [
      {
        id: 'drums-bar-4',
        trackId: 'drums',
        bar: 4,
        name: 'Drum 05',
      },
      {
        id: 'chord-bar-6',
        trackId: 'chord',
        bar: 6,
        name: 'Turnaround',
        customName: true,
      },
    ],
    startBar: 4,
    endBar: 6,
    trackIds: ['drums', 'chord'],
  });
  assert.deepEqual(nextState.matrix.drums[4][0], { instruments: ['kick'] });
  assert.deepEqual(nextState.matrix.chord[6][4], { type: 'chord', chord: 'Am' });
  assert.equal(nextState.selectedClipId, null);
  assert.equal(nextState.selectedBar, 4);
});

test('timeline clipboard rejects a paste range that would overflow bar 8', () => {
  const state = useMusicStore.getState();
  const snapshot = state.createTimelineClipboardSnapshot({
    startBar: 0,
    endBar: 2,
    trackIds: ['drums'],
  });
  const beforeClips = structuredClone(state.clips);
  const beforeMatrix = structuredClone(state.matrix);

  assert.equal(state.pasteTimelineClipboardSnapshot(snapshot, 6), null);
  assert.deepEqual(useMusicStore.getState().clips, beforeClips);
  assert.deepEqual(useMusicStore.getState().matrix, beforeMatrix);
});

test('deleteClipsByIds removes a multi-track selection atomically and preserves other clips', () => {
  const state = useMusicStore.getState();
  state.setCell('drums', 0, 0, { instruments: ['kick'] });
  state.createClip('chord', 1);
  state.setCell('chord', 1, 0, { type: 'chord', chord: 'C' });
  state.createClip('bass', 2);
  state.setCell('bass', 2, 0, { note: 'C2' });

  const deleted = useMusicStore.getState().deleteClipsByIds([
    'drums-bar-0',
    'chord-bar-1',
    'missing-clip',
  ]);
  const nextState = useMusicStore.getState();

  assert.deepEqual(deleted.map((clip) => clip.id), ['drums-bar-0', 'chord-bar-1']);
  assert.equal(nextState.getClipForTrackBar('drums', 0), null);
  assert.equal(nextState.getClipForTrackBar('chord', 1), null);
  assert.equal(nextState.getClipForTrackBar('bass', 2).id, 'bass-bar-2');
  assert.equal(nextState.matrix.drums[0].every((cell) => cell === null), true);
  assert.equal(nextState.matrix.chord[1].every((cell) => cell === null), true);
  assert.deepEqual(nextState.matrix.bass[2][0], { note: 'C2' });
});

test('selectClip links selectedClipId, activeTrackId, and selectedBar', () => {
  const state = useMusicStore.getState();
  state.createClip('chord', 0);

  state.selectClip('chord-bar-0');

  assert.equal(useMusicStore.getState().selectedClipId, 'chord-bar-0');
  assert.equal(useMusicStore.getState().activeTrackId, 'chord');
  assert.equal(useMusicStore.getState().selectedBar, 0);
});

test('deleteSelectedClip removes selected clip and clears its matrix bar', () => {
  const state = useMusicStore.getState();
  state.setCell('drums', 0, 0, { instruments: ['kick'] });
  state.setCell('drums', 0, 4, { instruments: ['snare'] });
  state.selectClip('drums-bar-0');

  const deletedClip = useMusicStore.getState().deleteSelectedClip();

  assert.equal(deletedClip.id, 'drums-bar-0');
  assert.equal(useMusicStore.getState().getClipForTrackBar('drums', 0), null);
  assert.deepEqual(useMusicStore.getState().clips.ids, []);
  assert.equal(useMusicStore.getState().matrix.drums[0].every((cell) => cell === null), true);
  assert.equal(useMusicStore.getState().selectedClipId, null);
  assert.equal(useMusicStore.getState().activeTrackId, 'drums');
  assert.equal(useMusicStore.getState().selectedBar, 0);
});

test('deleteClip ignores missing clips without changing state', () => {
  const beforeClips = structuredClone(useMusicStore.getState().clips);
  const beforeMatrix = structuredClone(useMusicStore.getState().matrix);

  assert.equal(useMusicStore.getState().deleteClip('missing-clip'), null);
  assert.equal(useMusicStore.getState().deleteSelectedClip(), null);
  assert.deepEqual(useMusicStore.getState().clips, beforeClips);
  assert.deepEqual(useMusicStore.getState().matrix, beforeMatrix);
});

test('createClip ignores unknown track ids', () => {
  const clip = useMusicStore.getState().createClip('unknown-track', 0);

  assert.equal(clip, null);
  assert.equal(useMusicStore.getState().clips.ids.every((id) => TRACK_IDS.includes(id.split('-bar-')[0])), true);
});

test('createClip ignores invalid bars', () => {
  const before = useMusicStore.getState().clips;

  assert.equal(useMusicStore.getState().createClip('bass', -1), null);
  assert.equal(useMusicStore.getState().createClip('bass', 8), null);
  assert.equal(useMusicStore.getState().createClip('bass', 1.5), null);
  assert.deepEqual(useMusicStore.getState().clips, before);
});

test('createEmptyClipsForTrack creates eight empty Melody clips and selects bar 1', () => {
  const createdClips = useMusicStore.getState().createEmptyClipsForTrack('melody');
  const state = useMusicStore.getState();

  assert.equal(createdClips.length, 8);
  assert.deepEqual(
    createdClips.map((clip) => clip.id),
    Array.from({ length: 8 }, (_, bar) => `melody-bar-${bar}`),
  );
  assert.deepEqual(
    state.clips.ids.filter((id) => id.startsWith('melody-bar-')),
    Array.from({ length: 8 }, (_, bar) => `melody-bar-${bar}`),
  );
  assert.equal(state.matrix.melody.every((bar) => bar.every((cell) => cell === null)), true);
  assert.equal(state.selectedClipId, 'melody-bar-0');
  assert.equal(state.activeTrackId, 'melody');
  assert.equal(state.selectedBar, 0);
});

test('createEmptyClipsForTrack skips existing clips and preserves matrix content', () => {
  const state = useMusicStore.getState();
  state.createClip('melody', 3);
  state.renameClip('melody-bar-3', 'Custom Melody');
  state.setCell('melody', 3, 4, { type: 'melody', note: 'E4' });

  const createdClips = useMusicStore.getState().createEmptyClipsForTrack('melody');
  const nextState = useMusicStore.getState();

  assert.equal(createdClips.length, 7);
  assert.equal(nextState.clips.ids.filter((id) => id.startsWith('melody-bar-')).length, 8);
  assert.deepEqual(nextState.getClipForTrackBar('melody', 3), {
    id: 'melody-bar-3',
    trackId: 'melody',
    bar: 3,
    name: 'Custom Melody',
    customName: true,
  });
  assert.deepEqual(nextState.matrix.melody[3][4], { type: 'melody', note: 'E4' });
  assert.equal(nextState.matrix.melody[0].every((cell) => cell === null), true);
  assert.equal(nextState.selectedClipId, 'melody-bar-0');
  assert.equal(nextState.selectedBar, 0);
});

test('createEmptyClipsForTrack ignores invalid track ids without changing state', () => {
  const beforeClips = structuredClone(useMusicStore.getState().clips);
  const beforeMatrix = structuredClone(useMusicStore.getState().matrix);

  const createdClips = useMusicStore.getState().createEmptyClipsForTrack('unknown-track');

  assert.deepEqual(createdClips, []);
  assert.deepEqual(useMusicStore.getState().clips, beforeClips);
  assert.deepEqual(useMusicStore.getState().matrix, beforeMatrix);
});

test('ensureMelodyClipsInRange creates only missing clips without changing selection or content', () => {
  const state = useMusicStore.getState();
  state.createClip('melody', 3);
  state.renameClip('melody-bar-3', 'Keep Me');
  state.setCell('melody', 3, 6, { type: 'melody', note: 'E4' });
  state.selectClip('drums-bar-0');
  const existingClip = useMusicStore.getState().clips.byId['melody-bar-3'];

  const created = useMusicStore.getState().ensureMelodyClipsInRange(2, 5);
  const nextState = useMusicStore.getState();

  assert.deepEqual(created.map((clip) => clip.bar), [2, 4, 5]);
  assert.deepEqual(
    [2, 3, 4, 5].map((bar) => nextState.getClipForTrackBar('melody', bar)?.id),
    ['melody-bar-2', 'melody-bar-3', 'melody-bar-4', 'melody-bar-5'],
  );
  assert.equal(nextState.clips.byId['melody-bar-3'], existingClip);
  assert.deepEqual(nextState.matrix.melody[3][6], { type: 'melody', note: 'E4' });
  assert.equal(nextState.selectedClipId, 'drums-bar-0');
  assert.equal(nextState.activeTrackId, 'drums');
  assert.equal(nextState.selectedBar, 0);
});

test('ensureMelodyClipsInRange rejects invalid ranges without changing clips', () => {
  const before = useMusicStore.getState().clips;

  assert.deepEqual(useMusicStore.getState().ensureMelodyClipsInRange(-1, 3), []);
  assert.deepEqual(useMusicStore.getState().ensureMelodyClipsInRange(5, 4), []);
  assert.deepEqual(useMusicStore.getState().ensureMelodyClipsInRange(0, 8), []);
  assert.equal(useMusicStore.getState().clips, before);
});
