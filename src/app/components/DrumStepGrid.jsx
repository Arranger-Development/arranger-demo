import { DRUM_INPUT_CELLS } from '../../input/drumsInputLayout.js';
import { DRUM_SEQUENCER_ROWS } from '../drumSequencerData.js';

const STEP_GROUPS = Array.from({length:4}, (_,beat) => Array.from({length:4}, (_,step) => beat*4+step+1));

export default function DrumStepGrid({ renderStep, disabled = false, onPadInput }) {
  const Label = onPadInput ? 'button' : 'div';
  void Label;
  return (
          <div className="drum-sequencer-grid">
            <div className="drum-row-labels" role="group" aria-label="虚拟鼓垫">
              <div className="drum-row-label-spacer" aria-hidden="true" />
              {DRUM_INPUT_CELLS.map((pad) => (
                <Label
                  className="drum-row-label drum-performance-pad"
                  type={onPadInput ? 'button' : undefined}
                  data-instrument={pad.instrument}
                  disabled={disabled}
                  key={pad.instrument}
                  aria-label={onPadInput ? `${pad.label} 鼓垫，键盘 ${pad.keyLabel}` : pad.label}
                  onClick={(event) => {
                    if (event.detail === 0) {
                      onPadInput?.(pad.instrument, event.timeStamp);
                    }
                  }}
                  onPointerDown={(event) => {
                    if (event.button === 0) {
                      onPadInput?.(pad.instrument, event.timeStamp);
                    }
                  }}
                >
                  <span className="drum-dot" data-instrument={pad.instrument} />
                  <span className="drum-pad-label">{pad.label}</span>
                  {onPadInput && <kbd className="drum-pad-key">{pad.keyLabel}</kbd>}
                </Label>
              ))}
            </div>

            <div className="drum-steps drum-step-groups">
              {STEP_GROUPS.map((stepGroup, groupIndex) => (
                <section
                  className="drum-step-group"
                  aria-label={`Beat ${groupIndex + 1}`}
                  key={groupIndex}
                >
                  <header className="drum-beat-header">
                    <span className="drum-beat-label mono">
                      BEAT
                      {' '}
                      {groupIndex + 1}
                    </span>
                    <div className="drum-beat-position-row" aria-hidden="true">
                      {stepGroup.map((stepNumber, beatStepIndex) => (
                        <span
                          className="drum-step-number mono"
                          key={stepNumber}
                        >
                          {beatStepIndex + 1}
                        </span>
                      ))}
                    </div>
                  </header>
                  {DRUM_SEQUENCER_ROWS.map((row) => (
                    <div
                      className="drum-beat-row"
                      data-instrument={row.id}
                      key={row.id}
                    >
                      {stepGroup.map((stepNumber) => renderStep(row, stepNumber))}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
  );
}
