import { DRUM_SEQUENCER_ROWS } from '../drumSequencerData.js';
import { hitStrength } from '../templatePreview.js';

const STEPS = Array.from({ length: 16 }, (_, i) => i);
const HIT_LABELS = { kick: 'K', snare: 'S', hihat: 'H' };

export default function DrumTemplateRhythm({ hits, name }) {
  return <div className="gtpl-rhythm drum-template-rhythm" aria-label={`律动预览·${name}`}>
    <div className="drum-template-beat-markers" aria-hidden="true">
      <span />
      <div className="drum-template-beat-marker-grid">
        {STEPS.map(step => <span className="drum-template-beat-marker mono" key={step}>{step % 4 === 0 ? step + 1 : ''}</span>)}
      </div>
    </div>
    {DRUM_SEQUENCER_ROWS.map(row => <div className="drum-template-row" key={row.id}>
      <span className="drum-template-row-label">{row.label}</span>
      <div className="drum-template-row-grid">
        {STEPS.map(step => {
          const events = hits.filter(hit => hit.instrument === row.id && hit.step === step);
          const first = events[0];
          const hitLabel = first ? HIT_LABELS[row.id] : null;
          return <span
            key={step}
            className={['gtpl-step', 'drum-template-step', step % 4 === 0 ? 'downbeat' : '', first ? 'hit-block' : ''].filter(Boolean).join(' ')}
            data-instrument={row.id}
            data-hit-label={hitLabel ?? undefined}
            data-hit-strength={first ? hitStrength(first.velocity) : undefined}
            data-hit-count={events.length}
            style={first ? { '--drum-hit-left': `${50 + first.offset * 100}%` } : undefined}
            aria-label={first ? `${row.label} 第${step + 1}步，${events.length}次，${events.map(hit => `偏移${hit.offset}，力度${Math.round(hit.velocity * 100)}%`).join('；')}` : `${row.label} 第${step + 1}步休止`}
          >
            {first && <span className="drum-template-hit-label" aria-hidden="true">{hitLabel}</span>}
            {events.slice(1).map((hit, i) => <span className="drum-template-extra-hit" key={i} data-hit-strength={hitStrength(hit.velocity)} style={{ left: `${50 + hit.offset * 100}%` }} aria-hidden="true" />)}
          </span>;
        })}
      </div>
    </div>)}
  </div>;
}
