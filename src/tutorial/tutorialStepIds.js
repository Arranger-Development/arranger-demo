const TUTORIAL_STEP_IDS = Object.freeze({
  DRUMS_OPEN_FIRST_CLIP: 'drums-open-first-clip',
  DRUMS_GENERATE_CURRENT_BAR: 'drums-generate-current-bar',
  DRUMS_LISTEN_FIRST_CLIP: 'drums-listen-first-clip',
  DRUMS_FILL_TRACK_CLIPS: 'drums-fill-track-clips',
  DRUMS_GENERATE_ALL_BARS: 'drums-generate-all-bars',
  DRUMS_ADD_KICK_VARIATION: 'drums-add-kick-variation',
  DRUMS_DRAG_KICK: 'drums-drag-kick',
  DRUMS_FREE_CREATE: 'drums-free-create',
  CHORD_FILL_TRACK_CLIPS: 'chord-fill-track-clips',
  CHORD_SELECT_PROGRESSION_TEMPLATE: 'chord-select-progression-template',
  CHORD_LISTEN_LOOP: 'chord-listen-loop',
  BASS_FILL_TRACK_CLIPS: 'bass-fill-track-clips',
  BASS_SELECT_GROOVE_TEMPLATE: 'bass-select-groove-template',
  BASS_LISTEN_LOOP: 'bass-listen-loop',
  MELODY_FILL_TRACK_CLIPS: 'melody-fill-track-clips',
  MELODY_SELECT_SCALE: 'melody-select-scale',
  MELODY_EXAMPLE_INTRO_1: 'melody-example-intro-1',
  MELODY_PLAY_EXAMPLE_1: 'melody-play-example-1',
  MELODY_EXAMPLE_INTRO_2: 'melody-example-intro-2',
  MELODY_PLAY_EXAMPLE_2: 'melody-play-example-2',
  MELODY_PLAY_EXAMPLE_3: 'melody-play-example-3',
  MELODY_FREE_CREATE: 'melody-free-create',
});

const TUTORIAL_STEP_ORDER = Object.freeze(Object.values(TUTORIAL_STEP_IDS));

const TUTORIAL_DIRECTORY_ITEMS = Object.freeze([
  Object.freeze({ id: 'drums', label: 'Drums', stepId: TUTORIAL_STEP_IDS.DRUMS_OPEN_FIRST_CLIP }),
  Object.freeze({ id: 'chord', label: 'Chord', stepId: TUTORIAL_STEP_IDS.CHORD_FILL_TRACK_CLIPS }),
  Object.freeze({ id: 'bass', label: 'Bass', stepId: TUTORIAL_STEP_IDS.BASS_FILL_TRACK_CLIPS }),
  Object.freeze({ id: 'melody', label: 'Melody', stepId: TUTORIAL_STEP_IDS.MELODY_FILL_TRACK_CLIPS }),
]);

export {
  TUTORIAL_DIRECTORY_ITEMS,
  TUTORIAL_STEP_IDS,
  TUTORIAL_STEP_ORDER,
};
