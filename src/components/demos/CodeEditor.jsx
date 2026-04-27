import { useState, useCallback, useRef } from 'react';

const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';

function normalize(s) {
  return String(s ?? '').replace(/\r\n/g, '\n').trim();
}

async function runCode(code, stdin = '') {
  const res = await fetch(PISTON_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'java',
      version: '*',
      files: [{ name: 'Main.java', content: code }],
      stdin,
    }),
  });
  if (!res.ok) throw new Error(`Piston API error: ${res.status}`);
  const data = await res.json();
  return {
    stdout: data.run?.stdout ?? '',
    stderr: data.run?.stderr ?? '',
    code:   data.run?.code ?? -1,
  };
}

// ── Tab-key support in textarea ───────────────────────────────
function handleTab(e, setter) {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const el = e.target;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const next = el.value.slice(0, start) + '    ' + el.value.slice(end);
  setter(next);
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = start + 4;
  });
}

// ── Single test result row ────────────────────────────────────
function TestRow({ tc, result }) {
  const [open, setOpen] = useState(false);
  const status = result == null ? 'pending'
    : result.error ? 'error'
    : result.passed ? 'pass'
    : 'fail';

  return (
    <div className={`ce-test ce-test-${status}`}>
      <button className="ce-test-header" onClick={() => setOpen(o => !o)}>
        <span className={`ce-test-dot ce-dot-${status}`} />
        <span className="ce-test-label">{tc.label}</span>
        {status === 'pass' && <span className="ce-test-verdict">Passed</span>}
        {status === 'fail' && <span className="ce-test-verdict ce-fail">Wrong answer</span>}
        {status === 'error' && <span className="ce-test-verdict ce-fail">Runtime error</span>}
        {status === 'pending' && <span className="ce-test-verdict ce-pending">—</span>}
        <span className={`ce-test-chevron${open ? ' open' : ''}`}>▶</span>
      </button>
      {open && (
        <div className="ce-test-detail">
          {tc.input && (
            <div className="ce-detail-row">
              <span className="ce-detail-label">Input</span>
              <pre className="ce-detail-pre">{tc.input}</pre>
            </div>
          )}
          <div className="ce-detail-row">
            <span className="ce-detail-label">Expected</span>
            <pre className="ce-detail-pre ce-expected">{tc.expected}</pre>
          </div>
          {result && (
            <div className="ce-detail-row">
              <span className="ce-detail-label">Got</span>
              <pre className={`ce-detail-pre ${result.passed ? 'ce-expected' : 'ce-got-wrong'}`}>
                {result.error ? result.error : result.actual || '(no output)'}
              </pre>
            </div>
          )}
          {result?.stderr && (
            <div className="ce-detail-row">
              <span className="ce-detail-label">Stderr</span>
              <pre className="ce-detail-pre ce-stderr">{result.stderr}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main CodeEditor component ─────────────────────────────────
export default function CodeEditor({ starterCode = '', testCases = [], hint = '' }) {
  const [code, setCode] = useState(starterCode);
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const textareaRef = useRef(null);

  const allPassed = results.length > 0 && results.every(r => r?.passed);
  const anyRun    = results.length > 0;

  const runAll = useCallback(async () => {
    setRunning(true);
    setRunError('');
    setResults(testCases.map(() => null));

    const next = [];
    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      try {
        const { stdout, stderr, code: exitCode } = await runCode(code, tc.input ?? '');
        if (exitCode !== 0 && !stdout) {
          next.push({ passed: false, error: stderr || `Exit code ${exitCode}`, stderr, actual: '' });
        } else {
          const actual = normalize(stdout);
          const expected = normalize(tc.expected);
          next.push({ passed: actual === expected, actual, expected, stderr });
        }
      } catch (err) {
        next.push({ passed: false, error: err.message, stderr: '', actual: '' });
        setRunError('Could not reach code execution server. Check your internet connection.');
      }
      setResults([...next, ...testCases.slice(i + 1).map(() => null)]);
    }
    setRunning(false);
  }, [code, testCases]);

  const passCount = results.filter(r => r?.passed).length;

  return (
    <div className="ce-root">
      <div className="ce-editor-header">
        <span className="ce-label">Code Editor</span>
        <span className="ce-lang">Java</span>
      </div>

      <div className="ce-editor-area">
        <textarea
          ref={textareaRef}
          className="ce-textarea"
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => handleTab(e, setCode)}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>

      <div className="ce-run-bar">
        <button
          className={`ce-run-btn${running ? ' ce-running' : ''}`}
          onClick={runAll}
          disabled={running}
        >
          {running ? '⏳ Running…' : '▶ Run'}
        </button>
        {anyRun && !running && (
          <span className={`ce-score ${allPassed ? 'ce-score-pass' : 'ce-score-fail'}`}>
            {passCount} / {testCases.length} passed
          </span>
        )}
        {allPassed && (
          <span className="ce-confetti">🎉 All tests passing!</span>
        )}
      </div>

      {runError && <p className="ce-run-error">{runError}</p>}

      {testCases.length > 0 && (
        <div className="ce-tests">
          {testCases.map((tc, i) => (
            <TestRow key={i} tc={tc} result={results[i] ?? null} />
          ))}
        </div>
      )}

      {hint && (
        <details className="ce-hint">
          <summary>Stuck? Show hint</summary>
          <p className="ce-hint-body">{hint}</p>
        </details>
      )}
    </div>
  );
}
