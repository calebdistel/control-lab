import { useState, useEffect, useRef, useCallback } from 'react';
import { EditorView, minimalSetup } from 'codemirror';
import { EditorState, indentUnit } from '@codemirror/state';
import { keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, historyKeymap, indentWithTab, history } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { java } from '@codemirror/lang-java';
import { tags } from '@lezer/highlight';
import { transpile } from '../../lib/javaTranspiler.js';

// ── CobraLink theme ───────────────────────────────────────────
const cobraTheme = EditorView.theme({
  '&': { background: '#07101a', color: '#c9d1d9', fontSize: '0.845rem',
         fontFamily: '"JetBrains Mono","Fira Mono","Courier New",monospace' },
  '.cm-scroller': { lineHeight: '1.65', fontFamily: 'inherit' },
  '.cm-content': { padding: '0.75rem 0', caretColor: '#4DC6FF' },
  '.cm-cursor': { borderLeftColor: '#4DC6FF', borderLeftWidth: '2px' },
  '.cm-activeLine': { background: 'rgba(77,198,255,0.055)' },
  '.cm-activeLineGutter': { background: 'rgba(77,198,255,0.055)', color: '#4DC6FF' },
  '.cm-gutters': { background: '#07101a', borderRight: '1px solid rgba(61,90,128,0.28)',
                   color: '#2d4560', minWidth: '2.8em' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 0.6em 0 0.4em' },
  '.cm-selectionBackground': { background: 'rgba(77,198,255,0.18) !important' },
  '&.cm-focused .cm-selectionBackground': { background: 'rgba(77,198,255,0.22) !important' },
  '.cm-matchingBracket': { color: '#4DC6FF !important', fontWeight: 'bold' },
}, { dark: true });

const cobraHighlight = HighlightStyle.define([
  { tag: tags.keyword,    color: '#4DC6FF' },
  { tag: tags.string,     color: '#90d090' },
  { tag: tags.comment,    color: '#3D5A80', fontStyle: 'italic' },
  { tag: tags.number,     color: '#ff9870' },
  { tag: tags.typeName,   color: '#7ecfff' },
  { tag: tags.className,  color: '#7ecfff' },
  { tag: tags.variableName, color: '#c9d1d9' },
  { tag: tags.propertyName, color: '#a0c8ff' },
  { tag: tags.function(tags.variableName), color: '#a0c8ff' },
  { tag: tags.function(tags.propertyName), color: '#a0c8ff' },
  { tag: tags.operator,   color: '#8dbddd' },
  { tag: tags.punctuation,color: '#8dbddd' },
  { tag: tags.bool,       color: '#4DC6FF' },
  { tag: tags.modifier,   color: '#4DC6FF' },
]);

// ── Physics worker ────────────────────────────────────────────
const SIM_WORKER_SRC = `
function initState(sim) {
  if (sim.type === 'flywheel') return { rpm: sim.initialRPM || 0 };
  if (sim.type === 'arm') {
    const r = (sim.initialDeg !== undefined ? sim.initialDeg : (sim.minDeg || 0)) * Math.PI / 180;
    return { angleRad: r, velocityRad: 0 };
  }
  if (sim.type === 'elevator') return { positionM: sim.initialM || 0, velocityMPS: 0 };
  return {};
}

function stepPhysics(sim, state, v, dt) {
  if (sim.type === 'flywheel') {
    const freeRPM = sim.freeRPM || 6380;
    const tau     = sim.timeConstant || 0.3;
    const target  = v > 0 ? v * freeRPM / 12 : 0;
    const a = Math.exp(-dt / tau);
    return { rpm: target * (1 - a) + state.rpm * a };
  }
  if (sim.type === 'arm') {
    const kV = sim.kV !== undefined ? sim.kV : 1.5;
    const kA = sim.kA !== undefined ? sim.kA : 0.07;
    const kG = sim.kG !== undefined ? sim.kG : 0.65;
    const g  = kG * Math.cos(state.angleRad);
    const al = (v - kV * state.velocityRad - g) / kA;
    let vel  = state.velocityRad + al * dt;
    let ang  = state.angleRad   + vel * dt;
    const lo = (sim.minDeg !== undefined ? sim.minDeg : -20) * Math.PI / 180;
    const hi = (sim.maxDeg !== undefined ? sim.maxDeg : 180) * Math.PI / 180;
    if (ang <= lo) { ang = lo; vel = Math.max(0, vel); }
    if (ang >= hi) { ang = hi; vel = Math.min(0, vel); }
    return { angleRad: ang, velocityRad: vel };
  }
  if (sim.type === 'elevator') {
    const kV = sim.kV !== undefined ? sim.kV : 2.8;
    const kA = sim.kA !== undefined ? sim.kA : 0.12;
    const kG = sim.kG !== undefined ? sim.kG : 0.7;
    const ac = (v - kV * state.velocityMPS - kG) / kA;
    let vel  = state.velocityMPS + ac * dt;
    let pos  = state.positionM   + vel * dt;
    const lo = sim.minM !== undefined ? sim.minM : 0;
    const hi = sim.maxM !== undefined ? sim.maxM : 1.5;
    if (pos <= lo) { pos = lo; vel = Math.max(0, vel); }
    if (pos >= hi) { pos = hi; vel = Math.min(0, vel); }
    return { positionM: pos, velocityMPS: vel };
  }
  return state;
}

self.onmessage = function({ data: { js, sim } }) {
  let buf = '', tel = [], simT = 0;
  function __println(x) { buf += (x == null ? 'null' : String(x)) + '\\n'; }
  function __print(x)   { buf += (x == null ? 'null' : String(x)); }
  function __telNum(k, v)  { tel.push({ k, v: +v,        t: simT }); }
  function __telBool(k, v) { tel.push({ k, v: !!v,       t: simT }); }
  function __telStr(k, v)  { tel.push({ k, v: String(v), t: simT }); }

  const ExtMath = Object.assign(Object.create(Math), {
    toRadians: d => d * Math.PI / 180,
    toDegrees: r => r * 180 / Math.PI,
    signum:    x => Math.sign(x),
  });

  let state   = initState(sim);
  let voltage = 0;
  function getRPM()             { return state.rpm          != null ? state.rpm          : 0; }
  function getVelocityRPM()     { return state.rpm          != null ? state.rpm          : 0; }
  function getAngleDeg()        { return state.angleRad     != null ? state.angleRad * 180 / Math.PI : 0; }
  function getAngleRad()        { return state.angleRad     != null ? state.angleRad     : 0; }
  function getAngularVelocity() { return state.velocityRad  != null ? state.velocityRad  : 0; }
  function getPositionMeters()  { return state.positionM    != null ? state.positionM    : 0; }
  function getPositionInches()  { return state.positionM    != null ? state.positionM * 39.3701 : 0; }
  function getVelocityMPS()     { return state.velocityMPS  != null ? state.velocityMPS  : 0; }
  function getTimeSecs()        { return simT; }
  function setVoltage(v)        { voltage = Math.max(-12, Math.min(12, +v || 0)); }
  function setSpeed(s)          { voltage = Math.max(-1,  Math.min( 1, +s || 0)) * 12; }

  const _n = ['__println','__print','Math','__telNum','__telBool','__telStr',
    'getRPM','getVelocityRPM','getAngleDeg','getAngleRad','getAngularVelocity',
    'getPositionMeters','getPositionInches','getVelocityMPS','getTimeSecs','setVoltage','setSpeed'];
  const _v = [__println,__print,ExtMath,__telNum,__telBool,__telStr,
    getRPM,getVelocityRPM,getAngleDeg,getAngleRad,getAngularVelocity,
    getPositionMeters,getPositionInches,getVelocityMPS,getTimeSecs,setVoltage,setSpeed];

  try {
    const src = js + '\\nreturn typeof periodic !== "undefined" ? periodic : null;';
    const fn  = new Function(..._n, src)(..._v);
    if (!fn) {
      self.postMessage({ stdout: '', stderr: 'Define a periodic() method in your class.', telemetry: [], simHistory: [] });
      return;
    }
    const dt = sim.dt || 0.02, steps = sim.steps || 250;
    const history = [];
    for (let i = 0; i < steps; i++) {
      simT    = +(i * dt).toFixed(4);
      voltage = 0;
      fn();
      state = Object.assign({}, state, stepPhysics(sim, state, voltage, dt));
      const snap = { t: simT, v: +voltage.toFixed(3) };
      if (sim.type === 'flywheel') snap.rpm = +state.rpm.toFixed(1);
      if (sim.type === 'arm')      snap.deg = +(state.angleRad * 180 / Math.PI).toFixed(2);
      if (sim.type === 'elevator') snap.pos = +state.positionM.toFixed(4);
      history.push(snap);
    }
    self.postMessage({ stdout: buf, stderr: '', telemetry: tel, simHistory: history });
  } catch(e) {
    self.postMessage({ stdout: buf, stderr: e.toString(), telemetry: [], simHistory: [] });
  }
};
`;

let _simWorkerUrl = null;
function simWorkerUrl() {
  if (!_simWorkerUrl) {
    _simWorkerUrl = URL.createObjectURL(new Blob([SIM_WORKER_SRC], { type: 'text/javascript' }));
  }
  return _simWorkerUrl;
}

// ── Sim defaults + starter code ───────────────────────────────
const DEFAULTS = {
  flywheel: { freeRPM: 6380, timeConstant: 0.3, steps: 250, dt: 0.02 },
  arm:      { kV: 1.5, kA: 0.07, kG: 0.65, minDeg: -20, maxDeg: 180, initialDeg: -20, steps: 250, dt: 0.02 },
  elevator: { kV: 2.8, kA: 0.12, kG: 0.7,  minM: 0, maxM: 1.5, initialM: 0, steps: 250, dt: 0.02 },
};

const DEFAULT_CODE = {
  flywheel: `public class FlywheelController {
    // kV = 12V / freeRPM ≈ 0.00188 for a NEO
    static double kV = 0.00188;
    static double kP = 0.0003;
    static double setpointRPM = 4000.0;

    public static void periodic() {
        double rpm   = getRPM();
        double error = setpointRPM - rpm;
        double voltage = kV * setpointRPM + kP * error;
        setVoltage(voltage);

        SmartDashboard.putNumber("rpm",      rpm);
        SmartDashboard.putNumber("setpoint", setpointRPM);
        SmartDashboard.putNumber("error",    error);
        SmartDashboard.putNumber("voltage",  voltage);
    }
}`,
  arm: `public class ArmController {
    // Gravity feedforward: kG * cos(angle) holds the arm still
    static double kG = 0.65;
    static double kP = 3.5;
    static double setpointDeg = 60.0;

    public static void periodic() {
        double deg   = getAngleDeg();
        double error = setpointDeg - deg;

        double gravity = kG * Math.cos(deg * Math.PI / 180.0);
        double voltage = gravity + kP * (error * Math.PI / 180.0);
        setVoltage(voltage);

        SmartDashboard.putNumber("angle",    deg);
        SmartDashboard.putNumber("setpoint", setpointDeg);
        SmartDashboard.putNumber("error",    error);
        SmartDashboard.putNumber("voltage",  voltage);
    }
}`,
  elevator: `public class ElevatorController {
    // kG compensates gravity; kP drives to setpoint
    static double kG = 0.7;
    static double kP = 8.0;
    static double setpointM = 1.0;

    public static void periodic() {
        double pos   = getPositionMeters();
        double error = setpointM - pos;
        double voltage = kG + kP * error;
        setVoltage(voltage);

        SmartDashboard.putNumber("position", pos);
        SmartDashboard.putNumber("setpoint", setpointM);
        SmartDashboard.putNumber("error",    error);
        SmartDashboard.putNumber("voltage",  voltage);
    }
}`,
};

// ── SVG helpers ───────────────────────────────────────────────
function arcPath(cx, cy, r, startDeg, sweepDeg) {
  if (Math.abs(sweepDeg) < 0.5) return '';
  const cap = Math.min(sweepDeg, 359.9);
  const toRad = d => (d - 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(startDeg + cap));
  const y2 = cy + r * Math.sin(toRad(startDeg + cap));
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${cap > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

// ── Mechanism visualizations ──────────────────────────────────
function FlywheelViz({ rpm, spindleAngle, maxRPM }) {
  const frac = Math.max(0, Math.min(0.999, Math.abs(rpm) / (maxRPM || 6380)));
  const spokes = [0, 60, 120, 180, 240, 300].map(a => {
    const r = (a + spindleAngle) * Math.PI / 180;
    return [100 + 58 * Math.cos(r), 90 + 58 * Math.sin(r)];
  });
  return (
    <svg viewBox="0 0 200 215" style={{ width: '100%', display: 'block' }}>
      <rect width="200" height="215" fill="#07101a" rx="8" />
      <circle cx="100" cy="90" r="70" fill="none" stroke="#162736" strokeWidth="8" />
      {frac > 0.005 && (
        <path d={arcPath(100, 90, 68, -90, 360 * frac)}
          fill="none" stroke="#4DC6FF" strokeWidth="5" strokeLinecap="round" opacity="0.75" />
      )}
      {spokes.map(([x2, y2], i) => (
        <line key={i} x1="100" y1="90" x2={x2.toFixed(1)} y2={y2.toFixed(1)}
          stroke="#1a4a6a" strokeWidth="3.5" strokeLinecap="round" />
      ))}
      <circle cx="100" cy="90" r="11" fill="#0d1f2d" stroke="#4DC6FF" strokeWidth="1.5" />
      <circle cx="100" cy="90" r="4"  fill="#4DC6FF" />
      <text x="100" y="177" textAnchor="middle" fill="#4DC6FF" fontSize="16" fontFamily="monospace" fontWeight="bold">
        {rpm.toFixed(0)} RPM
      </text>
      <text x="100" y="195" textAnchor="middle" fill="#2d4560" fontSize="10" fontFamily="monospace">
        max {(maxRPM || 6380).toFixed(0)} RPM
      </text>
      <text x="100" y="210" textAnchor="middle" fill="#2d4560" fontSize="9" fontFamily="monospace">
        {(frac * 100).toFixed(0)}%
      </text>
    </svg>
  );
}

function ArmViz({ angleDeg, setpointDeg }) {
  const L = 60;
  const px = 100, py = 135;
  const r  = angleDeg  * Math.PI / 180;
  const ex = px + L * Math.cos(r), ey = py - L * Math.sin(r);
  const showSp = setpointDeg !== undefined && Math.abs(setpointDeg - angleDeg) > 1;
  const sr  = showSp ? setpointDeg * Math.PI / 180 : 0;
  const spx = showSp ? px + L * Math.cos(sr) : 0;
  const spy = showSp ? py - L * Math.sin(sr)  : 0;
  const arcSweep = Math.min(Math.abs(angleDeg), 359.9);
  const arcDir   = angleDeg >= 0 ? 0 : 1;
  const arcRad   = 28;
  const ax2 = px + arcRad * Math.cos(r), ay2 = py - arcRad * Math.sin(r);
  const arcD = arcSweep > 0.5
    ? `M${px + arcRad} ${py} A${arcRad} ${arcRad} 0 ${arcSweep > 180 ? 1 : 0} ${arcDir} ${ax2.toFixed(1)} ${ay2.toFixed(1)}`
    : '';
  return (
    <svg viewBox="0 0 200 185" style={{ width: '100%', display: 'block' }}>
      <rect width="200" height="185" fill="#07101a" rx="8" />
      <line x1="20" y1="150" x2="180" y2="150" stroke="#162736" strokeWidth="2" />
      <rect x="88" y="135" width="24" height="15" rx="2" fill="#0d1f2d" />
      {arcD && (
        <path d={arcD} fill="none" stroke="#4DC6FF" strokeWidth="1.5" opacity="0.35" />
      )}
      {showSp && (
        <>
          <line x1={px} y1={py} x2={spx.toFixed(1)} y2={spy.toFixed(1)}
            stroke="#5df5a0" strokeWidth="4" strokeLinecap="round" opacity="0.25" />
          <circle cx={spx.toFixed(1)} cy={spy.toFixed(1)} r="7"
            fill="none" stroke="#5df5a0" strokeWidth="1.5" opacity="0.5" />
        </>
      )}
      <line x1={px} y1={py} x2={ex.toFixed(1)} y2={ey.toFixed(1)}
        stroke="#1a4a6a" strokeWidth="8" strokeLinecap="round" />
      <line x1={px} y1={py} x2={ex.toFixed(1)} y2={ey.toFixed(1)}
        stroke="#4DC6FF" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
      <circle cx={ex.toFixed(1)} cy={ey.toFixed(1)} r="9" fill="#0d1f2d" stroke="#4DC6FF" strokeWidth="2" />
      <circle cx={px} cy={py} r="7" fill="#07101a" stroke="#4DC6FF" strokeWidth="2" />
      <circle cx={px} cy={py} r="3" fill="#4DC6FF" />
      <text x="100" y="170" textAnchor="middle" fill="#4DC6FF" fontSize="15" fontFamily="monospace" fontWeight="bold">
        {angleDeg.toFixed(1)}°
      </text>
      {showSp && (
        <text x="100" y="182" textAnchor="middle" fill="#5df5a0" fontSize="10" fontFamily="monospace">
          → {setpointDeg.toFixed(1)}°
        </text>
      )}
    </svg>
  );
}

function ElevatorViz({ positionM, setpointM, maxM }) {
  const rTop = 18, rBot = 155, rH = rBot - rTop, carH = 28;
  const frac  = Math.max(0, Math.min(1, positionM / (maxM || 1.5)));
  const carY  = rBot - frac * rH - carH;
  const spFrac = setpointM !== undefined ? Math.max(0, Math.min(1, setpointM / (maxM || 1.5))) : null;
  const spY    = spFrac !== null ? rBot - spFrac * rH : null;
  return (
    <svg viewBox="0 0 200 195" style={{ width: '100%', display: 'block' }}>
      <rect width="200" height="195" fill="#07101a" rx="8" />
      {[0.25, 0.5, 0.75].map((f, i) => (
        <line key={i} x1="68" y1={rTop + f * rH} x2="132" y2={rTop + f * rH}
          stroke="#0f1e2b" strokeWidth="1.5" />
      ))}
      <line x1="68"  y1={rTop} x2="68"  y2={rBot} stroke="#162736" strokeWidth="6" />
      <line x1="132" y1={rTop} x2="132" y2={rBot} stroke="#162736" strokeWidth="6" />
      <line x1="48"  y1={rBot} x2="152" y2={rBot} stroke="#162736" strokeWidth="2" />
      {spY !== null && (
        <line x1="55" y1={spY} x2="145" y2={spY}
          stroke="#5df5a0" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.6" />
      )}
      <rect x="61" y={carY.toFixed(1)} width="78" height={carH} rx="5"
        fill="#0d1f2d" stroke="#4DC6FF" strokeWidth="1.5" />
      <line x1="73" y1={(carY + carH / 2).toFixed(1)} x2="127" y2={(carY + carH / 2).toFixed(1)}
        stroke="#4DC6FF" strokeWidth="1" opacity="0.3" />
      <text x="100" y="178" textAnchor="middle" fill="#4DC6FF" fontSize="15" fontFamily="monospace" fontWeight="bold">
        {positionM.toFixed(3)} m
      </text>
      {setpointM !== undefined && (
        <text x="100" y="191" textAnchor="middle" fill="#5df5a0" fontSize="10" fontFamily="monospace">
          → {setpointM.toFixed(3)} m
        </text>
      )}
    </svg>
  );
}

// ── Canvas time-series plot ───────────────────────────────────
function drawPlot(canvas, simHistory, telemetry, simType, playbackIdx) {
  if (!canvas || !simHistory.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#07101a'; ctx.fillRect(0, 0, W, H);

  const P = { t: 10, r: 12, b: 26, l: 48 };
  const pw = W - P.l - P.r, ph = H - P.t - P.b;

  const mk = simType === 'flywheel' ? 'rpm' : simType === 'arm' ? 'deg' : 'pos';
  const vals  = simHistory.map(s => s[mk]);
  const tMax  = simHistory[simHistory.length - 1].t || 1;

  const spKey = [...new Set(telemetry.filter(e => e.k.toLowerCase().includes('setpoint')).map(e => e.k))][0];
  const spData = spKey ? telemetry.filter(e => e.k === spKey) : null;

  const allV = [...vals, ...(spData ? spData.map(e => e.v) : [])];
  let yLo = Math.min(...allV), yHi = Math.max(...allV);
  if (yHi - yLo < 1) { yLo -= 0.5; yHi += 0.5; }
  const pad = (yHi - yLo) * 0.08; yLo -= pad; yHi += pad;

  const sx = t => P.l + (t / tMax) * pw;
  const sy = v => P.t + (1 - (v - yLo) / (yHi - yLo)) * ph;

  // Grid
  ctx.strokeStyle = '#0d1e2c'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = P.t + (i / 4) * ph;
    ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(P.l + pw, y); ctx.stroke();
  }
  for (let i = 0; i <= 5; i++) {
    const x = P.l + (i / 5) * pw;
    ctx.beginPath(); ctx.moveTo(x, P.t); ctx.lineTo(x, P.t + ph); ctx.stroke();
  }

  // Axis labels
  ctx.fillStyle = '#2d4560'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = yHi - (i / 4) * (yHi - yLo);
    ctx.fillText(v.toFixed(0), P.l - 4, P.t + (i / 4) * ph + 4);
  }
  ctx.textAlign = 'center';
  for (let i = 0; i <= 5; i++) {
    ctx.fillText(((i / 5) * tMax).toFixed(1) + 's', P.l + (i / 5) * pw, H - 4);
  }

  // Voltage shading
  ctx.fillStyle = 'rgba(168,140,255,0.07)';
  ctx.beginPath();
  simHistory.forEach((s, i) => {
    const x = sx(s.t), fv = (s.v + 12) / 24;
    const yV = P.t + (1 - fv) * ph;
    if (i === 0) { ctx.moveTo(x, P.t + ph); ctx.lineTo(x, yV); }
    else ctx.lineTo(x, yV);
  });
  ctx.lineTo(sx(tMax), P.t + ph); ctx.closePath(); ctx.fill();

  // Setpoint (green dashed)
  if (spData && spData.length > 1) {
    ctx.strokeStyle = '#5df5a0'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    spData.forEach((p, i) => { const x = sx(p.t), y = sy(p.v); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]);
  }

  // Actual value (accent blue)
  ctx.strokeStyle = '#4DC6FF'; ctx.lineWidth = 2;
  ctx.beginPath();
  simHistory.forEach((s, i) => { const x = sx(s.t), y = sy(s[mk]); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
  ctx.stroke();

  // Playback cursor
  if (playbackIdx != null && playbackIdx < simHistory.length) {
    const x = sx(simHistory[playbackIdx].t);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(x, P.t); ctx.lineTo(x, P.t + ph); ctx.stroke(); ctx.setLineDash([]);
  }

  // Legend
  ctx.font = '10px monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = '#4DC6FF';  ctx.fillText('● actual', P.l + 4, P.t + 12);
  if (spData) { ctx.fillStyle = '#5df5a0'; ctx.fillText('- - setpoint', P.l + 64, P.t + 12); }
  ctx.fillStyle = 'rgba(168,140,255,0.6)'; ctx.fillText('▓ voltage', P.l + (spData ? 158 : 64), P.t + 12);
}

// ── Telemetry panel ───────────────────────────────────────────
function Sparkline({ values }) {
  if (!values || values.length < 2) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const range = Math.max(hi - lo, 0.001);
  const W = 72, H = 22;
  const pts = values.map((v, i) =>
    `${((i / (values.length - 1)) * W).toFixed(1)},${(H - ((v - lo) / range) * H).toFixed(1)}`
  ).join(' ');
  return (
    <svg width={W} height={H} style={{ display: 'block', flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke="#4DC6FF" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function TelemetryPanel({ telemetry, simHistory, playbackIdx }) {
  if (!telemetry.length) return null;
  const currentT = simHistory[playbackIdx]?.t ?? 0;
  const keys = [...new Set(telemetry.map(e => e.k))];

  return (
    <div style={{ borderTop: '1px solid rgba(61,90,128,0.3)', background: '#040e17' }}>
      <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: '1px solid rgba(61,90,128,0.2)' }}>
        <span style={{ fontFamily: 'Audiowide,Kanit,sans-serif', fontSize: '0.6rem',
                       letterSpacing: '0.15em', textTransform: 'uppercase', color: '#2d4560' }}>
          Telemetry
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem',
                        fontFamily: 'monospace' }}>
          <tbody>
            {keys.map(key => {
              const entries = telemetry.filter(e => e.k === key);
              const current = entries.filter(e => e.t <= currentT + 0.001);
              const curVal  = current.length ? current[current.length - 1].v : entries[0]?.v;
              // Downsample to ~40 sparkline points
              const step = Math.max(1, Math.floor(entries.length / 40));
              const sparkVals = entries.filter((_, i) => i % step === 0).map(e => e.v);
              const isNum = typeof curVal === 'number';
              return (
                <tr key={key} style={{ borderBottom: '1px solid rgba(61,90,128,0.12)' }}>
                  <td style={{ padding: '5px 12px', color: '#7ecfff', whiteSpace: 'nowrap', maxWidth: 160,
                                overflow: 'hidden', textOverflow: 'ellipsis' }}>{key}</td>
                  <td style={{ padding: '5px 8px', color: '#c9d1d9', textAlign: 'right',
                                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', width: 90 }}>
                    {isNum ? curVal.toFixed(3) : String(curVal)}
                  </td>
                  <td style={{ padding: '5px 12px 5px 4px' }}>
                    {isNum && <Sparkline values={sparkVals} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function RobotSimEditor({ type = 'flywheel', sim: simOverrides = {}, starterCode, hint }) {
  const sim     = { ...DEFAULTS[type] || DEFAULTS.flywheel, type, ...simOverrides };
  const initCode = starterCode || DEFAULT_CODE[type] || DEFAULT_CODE.flywheel;

  const editorRef    = useRef(null);
  const viewRef      = useRef(null);
  const codeRef      = useRef(initCode);
  const runFnRef     = useRef(null);
  const plotRef      = useRef(null);
  const animRef      = useRef(null);

  const [running,     setRunning]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [playbackIdx, setPlaybackIdx] = useState(0);
  const [vizFrame,    setVizFrame]    = useState(null); // { value, spValue, spindleAngle }

  // Build CodeMirror
  useEffect(() => {
    const view = new EditorView({
      state: EditorState.create({
        doc: initCode,
        extensions: [
          minimalSetup, lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(),
          history(), indentOnInput(), bracketMatching(), closeBrackets(),
          indentUnit.of('    '), EditorState.tabSize.of(4), java(),
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap,
            { key: 'Ctrl-Enter', mac: 'Cmd-Enter', run() { runFnRef.current?.(); return true; } }]),
          cobraTheme, syntaxHighlighting(cobraHighlight),
          EditorView.updateListener.of(u => { if (u.docChanged) codeRef.current = u.state.doc.toString(); }),
        ],
      }),
      parent: editorRef.current,
    });
    viewRef.current = view;
    return () => view.destroy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate results after run
  useEffect(() => {
    if (!result?.simHistory?.length) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const hist = result.simHistory;
    const dt   = hist[1] ? hist[1].t - hist[0].t : sim.dt;
    // Pre-compute flywheel spindle angle
    const spindleAngles = [];
    let accAngle = 0;
    for (const s of hist) {
      accAngle += ((s.rpm || 0) / 60) * 360 * dt;
      spindleAngles.push(accAngle);
    }

    const duration = hist[hist.length - 1].t * 1000;
    let startTs = null;

    const frame = (ts) => {
      if (!startTs) startTs = ts;
      const pct = Math.min(1, (ts - startTs) / duration);
      const idx = Math.min(Math.floor(pct * hist.length), hist.length - 1);
      setPlaybackIdx(idx);

      const snap = hist[idx];
      // Find setpoint from telemetry at this time
      const spKey = [...new Set(
        result.telemetry.filter(e => e.k.toLowerCase().includes('setpoint')).map(e => e.k)
      )][0];
      const spEntries = spKey ? result.telemetry.filter(e => e.k === spKey && e.t <= snap.t) : [];
      const spVal = spEntries.length ? spEntries[spEntries.length - 1].v : undefined;

      setVizFrame({
        value: snap.rpm ?? snap.deg ?? snap.pos ?? 0,
        spValue: spVal,
        spindleAngle: spindleAngles[idx] || 0,
      });

      if (pct < 1) {
        animRef.current = requestAnimationFrame(frame);
      }
    };

    animRef.current = requestAnimationFrame(frame);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Redraw plot when playback changes
  useEffect(() => {
    if (result?.simHistory?.length) {
      drawPlot(plotRef.current, result.simHistory, result.telemetry, type, playbackIdx);
    }
  }, [result, playbackIdx, type]);

  const runSim = useCallback(() => {
    let js;
    try {
      // Strip main() call added by transpiler — sim uses periodic() instead
      js = transpile(codeRef.current).replace(/\nmain\(\);\n$/, '');
    } catch (e) {
      setResult({ stdout: '', stderr: `Transpile error: ${e.message}`, telemetry: [], simHistory: [] });
      return;
    }

    setRunning(true);
    setResult(null);
    setPlaybackIdx(0);
    setVizFrame(null);

    let worker;
    try { worker = new Worker(simWorkerUrl()); }
    catch {
      setRunning(false);
      setResult({ stdout: '', stderr: 'Web Workers unavailable in this browser.', telemetry: [], simHistory: [] });
      return;
    }

    const timer = setTimeout(() => {
      worker.terminate();
      setRunning(false);
      setResult({ stdout: '', stderr: 'Simulation timed out — check for an infinite loop.', telemetry: [], simHistory: [] });
    }, 15000);

    worker.onmessage = ({ data }) => {
      clearTimeout(timer);
      worker.terminate();
      setResult(data);
      setRunning(false);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      setResult({ stdout: '', stderr: e.message || 'Worker error', telemetry: [], simHistory: [] });
      setRunning(false);
    };

    worker.postMessage({ js, sim });
  }, [sim]);

  runFnRef.current = runSim;

  const typeName = type === 'flywheel' ? 'Flywheel' : type === 'arm' ? 'Arm' : 'Elevator';
  const hasResult = result && !running;
  const hist = result?.simHistory || [];

  const currentValue = vizFrame?.value ?? 0;
  const currentSp    = vizFrame?.spValue;

  return (
    <div className="rse-root">
      <style>{RSE_CSS}</style>

      <div className="rse-header">
        <span className="rse-title">⚙ Robot Sim</span>
        <span className="rse-badge">{typeName}</span>
        <button className={`rse-run${running ? ' rse-running' : ''}`}
          onClick={runSim} disabled={running}>
          {running ? '⏳ Running…' : '▶ Run Simulation'}
        </button>
        <span className="rse-shortcut">Ctrl+Enter</span>
      </div>

      <div className="rse-body">
        <div className="rse-editor-col">
          <div className="rse-editor-wrap" ref={editorRef} />
        </div>

        <div className="rse-viz-col">
          <div className="rse-viz-box">
            {type === 'flywheel' && (
              <FlywheelViz rpm={currentValue} spindleAngle={vizFrame?.spindleAngle || 0} maxRPM={sim.freeRPM} />
            )}
            {type === 'arm' && (
              <ArmViz angleDeg={currentValue} setpointDeg={currentSp} />
            )}
            {type === 'elevator' && (
              <ElevatorViz positionM={currentValue} setpointM={currentSp} maxM={sim.maxM} />
            )}
            {!hasResult && (
              <div className="rse-viz-overlay">
                <span>Press Run to simulate</span>
              </div>
            )}
          </div>

          <div className="rse-plot-box">
            <canvas ref={plotRef} width={380} height={150}
              style={{ width: '100%', height: 150, display: 'block' }} />
            {!hasResult && (
              <div className="rse-plot-empty">time series plot</div>
            )}
          </div>

          {hasResult && result.telemetry.length > 0 && (
            <TelemetryPanel telemetry={result.telemetry} simHistory={hist} playbackIdx={playbackIdx} />
          )}
        </div>
      </div>

      {hasResult && result.stderr && (
        <div className="rse-error">
          <span className="rse-error-icon">!</span>
          <pre className="rse-error-msg">{result.stderr}</pre>
        </div>
      )}

      {hint && (
        <details className="rse-hint">
          <summary>Stuck? Show hint</summary>
          <p className="rse-hint-body">{hint}</p>
        </details>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const RSE_CSS = `
.rse-root {
  border: 1px solid rgba(61,90,128,0.35);
  border-radius: 10px;
  background: #07101a;
  overflow: hidden;
  margin: 2rem 0;
  font-family: "Kanit", sans-serif;
}

.rse-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.6rem 1rem;
  background: rgba(0,0,0,0.35);
  border-bottom: 1px solid rgba(61,90,128,0.3);
  flex-wrap: wrap;
}
.rse-title {
  font-family: "Audiowide","Kanit",sans-serif;
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #4DC6FF;
}
.rse-badge {
  font-family: "Kanit",sans-serif;
  font-size: 0.7rem;
  background: rgba(77,198,255,0.12);
  color: #4DC6FF;
  border: 1px solid rgba(77,198,255,0.25);
  border-radius: 4px;
  padding: 0.15em 0.55em;
}
.rse-run {
  margin-left: auto;
  padding: 0.38em 1.1em;
  border-radius: 6px;
  background: #4DC6FF;
  color: #04141e;
  font-family: "Kanit",sans-serif;
  font-size: 0.82rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: filter 0.15s, transform 0.1s;
}
.rse-run:hover:not(:disabled) { filter: brightness(1.12); }
.rse-run:active:not(:disabled) { transform: translateY(1px); }
.rse-run:disabled { opacity: 0.6; cursor: default; }
.rse-running { background: rgba(77,198,255,0.3); color: #4DC6FF; }
.rse-shortcut {
  font-size: 0.68rem;
  color: #2d4560;
  font-family: "Audiowide","Kanit",monospace;
}

.rse-body {
  display: grid;
  grid-template-columns: 1fr 260px;
  min-height: 320px;
}
@media (max-width: 660px) {
  .rse-body { grid-template-columns: 1fr; }
}

.rse-editor-col {
  border-right: 1px solid rgba(61,90,128,0.25);
}
.rse-editor-wrap .cm-editor {
  height: 100%;
  min-height: 280px;
}
.rse-editor-wrap { height: 100%; }

.rse-viz-col {
  display: flex;
  flex-direction: column;
  background: #040e17;
  overflow: hidden;
}

.rse-viz-box {
  position: relative;
  padding: 10px 14px 6px;
  border-bottom: 1px solid rgba(61,90,128,0.2);
  flex-shrink: 0;
}
.rse-viz-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #2d4560;
  font-style: italic;
  background: rgba(4,14,23,0.7);
  pointer-events: none;
}

.rse-plot-box {
  position: relative;
  padding: 6px;
  border-bottom: 1px solid rgba(61,90,128,0.2);
  flex-shrink: 0;
}
.rse-plot-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  color: #1a3a5a;
  font-style: italic;
  pointer-events: none;
}

.rse-error {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.7rem 1rem;
  background: rgba(240,80,80,0.08);
  border-top: 1px solid rgba(240,80,80,0.2);
}
.rse-error-icon {
  flex-shrink: 0;
  font-weight: 700;
  color: #f05050;
  font-size: 0.85rem;
  margin-top: 1px;
}
.rse-error-msg {
  margin: 0;
  font-size: 0.8rem;
  color: #f08080;
  white-space: pre-wrap;
  font-family: monospace;
}

.rse-hint {
  border-top: 1px solid rgba(61,90,128,0.2);
  background: rgba(0,0,0,0.2);
}
.rse-hint summary {
  padding: 0.55rem 1rem;
  cursor: pointer;
  font-size: 0.8rem;
  color: #3d5a80;
  list-style: none;
  user-select: none;
}
.rse-hint summary:hover { color: #4DC6FF; }
.rse-hint-body {
  padding: 0.5rem 1rem 0.75rem;
  font-size: 0.85rem;
  color: #7ecfff;
  margin: 0;
  line-height: 1.6;
}
`;
