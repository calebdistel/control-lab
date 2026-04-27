import { useState, useMemo } from 'react';

export default function CodeTrace({ variables: initial, steps }) {
  const [idx, setIdx] = useState(-1);

  const currentVars = idx < 0 ? initial : steps[idx].state;

  const changed = useMemo(() => {
    if (idx < 0) return new Set();
    const prev = idx === 0 ? initial : steps[idx - 1].state;
    return new Set(Object.keys(currentVars).filter(k => currentVars[k] !== prev[k]));
  }, [idx]);

  const atStart = idx < 0;
  const atEnd   = idx === steps.length - 1;

  return (
    <div className="ct-root">
      <div className="ct-header">
        <span className="ct-label">Code Tracer</span>
        {!atStart && (
          <button className="ct-reset" onClick={() => setIdx(-1)}>Reset</button>
        )}
      </div>

      <div className="ct-body">
        <div className="ct-steps">
          {steps.map((step, i) => (
            <div
              key={i}
              className={[
                'ct-step',
                i === idx   ? 'ct-step-active' : '',
                i < idx     ? 'ct-step-done'   : '',
              ].join(' ')}
            >
              <span className="ct-step-num">{String(i + 1).padStart(2, '0')}</span>
              <code className="ct-step-code">{step.code}</code>
              {step.comment && (
                <span className="ct-step-comment">// {step.comment}</span>
              )}
            </div>
          ))}
        </div>

        <div className="ct-vars">
          <span className="ct-vars-label">State</span>
          {Object.entries(currentVars).map(([k, v]) => (
            <div key={k} className={`ct-var${changed.has(k) ? ' ct-var-changed' : ''}`}>
              <span className="ct-var-name">{k}</span>
              <span className="ct-var-val">{String(v)}</span>
            </div>
          ))}
          {atStart && (
            <p className="ct-vars-hint">Step through to see variables update.</p>
          )}
        </div>
      </div>

      <div className="ct-controls">
        <button
          className="ct-btn"
          onClick={() => setIdx(i => Math.max(-1, i - 1))}
          disabled={atStart}
        >← Back</button>

        <span className="ct-counter">
          {atStart ? 'Initial state' : `Step ${idx + 1} of ${steps.length}`}
        </span>

        <button
          className="ct-btn ct-btn-primary"
          onClick={() => setIdx(i => Math.min(steps.length - 1, i + 1))}
          disabled={atEnd}
        >
          {atStart ? 'Start →' : atEnd ? 'Done ✓' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
