import { useState, useMemo } from 'react';

// ── Minimal Java-flavoured syntax highlighter ──────────────────
const KEYWORDS = new Set([
  'int','double','float','long','boolean','char','byte','short','void',
  'if','else','while','for','do','switch','case','break','return',
  'new','class','interface','extends','implements','import','package',
  'public','private','protected','static','final','abstract','this','super',
  'true','false','null','var','String','enum',
]);

function tokenizeLine(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '/' && text[i + 1] === '/') {
      tokens.push({ type: 'comment', text: text.slice(i) });
      break;
    }
    if (text[i] === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j++;
      tokens.push({ type: 'string', text: text.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if (/[a-zA-Z_$]/.test(text[i])) {
      let j = i;
      while (j < text.length && /[a-zA-Z0-9_$]/.test(text[j])) j++;
      const word = text.slice(i, j);
      tokens.push({ type: KEYWORDS.has(word) ? 'keyword' : 'ident', text: word });
      i = j;
      continue;
    }
    if (/[0-9]/.test(text[i])) {
      let j = i;
      while (j < text.length && /[0-9._]/.test(text[j])) j++;
      tokens.push({ type: 'number', text: text.slice(i, j) });
      i = j;
      continue;
    }
    const last = tokens[tokens.length - 1];
    if (last?.type === 'plain') last.text += text[i];
    else tokens.push({ type: 'plain', text: text[i] });
    i++;
  }
  return tokens;
}

const TOKEN_COLOR = {
  keyword: 'var(--accent)',
  string:  '#90d090',
  comment: 'var(--dark-grey)',
  number:  '#ff9870',
  ident:   'var(--light-grey)',
  plain:   'var(--light-grey)',
};

function CodeLine({ text, active, lineNum, showNums }) {
  const tokens = useMemo(() => tokenizeLine(text), [text]);
  return (
    <div className={`ct-line${active ? ' ct-line-active' : ''}`}>
      {showNums && <span className="ct-line-num">{lineNum}</span>}
      <span className="ct-line-text" aria-hidden="true">
        {active && <span className="ct-line-arrow">▶</span>}
        {!active && showNums && <span className="ct-line-arrow ct-line-arrow-hidden">▶</span>}
      </span>
      <code className="ct-line-code">
        {tokens.map((tok, i) => (
          <span
            key={i}
            style={{
              color: TOKEN_COLOR[tok.type],
              fontStyle: tok.type === 'comment' ? 'italic' : 'normal',
            }}
          >{tok.text}</span>
        ))}
      </code>
    </div>
  );
}

// ── CodeTrace component ─────────────────────────────────────────
// Variables are only shown in the state panel once they first appear
// in a step's `state` object — modelling actual declaration order.
// Keys present in `variables` (initial) are visible from the start.
//
// Step shape: { line?, label?, code?, state, comment?, console? }
//   console: string | string[]  — appended to the output panel when reached
export default function CodeTrace({ code, variables: initial = {}, steps }) {
  const [idx, setIdx] = useState(-1);

  const codeLines = useMemo(
    () => (code ? code.trim().split('\n') : null),
    [code]
  );

  // Keys visible at current step, in declaration order.
  // A key becomes visible when it first appears in any step.state up to idx.
  const orderedKeys = useMemo(() => {
    const order = [];
    const seen = new Set();
    for (const k of Object.keys(initial)) {
      if (!seen.has(k)) { order.push(k); seen.add(k); }
    }
    for (let i = 0; i <= idx; i++) {
      if (i >= 0 && steps[i]?.state) {
        for (const k of Object.keys(steps[i].state)) {
          if (!seen.has(k)) { order.push(k); seen.add(k); }
        }
      }
    }
    return order;
  }, [idx, initial, steps]);

  // Last-known value for every visible key.
  const currentVals = useMemo(() => {
    const vals = { ...initial };
    for (let i = 0; i <= idx; i++) {
      if (i >= 0 && steps[i]?.state) Object.assign(vals, steps[i].state);
    }
    return vals;
  }, [idx, initial, steps]);

  // Values from the previous step (for change detection).
  const prevVals = useMemo(() => {
    const vals = { ...initial };
    for (let i = 0; i < idx; i++) {
      if (i >= 0 && steps[i]?.state) Object.assign(vals, steps[i].state);
    }
    return vals;
  }, [idx, initial, steps]);

  const changedVars = useMemo(() => {
    if (idx < 0) return new Set();
    return new Set(orderedKeys.filter(k => String(currentVals[k]) !== String(prevVals[k])));
  }, [idx, orderedKeys, currentVals, prevVals]);

  // Keys that appear for the very first time at this step.
  const newVars = useMemo(() => {
    if (idx < 0) return new Set();
    const prevKeys = new Set(Object.keys(initial));
    for (let i = 0; i < idx; i++) {
      if (steps[i]?.state) Object.keys(steps[i].state).forEach(k => prevKeys.add(k));
    }
    return new Set(Object.keys(steps[idx]?.state ?? {}).filter(k => !prevKeys.has(k)));
  }, [idx, initial, steps]);

  // Accumulated console lines (grows as user steps forward).
  const consoleLines = useMemo(() => {
    const lines = [];
    for (let i = 0; i <= idx; i++) {
      if (i >= 0 && steps[i]?.console) {
        const c = steps[i].console;
        Array.isArray(c) ? lines.push(...c) : lines.push(String(c));
      }
    }
    return lines;
  }, [idx, steps]);

  const hasConsole = useMemo(() => steps.some(s => s.console), [steps]);

  // Count of lines added at exactly this step (for the flash animation).
  const newConsoleCount = useMemo(() => {
    if (idx < 0 || !steps[idx]?.console) return 0;
    const c = steps[idx].console;
    return Array.isArray(c) ? c.length : 1;
  }, [idx, steps]);

  const atStart = idx < 0;
  const atEnd   = idx === steps.length - 1;
  const activeLine    = idx >= 0 ? (steps[idx].line ?? null) : null;
  const activeLabel   = idx >= 0 ? (steps[idx].label ?? steps[idx].code ?? '') : null;
  const activeComment = idx >= 0 ? steps[idx].comment : null;

  return (
    <div className="ct-root">
      {/* Header */}
      <div className="ct-header">
        <span className="ct-label">Code Tracer</span>
        {!atStart && (
          <button className="ct-reset" onClick={() => setIdx(-1)}>Reset</button>
        )}
      </div>

      {/* Body */}
      <div className={`ct-body${codeLines ? ' ct-body-code' : ''}`}>

        {/* Real-code panel */}
        {codeLines && (
          <div className="ct-code-panel">
            {codeLines.map((line, i) => (
              <CodeLine
                key={i}
                text={line}
                lineNum={i + 1}
                showNums
                active={activeLine === i + 1}
              />
            ))}
          </div>
        )}

        {/* Legacy pseudocode step list */}
        {!codeLines && (
          <div className="ct-steps">
            {steps.map((step, i) => (
              <div
                key={i}
                className={[
                  'ct-step',
                  i === idx ? 'ct-step-active' : '',
                  i < idx   ? 'ct-step-done'   : '',
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
        )}

        {/* Variable state panel */}
        <div className="ct-vars">
          <span className="ct-vars-label">State</span>
          {orderedKeys.map(k => {
            const raw  = currentVals[k];
            const isNull = raw === null || raw === undefined;
            const text = isNull ? 'null' : String(raw);
            return (
              <div
                key={k}
                className={[
                  'ct-var',
                  changedVars.has(k) && !newVars.has(k) ? 'ct-var-changed' : '',
                  newVars.has(k) ? 'ct-var-new' : '',
                ].filter(Boolean).join(' ')}
              >
                <span className="ct-var-name">{k}</span>
                <span className={`ct-var-val${isNull ? ' ct-var-null' : ''}`}>{text}</span>
              </div>
            );
          })}
          {atStart && (
            <p className="ct-vars-hint">
              {orderedKeys.length === 0
                ? 'Step through to see variables appear as they are declared.'
                : 'Step through to see values update.'}
            </p>
          )}
        </div>
      </div>

      {/* Console output (only rendered when any step has console output) */}
      {hasConsole && (
        <div className="ct-console">
          <span className="ct-console-label">Console</span>
          {consoleLines.length === 0 ? (
            <span className="ct-console-empty">No output yet</span>
          ) : (
            consoleLines.map((line, i) => (
              <div
                key={i}
                className={`ct-console-line${i >= consoleLines.length - newConsoleCount ? ' ct-console-new' : ''}`}
              >
                {line}
              </div>
            ))
          )}
        </div>
      )}

      {/* Annotation bar (code mode only) */}
      {codeLines && (
        <div className="ct-annotation">
          {activeLabel
            ? <>
                <span className="ct-annotation-arrow">▶</span>
                {' '}{activeLabel}
                {activeComment && <span className="ct-annotation-comment"> — {activeComment}</span>}
              </>
            : <span className="ct-annotation-placeholder">Press Start to begin stepping through the code.</span>
          }
        </div>
      )}

      {/* Controls */}
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
