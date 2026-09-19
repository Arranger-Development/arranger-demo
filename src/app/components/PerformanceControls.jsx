import { PERFORMANCE_LABELS as LABELS } from '../performanceModel.js';
import { TIMBRE_OPTIONS } from '../performanceSession.js';
export function TrackControls({ track, draft, updateTimbre }) {
  return <label>{LABELS[track]}音色<select aria-label={`${LABELS[track]}音色`} value={draft.timbres[track]} onChange={e => updateTimbre(track,e.target.value)}>{TIMBRE_OPTIONS[track].map((id,i) => <option key={id} value={id}>音色 {i+1} · 占位</option>)}</select></label>;
}
