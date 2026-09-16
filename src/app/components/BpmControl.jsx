import {
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  BPM_MAX,
  BPM_MIN,
  BPM_PRESETS,
  BPM_STEP,
  normalizeBpm,
} from '../../domain/bpm.js';

function BpmControl({
  disabled = false,
  idPrefix = 'bpm',
  onChange = () => {},
  unit = 'BPM',
  value,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = String(value);
  }, [value]);

  const commit = useCallback((nextValue) => {
    const nextBpm = normalizeBpm(nextValue, value);
    if (inputRef.current) inputRef.current.value = String(nextBpm);
    if (nextBpm !== value) onChange(nextBpm);
  }, [onChange, value]);

  const handleInputKeyDown = (event) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const direction = event.key === 'ArrowUp' ? 1 : -1;
      const inputValue = normalizeBpm(event.currentTarget.value, value);
      commit(inputValue + direction * BPM_STEP);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(event.currentTarget.value);
      event.currentTarget.select();
      return;
    }
    if (event.key === 'Escape') {
      event.currentTarget.value = String(value);
      event.currentTarget.blur();
    }
  };

  return (
    <div className="bpm-control" data-disabled={disabled ? 'true' : undefined}>
      <div className="bpm-stepper" role="group" aria-label="调整 BPM">
        <button
          className="bpm-step-button"
          type="button"
          aria-label="降低 BPM"
          disabled={disabled || value <= BPM_MIN}
          onClick={() => commit(value - BPM_STEP)}
        >
          −
        </button>
        <label className="bpm-value-field" htmlFor={`${idPrefix}-value`}>
          <span className="sr-only">BPM 数值</span>
          <input
            ref={inputRef}
            id={`${idPrefix}-value`}
            type="number"
            min={BPM_MIN}
            max={BPM_MAX}
            step={BPM_STEP}
            inputMode="numeric"
            defaultValue={value}
            disabled={disabled}
            aria-label="BPM 数值"
            onBlur={(event) => commit(event.currentTarget.value)}
            onKeyDown={handleInputKeyDown}
          />
          <span className="bpm-unit" aria-hidden="true">{unit}</span>
        </label>
        <button
          className="bpm-step-button"
          type="button"
          aria-label="提高 BPM"
          disabled={disabled || value >= BPM_MAX}
          onClick={() => commit(value + BPM_STEP)}
        >
          +
        </button>
      </div>

      <div className="bpm-presets" role="group" aria-label="BPM 快捷值">
        {BPM_PRESETS.map((preset) => (
          <button
            className="bpm-preset-button mono"
            data-active={preset === value ? 'true' : undefined}
            key={preset}
            type="button"
            disabled={disabled}
            aria-pressed={preset === value}
            onClick={() => commit(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}

export { BpmControl };
