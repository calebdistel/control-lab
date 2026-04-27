import { useState, useMemo } from 'react';

// ── Minimal Java-flavoured syntax highlighter ──────────────────
const KEYWORDS = new Set([
  'int','double','float','long','boolean','char','byte','short','void',
  'if','else','while','for','do','switch','case','break','return',
  'new','class','interface','extends','implements','import','package',
  'public','private','protected','static','final','abstract','this','super',
  'true','false','null','var','String',
]);

function tokenizeLine(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    // line comment
    if (text[i] === '/' && text[i + 1] === '/') {
      tokens.push({ type: 'comment', text: text.slice(i) });
      break;
    }
    // string literal
    if (text[i] === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j++;
      tokens.push({ type: 'string', text: text.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    // identifier / keyword
    if (/[a-zA-Z_$]/.test(text[i])) {
      let j = i;
      while (j < text.length && /[a-zA-Z0-9_$]/.test(text[j])) j++;
      const word = text.slice(i, j);
      tokens.push({ type: KEYWORDS.has(word) ? 'keyword' : 'ident', text: word });
      i = j;
      continue;
    }
    // number
    if (/[0-9]/.test(text[i])) {
      let j = i;
      while (j < text.length && /[0-9._]/.test(text[j])) j++;
      tokens.push({ type: 'number', text: text.slice(i, j) });
      i = j;
      continue;
    }
    // merge plain chars
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
      {showNums && (
        <span className="ct-line-num">{lineNum}</span>
      )}
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

// ── CodeTrace component ────────────────────────────────────────
export default function CodeTrace({ code, variables: initial, steps }) {
  const [idx, setIdx] = useState(-1);

  const codeLines = useMemo(
    () => (code ? code.trim().split('\n') : null),
    [code]
  );

  const currentVars = idx < 0 ? initial : steps[idx].state;

  const changed = useMemo(() => {
    if (idx < 0) return new Set();
    const prev = idx === 0 ? initial : steps[idx - 1].state;
    return new Set(Object.keys(currentVars).filter(k => String(currentVars[k]) !== String(prev[k])));
  }, [idx]);

  const atStart = idx < 0;
  const atEnd   = idx === steps.length - 1;
  const activeLine = idx >= 0 ? (steps[idx].line ?? null) : null;
  const activeLabel = idx >= 0 ? (steps[idx].label ?? steps[idx].code ?? '') : null;
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

        {/* Code panel (only when code prop is present) */}
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

        {/* Step list (only when no code prop — legacy mode) */}
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
          {Object.entries(currentVars).map(([k, v]) => (
            <div key={k} className={`ct-var${changed.has(k) ? ' ct-var-changed' : ''}`}>
              <span className="ct-var-name">{k}</span>
              <span className="ct-var-val">{String(v)}</span>
            </div>
          ))}
          {atStart && (
            <p className="ct-vars-hint">Step through to see values update.</p>
          )}
        </div>
      </div>

      {/* Annotation bar (code mode only) */}
      {codeLines && (
        <div className="ct-annotation">
          {activeLabel
            ? <><span className="ct-annotation-arrow">▶</span> {activeLabel}{activeComment && <span className="ct-annotation-comment"> — {activeComment}</span>}</>
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
