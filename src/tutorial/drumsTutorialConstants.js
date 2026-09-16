const DRUMS_TUTORIAL_FIRST_BAR = 0;
const DRUMS_KICK_BLUE_STEPS = Object.freeze([0, 4, 12]);
const DRUMS_KICK_GREEN_STEPS = Object.freeze([2, 6, 10, 14]);
const DRUMS_KICK_YELLOW_STEPS = Object.freeze([1, 3, 5, 7, 9, 11, 13, 15]);
const DRUMS_DRAG_SOURCE_STEP = 0;
const DRUMS_DRAG_TARGET_STEP = 2;

const TUTORIAL_CONTROL_TARGETS = Object.freeze({
  BASS_GROOVE_BUTTON: 'bass-groove-button',
  BASS_GROOVE_CARD_PREFIX: 'bass-groove-card',
  CHORD_GROOVE_CARD_PREFIX: 'chord-groove-card',
  CHORD_TEMPLATE_APPLY: 'chord-template-apply',
  CHORD_TEMPLATE_CARD_PREFIX: 'chord-template-card',
  CHORD_TEMPLATE_WORKSPACE_BUTTON: 'chord-template-workspace-button',
  FILL_EMPTY_CLIPS_PREFIX: 'fill-empty-clips',
  GENERATE_ALL_DRUMS_BARS: 'generate-all-drums-bars',
  GENERATE_CURRENT_DRUMS_BAR: 'generate-current-drums-bar',
  MELODY_EXAMPLE_KEYS_PREFIX: 'melody-example-keys',
  MELODY_STYLE_APPLY_GLOBAL: 'melody-style-apply-global',
  MELODY_STYLE_BUTTON: 'melody-style-button',
  MELODY_STYLE_CARD_PREFIX: 'melody-style-card',
  TRANSPORT_PLAY: 'transport-play',
});

const TUTORIAL_TARGETS = Object.freeze({
  TOP_BAR: 'top-bar',
  TRACK_AREA: 'track-area',
  TRACK_EDITOR: 'track-editor',
  DRUMS_CLIP_BAR_PREFIX: 'drums-clip-bar',
  DRUM_STEP_PREFIX: 'drum-step',
});

export {
  DRUMS_DRAG_SOURCE_STEP,
  DRUMS_DRAG_TARGET_STEP,
  DRUMS_KICK_BLUE_STEPS,
  DRUMS_KICK_GREEN_STEPS,
  DRUMS_KICK_YELLOW_STEPS,
  DRUMS_TUTORIAL_FIRST_BAR,
  TUTORIAL_CONTROL_TARGETS,
  TUTORIAL_TARGETS,
};
