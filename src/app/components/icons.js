import { createElement } from 'react';
import {
  AudioLines,
  Disc3,
  Drum,
  Guitar,
  KeyboardMusic,
  MicVocal,
  Music,
  Music2,
  Piano,
} from 'lucide-react';

const TRACK_ICONS = {
  drums: Drum,
  bass: Music,
  chord: Piano,
  melody: AudioLines,
  pad: KeyboardMusic,
  sample: Disc3,
  vocal: MicVocal,
};

const PERFORMANCE_TRACK_ICONS = { drums: Drum, chord: Piano, bass: Guitar, melody: Music2 };

function renderIcon(Icon, props = {}) {
  return createElement(Icon, { 'aria-hidden': 'true', ...props });
}

export { TRACK_ICONS, PERFORMANCE_TRACK_ICONS, renderIcon };
