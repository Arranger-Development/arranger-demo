import { useState } from 'react';
import RotaryKnob from './RotaryKnob.jsx';

const ROOTS = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
// This is an independent UI selection; it never changes music or AI inputs.
export default function KeyDial() {
  const [root, setRoot] = useState(0);
  const [minor, setMinor] = useState(false);
  return <RotaryKnob label="调性" value={root} min={0} max={11} step={1} onChange={setRoot}
    format={value => `${ROOTS[value]}${minor ? 'm' : ''}`}
    ticks={[{value:0,label:'C'},{value:11,label:'B'}]}
    labelAccessory={<span className="key-mode-toggle" role="group" aria-label="大小调">
      <button type="button" aria-pressed={!minor} onClick={() => setMinor(false)}>大调</button>
      <button type="button" aria-pressed={minor} onClick={() => setMinor(true)}>小调</button>
    </span>}/>;
}
void RotaryKnob;
