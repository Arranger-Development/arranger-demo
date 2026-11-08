import { useRef } from 'react';
import PerformanceMode from '../app/components/PerformanceMode.jsx';
import { createJamTemplateProjects } from '../app/jamTemplateProjects.js';
import useLaunchpadXCommands from '../input/useLaunchpadXCommands.js';
import HumControls from './HumControls.jsx';
import { arrangeHumMelody } from './humArrangement.js';

void PerformanceMode;

const session = new Map();
const storage = { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value) };
const projectStore = createJamTemplateProjects(storage, 'pop', null, 88);
projectStore.rename('哼唱预览');

export default function HumPreview() {
  const controlsRef = useRef(null);
  const { connect, ...hardwareInput } = useLaunchpadXCommands({ performanceActive: true, performanceControlsRef: controlsRef });
  return <PerformanceMode active genreId="pop" projectStore={projectStore} humControl={HumControls} arrangeMelody={arrangeHumMelody} controlsRef={controlsRef}
    hardwareInput={{ ...hardwareInput, onConnect: connect }} />;
}
