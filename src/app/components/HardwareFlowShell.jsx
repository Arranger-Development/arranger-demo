import { Volume2 } from 'lucide-react';
import { renderIcon } from './icons.js';

const LEFT_CONTROLS = Object.freeze([
  Object.freeze({ label: 'MASTER VOLUME', type: 'knob' }),
  Object.freeze({ label: 'TUNE', type: 'knob' }),
  Object.freeze({ label: 'FX', type: 'button', light: 'dot' }),
  Object.freeze({ label: 'PRESET', type: 'button', light: 'bar' }),
]);

const RIGHT_CONTROLS = Object.freeze([
  Object.freeze({ label: 'TUNE', type: 'knob' }),
  Object.freeze({ label: 'FX', type: 'button', light: 'bar' }),
  Object.freeze({ label: 'MENU', type: 'button', light: 'bar' }),
  Object.freeze({ label: 'PRESET', type: 'button', light: 'bar' }),
]);

function renderHardwareControl(control, key) {
  return (
    <div className={`genre-hardware-control ${control.type}`} key={key}>
      {control.type === 'knob' ? (
        <span className="genre-knob" aria-hidden="true" />
      ) : (
        <span className={`genre-control-button ${control.light}`} aria-hidden="true">
          <span className="genre-control-light" />
        </span>
      )}
      <span className="genre-control-label">{control.label}</span>
    </div>
  );
}

function HardwareFlowShell({
  ariaLabel,
  children,
  consoleTitle = 'AETHER SYNTHESIZERS',
  kicker,
  screenClassName = '',
  title,
}) {
  const screenClasses = ['genre-screen', screenClassName].filter(Boolean).join(' ');

  return (
    <section className="genre-gate" aria-label={ariaLabel}>
      <div className="genre-hardware">
        <aside className="genre-side-rail left" aria-hidden="true">
          {LEFT_CONTROLS.map((control) => (
            renderHardwareControl(control, `left-${control.label}`)
          ))}
        </aside>

        <main className="genre-console">
          <div className={screenClasses}>
            <header className="genre-gate-head">
              <div className="genre-brand-lockup">
                <span className="genre-brand-icon" aria-hidden="true">{renderIcon(Volume2)}</span>
                <span className="genre-brand-text">Aether Synthesizers</span>
              </div>
              <div className="genre-title-group">
                <p className="genre-kicker">{kicker}</p>
                <h1>{title}</h1>
              </div>
            </header>
            {children}
          </div>

          <p className="genre-console-title">{consoleTitle}</p>
        </main>

        <aside className="genre-side-rail right" aria-hidden="true">
          {RIGHT_CONTROLS.map((control) => (
            renderHardwareControl(control, `right-${control.label}`)
          ))}
        </aside>
      </div>
    </section>
  );
}

export { HardwareFlowShell };
