import { useState, useEffect, useRef, useCallback } from 'react';
import { EditorView, minimalSetup } from 'codemirror';
import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, Decoration } from '@codemirror/view';
import { defaultKeymap, historyKeymap, indentWithTab, history } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, indentUnit } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { java } from '@codemirror/lang-java';
import { tags } from '@lezer/highlight';
import { transpile } from '../../lib/javaTranspiler.js';

// ── CobraLink theme ───────────────────────────────────────────
const cobraTheme = EditorView.theme({
  '&': {
    background: '#07101a',
    color: '#c9d1d9',
    fontSize: '0.845rem',
    fontFamily: '"JetBrains Mono", "Fira Mono", "Courier New", monospace',
  },
  '.cm-scroller': { lineHeight: '1.65', fontFamily: 'inherit' },
  '.cm-content': { padding: '0.75rem 0', caretColor: '#4DC6FF' },
  '.cm-cursor': { borderLeftColor: '#4DC6FF', borderLeftWidth: '2px' },
  '.cm-activeLine': { background: 'rgba(77,198,255,0.055)' },
  '.cm-activeLineGutter': { background: 'rgba(77,198,255,0.055)', color: '#4DC6FF' },
  '.cm-gutters': {
    background: '#07101a',
    borderRight: '1px solid rgba(61,90,128,0.28)',
    color: '#2d4560',
    minWidth: '2.8em',
  },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 0.6em 0 0.4em' },
  '.cm-selectionBackground': { background: 'rgba(77,198,255,0.18) !important' },
  '&.cm-focused .cm-selectionBackground': { background: 'rgba(77,198,255,0.22) !important' },
  '.cm-matchingBracket': { color: '#4DC6FF !important', fontWeight: 'bold' },
  '.cm-error-line': {
    background: 'rgba(240,128,128,0.1)',
    borderLeft: '3px solid rgba(240,128,128,0.7)',
  },
}, { dark: true });

const cobraHighlight = HighlightStyle.define([
  { tag: tags.keyword,         color: '#4DC6FF' },
  { tag: tags.string,          color: '#90d090' },
  { tag: tags.comment,         color: '#3D5A80', fontStyle: 'italic' },
  { tag: tags.number,          color: '#ff9870' },
  { tag: tags.typeName,        color: '#7ecfff' },
  { tag: tags.className,       color: '#7ecfff' },
  { tag: tags.definition(tags.variableName), color: '#c9d1d9' },
  { tag: tags.variableName,    color: '#c9d1d9' },
  { tag: tags.propertyName,    color: '#a0c8ff' },
  { tag: tags.function(tags.variableName), color: '#a0c8ff' },
  { tag: tags.function(tags.propertyName), color: '#a0c8ff' },
  { tag: tags.operator,        color: '#8dbddd' },
  { tag: tags.punctuation,     color: '#8dbddd' },
  { tag: tags.bool,            color: '#4DC6FF' },
  { tag: tags.null,            color: '#4DC6FF' },
  { tag: tags.modifier,        color: '#4DC6FF' },
  { tag: tags.annotation,      color: '#f0c060' },
]);

// ── Error line decoration ─────────────────────────────────────
const setErrorLineEffect = StateEffect.define();
const errorLineField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setErrorLineEffect)) continue;
      if (e.value == null) return Decoration.none;
      const n = Math.max(1, Math.min(e.value, tr.state.doc.lines));
      return Decoration.set([
        Decoration.line({ class: 'cm-error-line' }).range(tr.state.doc.line(n).from),
      ]);
    }
    return deco;
  },
  provide: f => EditorView.decorations.from(f),
});

// ── In-browser Java execution via transpiler + Web Worker ─────

// Worker source as a string — runs transpiled JS in an isolated thread
const WORKER_SRC = `
self.onmessage = function({ data: { js } }) {
  let __buf = '';
  function __println(x) { __buf += (x === null || x === undefined ? 'null' : String(x)) + '\\n'; }
  function __print(x)   { __buf += (x === null || x === undefined ? 'null' : String(x)); }
  try {
    const run = new Function('__println', '__print', 'Math', js);
    run(__println, __print, Math);
    self.postMessage({ stdout: __buf, stderr: '' });
  } catch (err) {
    self.postMessage({ stdout: __buf, stderr: err.toString() });
  }
};
`;

