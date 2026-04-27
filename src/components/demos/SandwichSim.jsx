import { useState } from 'react';

// A deliberately literal robot. Each instruction does ONLY what it says.
// Students discover the gap between intent and instruction.

const AVAILABLE = [
  { id: 'pick-bread',   label: 'Pick up bread' },
  { id: 'unwrap-bread', label: 'Unwrap the bread' },
  { id: 'take-slices',  label: 'Take 2 slices' },
  { id: 'open-jar',     label: 'Open the peanut butter jar' },
  { id: 'pick-knife',   label: 'Pick up the knife' },
  { id: 'spread-pb',    label: 'Spread peanut butter on slice' },
  { id: 'close-sand',   label: 'Put slices together' },
];

export default function SandwichSim() {
  const [program, setProgram] = useState([]);
  const [output, setOutput] = useState([]);

  const run = () => {
    const log = [];
    const state = {
      hasLoaf: false, unwrapped: false, slices: 0,
      jarOpen: false, hasKnife: false, pbOnSlice: false, done: false,
    };

    for (const step of program) {
      switch (step.id) {
        case 'pick-bread':
          state.hasLoaf = true;
          log.push('🤖 Picks up the entire loaf — wrapper still on.');
          break;
        case 'unwrap-bread':
          if (!state.hasLoaf) { log.push('❌ No bread to unwrap. Robot stares at you.'); break; }
          state.unwrapped = true;
          log.push('🤖 Removes the wrapper.');
          break;
        case 'take-slices':
          if (!state.unwrapped) { log.push('❌ Tries to take slices through the wrapper. Wrapper now in sandwich.'); break; }
          state.slices = 2;
          log.push('🤖 Takes 2 slices.');
          break;
        case 'open-jar':
          state.jarOpen = true;
          log.push('🤖 Opens the peanut butter jar.');
          break;
        case 'pick-knife':
          state.hasKnife = true;
          log.push('🤖 Picks up the knife.');
          break;
        case 'spread-pb':
          if (!state.hasKnife) { log.push('❌ No knife. Robot uses its hand. Mess everywhere.'); break; }
          if (!state.jarOpen)  { log.push('❌ Jar still closed. Spreads air on bread.'); break; }
          if (state.slices < 1){ log.push('❌ No slices. Spreads on the counter.'); break; }
          state.pbOnSlice = true;
          log.push('🤖 Spreads peanut butter on a slice.');
          break;
        case 'close-sand':
          if (state.slices < 2)   { log.push('❌ Only one slice. Closes the sandwich on nothing.'); break; }
          if (!state.pbOnSlice)   { log.push('🤖 Closes two dry slices. Technically a sandwich.'); state.done = true; break; }
          state.done = true;
          log.push('✅ Closes the sandwich. Hands it to you. Done.');
          break;
      }
    }

    if (program.length === 0) log.push('🤖 No instructions. Robot stands still.');
    setOutput(log);
  };

  const add = (instr) => setProgram([...program, { ...instr, key: Date.now() + Math.random() }]);
  const removeAt = (i) => setProgram(program.filter((_, idx) => idx !== i));
  const reset = () => { setProgram([]); setOutput([]); };

  return (
    <div style={S.wrap}>
      <div style={S.cols}>
        <div style={S.col}>
          <h4 style={S.h4}>Available instructions</h4>
          <div style={S.chipList}>
            {AVAILABLE.map(i => (
              <button key={i.id} style={S.chip} onClick={() => add(i)}>+ {i.label}</button>
            ))}
          </div>
        </div>
        <div style={S.col}>
          <h4 style={S.h4}>Your program</h4>
          {program.length === 0 && <div style={S.empty}>Click instructions on the left to add them here.</div>}
          <ol style={S.programList}>
            {program.map((step, i) => (
              <li key={step.key} style={S.programItem}>
                <span>{step.label}</span>
                <button style={S.remove} onClick={() => removeAt(i)}>×</button>
              </li>
            ))}
          </ol>
          <div style={S.actions}>
            <button style={S.runBtn} onClick={run}>▶ Run program</button>
            <button style={S.resetBtn} onClick={reset}>Reset</button>
          </div>
        </div>
      </div>

      {output.length > 0 && (
        <div style={S.output}>
          <h4 style={S.h4}>What the robot did</h4>
          {output.map((line, i) => <div key={i} style={S.outLine}>{line}</div>)}
        </div>
      )}
    </div>
  );
}

const S = {
  wrap:    { border: '1px solid #1a2d42', background: '#0d1a26', padding: 20, fontFamily: 'system-ui, sans-serif' },
  cols:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  col:     { display: 'flex', flexDirection: 'column' },
  h4:      { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8ca5be', marginBottom: 12, fontFamily: 'monospace' },
  chipList:{ display: 'flex', flexDirection: 'column', gap: 6 },
  chip:    { textAlign: 'left', padding: '8px 12px', background: 'transparent', border: '1px solid #2a425c', color: '#f0f7ff', fontSize: 13, cursor: 'pointer' },
  empty:   { color: '#4a6178', fontStyle: 'italic', fontSize: 13, padding: 12, border: '1px dashed #2a425c' },
  programList: { listStyle: 'decimal inside', padding: 0, margin: 0, color: '#f0f7ff', fontSize: 13 },
  programItem: { padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a2d42' },
  remove:  { background: 'transparent', border: 'none', color: '#ff6b8a', cursor: 'pointer', fontSize: 16 },
  actions: { display: 'flex', gap: 8, marginTop: 12 },
  runBtn:  { flex: 1, padding: 10, background: '#4dc6ff', border: 'none', color: '#03131f', fontWeight: 700, cursor: 'pointer', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' },
  resetBtn:{ padding: '10px 16px', background: 'transparent', border: '1px solid #2a425c', color: '#8ca5be', cursor: 'pointer', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em' },
  output:  { marginTop: 20, padding: 16, background: '#03131f', border: '1px solid #1a2d42' },
  outLine: { color: '#f0f7ff', fontSize: 13, padding: '4px 0', fontFamily: 'monospace' },
};