let _workerBlobUrl = null;
function workerUrl() {
  if (!_workerBlobUrl) {
    const blob = new Blob([WORKER_SRC], { type: 'text/javascript' });
    _workerBlobUrl = URL.createObjectURL(blob);
  }
  return _workerBlobUrl;
}

function runDirect(js) {
  let __buf = '';
  const __println = (x) => { __buf += (x === null || x === undefined ? 'null' : String(x)) + '\n'; };
  const __print   = (x) => { __buf += (x === null || x === undefined ? 'null' : String(x)); };
  try {
    new Function('__println', '__print', 'Math', js)(__println, __print, Math);
    return Promise.resolve({ stdout: __buf, stderr: '', code: 0 });
  } catch (err) {
    return Promise.resolve({ stdout: __buf, stderr: err.toString(), code: 1 });
  }
}

function normalize(s) {
  return String(s ?? '').replace(/\r\n/g, '\n').trim();
}

function runCode(javaCode) {
  let js;
  try {
    js = transpile(javaCode);
  } catch (err) {
    return Promise.resolve({ stdout: '', stderr: `Transpile error: ${err.message}`, code: 1 });
  }

  // Try Worker first (isolated thread, handles infinite loops via timeout).
  // Fall back to direct execution if blob Workers are unavailable.
  let worker;
  try {
    worker = new Worker(workerUrl());
  } catch {
    return runDirect(js);
  }

  return new Promise(resolve => {
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ stdout: '', stderr: 'Timed out — check for an infinite loop.', code: 1 });
    }, 10000);

    worker.onmessage = ({ data }) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ stdout: data.stdout, stderr: data.stderr, code: data.stderr ? 1 : 0 });
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      // Worker script error — fall back to direct execution
      runDirect(js).then(resolve);
    };

    worker.postMessage({ js });
  });
}

function parseRuntimeError(stderr) {
  if (!stderr) return { line: null, message: '' };
  if (stderr.includes('timed out') || stderr.includes('Timed out'))
    return { line: null, message: 'Execution timed out — check for an infinite loop.' };
  if (stderr.includes('is not defined')) {
    const m = stderr.match(/'?(\w+)'? is not defined/);
    return { line: null, message: m ? `'${m[1]}' is not defined — check your variable name or declaration.` : stderr };
  }
  if (stderr.includes('SyntaxError'))
    return { line: null, message: 'Syntax error — check for missing semicolons, braces, or parentheses.' };
  return { line: null, message: stderr.split('\n')[0] };
}

// LCS character-level diff
function charDiff(expected, actual) {
  const m = expected.length, n = actual.length;
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = expected[i-1] === actual[j-1]
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
  const out = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i-1] === actual[j-1]) {
      out.unshift({ text: actual[j-1], t: 'ok' }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      out.unshift({ text: actual[j-1], t: 'add' }); j--;
    } else {
      out.unshift({ text: expected[i-1], t: 'del' }); i--;
    }
  }
  return out;
}

function DiffView({ expected, actual }) {
  const chunks = charDiff(expected, actual);
  return (
    <span className="ce-diff">
      {chunks.map((c, i) =>
        c.t === 'ok'  ? <span key={i} className="ce-dc-ok">{c.text === '\n' ? '↵\n' : c.text}</span> :
        c.t === 'add' ? <span key={i} className="ce-dc-add">{c.text === '\n' ? '↵\n' : c.text}</span> :
                        <span key={i} className="ce-dc-del">{c.text === '\n' ? '↵' : c.text}</span>
      )}
    </span>
  );
}

// ── Test row ──────────────────────────────────────────────────
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
        {status === 'pass'    && <span className="ce-test-verdict">Passed</span>}
        {status === 'fail'    && <span className="ce-test-verdict ce-fail">Wrong answer</span>}
        {status === 'error'   && <span className="ce-test-verdict ce-fail">Error</span>}
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
                {result.error
                  ? result.error
                  : result.passed
                    ? result.actual || '(no output)'
                    : <DiffView expected={result.expected} actual={result.actual || ''} />
                }
              </pre>
            </div>
          )}
          {result?.stderr && !result.error && (
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

// ── Main component ────────────────────────────────────────────
export default function CodeEditor({ starterCode = '', testCases = [], hint = '' }) {
  const containerRef = useRef(null);
  const viewRef      = useRef(null);
  const codeRef      = useRef(starterCode);
  const runFnRef     = useRef(null);

  const [results,  setResults]  = useState([]);
  const [running,  setRunning]  = useState(false);
  const [runError, setRunError] = useState('');
  const [execMs,   setExecMs]   = useState(null);
  const [errBanner, setErrBanner] = useState('');

  // Build the editor once on mount
  useEffect(() => {
    const view = new EditorView({
      state: EditorState.create({
        doc: starterCode,
        extensions: [
          minimalSetup,
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          indentOnInput(),
          indentUnit.of('    '),
          EditorState.tabSize.of(4),
          bracketMatching(),
          closeBrackets(),
          java(),
          keymap.of([
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
            { key: 'Ctrl-Enter', mac: 'Cmd-Enter', run() { runFnRef.current?.(); return true; } },
          ]),
          cobraTheme,
          syntaxHighlighting(cobraHighlight),
          errorLineField,
          EditorView.updateListener.of(u => {
            if (u.docChanged) codeRef.current = u.state.doc.toString();
          }),
        ],
      }),
      parent: containerRef.current,
    });
    viewRef.current = view;
    return () => view.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearErrorLine = useCallback(() => {
    viewRef.current?.dispatch({ effects: setErrorLineEffect.of(null) });
    setErrBanner('');
  }, []);

  const highlightErrorLine = useCallback((line) => {
    if (line == null || !viewRef.current) return;
    viewRef.current.dispatch({ effects: setErrorLineEffect.of(line) });
    // Scroll to error line
    const doc = viewRef.current.state.doc;
    const n = Math.max(1, Math.min(line, doc.lines));
    viewRef.current.dispatch({
      selection: { anchor: doc.line(n).from },
      scrollIntoView: true,
    });
  }, []);

  const runAll = useCallback(async () => {
    const code = codeRef.current;
    clearErrorLine();
    setRunning(true);
    setRunError('');
    setResults(testCases.map(() => null));
    setExecMs(null);

    const t0 = performance.now();
    const next = [];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const { stdout, stderr, code: exitCode } = await runCode(code);

      if (exitCode !== 0 && !stdout) {
        const { line, message } = parseRuntimeError(stderr);
        if (line) highlightErrorLine(line);
        setErrBanner(message);
        next.push({ passed: false, error: message, stderr, actual: '' });
        setResults([...next, ...testCases.slice(i + 1).map(() => null)]);
        break;
      } else {
        const actual   = normalize(stdout);
        const expected = normalize(tc.expected);
        next.push({ passed: actual === expected, actual, expected, stderr });
      }
      setResults([...next, ...testCases.slice(i + 1).map(() => null)]);
    }

    setExecMs(Math.round(performance.now() - t0));
    setRunning(false);
  }, [testCases, clearErrorLine, highlightErrorLine]);

  // Keep runFnRef in sync so Ctrl+Enter always calls latest version
  runFnRef.current = runAll;

  const allPassed  = results.length > 0 && results.every(r => r?.passed);
  const anyRun     = results.length > 0;
  const passCount  = results.filter(r => r?.passed).length;

  return (
    <div className="ce-root">
      <div className="ce-head">
        <span className="ce-label">Code Editor</span>
        <span className="ce-lang">Java</span>
        <span className="ce-shortcut">Ctrl+Enter to run</span>
      </div>

      {errBanner && (
        <div className="ce-err-banner">
          <span className="ce-err-icon">!</span>
          {errBanner}
          <button className="ce-err-close" onClick={clearErrorLine}>✕</button>
        </div>
      )}

      <div className="ce-editor-wrap" ref={containerRef} />

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
        {execMs != null && !running && (
          <span className="ce-exec-time">{execMs} ms</span>
        )}
        {allPassed && <span className="ce-confetti">All tests passing!</span>}
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
