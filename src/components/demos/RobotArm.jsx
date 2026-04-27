import { useState, useEffect, useRef } from 'react';

const W = 320;
const H = 240;
const CX = 160;
const CY = 180;
const ARM_LEN = 110;
const ARM_W = 14;

function degToRad(d) { return (d * Math.PI) / 180; }

function armEnd(angleDeg) {
  const r = degToRad(angleDeg - 90);
  return {
    x: CX + ARM_LEN * Math.cos(r),
    y: CY + ARM_LEN * Math.sin(r),
  };
}

function AngleArc({ from, to, color }) {
  if (Math.abs(from - to) < 0.5) return null;
  const r = 40;
  const start = degToRad(from - 90);
  const end   = degToRad(to - 90);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  const sx = CX + r * Math.cos(start);
  const sy = CY + r * Math.sin(start);
  const ex = CX + r * Math.cos(end);
  const ey = CY + r * Math.sin(end);
  return (
    <path
      d={`M ${sx} ${sy} A ${r} ${r} 0 ${large} ${sweep} ${ex} ${ey}`}
      stroke={color}
      strokeWidth="2"
      strokeDasharray="4 3"
      fill="none"
      opacity="0.7"
    />
  );
}

function ArmSVG({ angle, targetAngle, showTarget }) {
  const tip = armEnd(angle);
  const r   = degToRad(angle - 90);
  const px  = -Math.sin(degToRad(angle - 90)) * (ARM_W / 2);
  const py  =  Math.cos(degToRad(angle - 90)) * (ARM_W / 2);

  const targetTip = armEnd(targetAngle);
  const tr = degToRad(targetAngle - 90);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ra-svg" aria-label={`Robot arm at ${Math.round(angle)}°`}>
      {/* Grid lines */}
      <line x1={CX} y1="10" x2={CX} y2={H - 10} stroke="var(--border)" strokeWidth="1" opacity="0.4" />
      <line x1="10" y1={CY} x2={W - 10} y2={CY} stroke="var(--border)" strokeWidth="1" opacity="0.4" />

      {/* Target indicator */}
      {showTarget && Math.abs(angle - targetAngle) > 1 && (
        <>
          <line
            x1={CX} y1={CY}
            x2={targetTip.x} y2={targetTip.y}
            stroke="var(--accent)"
            strokeWidth="2"
            strokeDasharray="6 4"
            opacity="0.5"
          />
          <circle cx={targetTip.x} cy={targetTip.y} r="5" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.6" />
          <AngleArc from={angle} to={targetAngle} color="var(--accent)" />
        </>
      )}

      {/* Arm body */}
      <polygon
        points={`
          ${CX + px} ${CY + py}
          ${CX - px} ${CY - py}
          ${tip.x - px} ${tip.y - py}
          ${tip.x + px} ${tip.y + py}
        `}
        fill="rgba(77,198,255,0.18)"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Pivot */}
      <circle cx={CX} cy={CY} r="9" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
      <circle cx={CX} cy={CY} r="3" fill="var(--accent)" />

      {/* Tip dot */}
      <circle cx={tip.x} cy={tip.y} r="6" fill="var(--accent)" opacity="0.85" />

      {/* Angle label */}
      <text x={CX + 14} y={CY - 14} fill="var(--accent)" fontSize="13" fontFamily="Audiowide, monospace" fontWeight="700">
        {Math.round(angle)}°
      </text>

      {showTarget && Math.abs(angle - targetAngle) > 1 && (
        <text x={targetTip.x + 8} y={targetTip.y - 8} fill="var(--accent)" fontSize="11" fontFamily="Kanit, sans-serif" opacity="0.7">
          target {Math.round(targetAngle)}°
        </text>
      )}
    </svg>
  );
}

// ── PID-like step response simulation ────────────────────────
function simulate(startAngle, targetAngle, steps = 60) {
  const frames = [];
  let pos = startAngle;
  const kp = 0.12;
  const kd = 0.55;
  let vel = 0;
  for (let i = 0; i < steps; i++) {
    const error = targetAngle - pos;
    const accel = kp * error - kd * vel;
    vel = vel + accel;
    pos = pos + vel;
    frames.push(Math.round(pos * 10) / 10);
  }
  return frames;
}

// ── Interactive mode ─────────────────────────────────────────
export default function RobotArm({
  initialAngle = 0,
  targetAngle  = 90,
  autoAnimate  = false,
  interactive  = true,
}) {
  const [angle, setAngle] = useState(initialAngle);
  const [target, setTarget] = useState(targetAngle);
  const [animating, setAnimating] = useState(false);
  const [frames, setFrames] = useState(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const rafRef = useRef(null);

  function startAnimation(from, to) {
    const f = simulate(from, to);
    setFrames(f);
    setFrameIdx(0);
    setAnimating(true);
  }

  useEffect(() => {
    if (!animating || !frames) return;
    if (frameIdx >= frames.length) {
      setAnimating(false);
      setAngle(frames[frames.length - 1]);
      return;
    }
    const id = requestAnimationFrame(() => {
      setAngle(frames[frameIdx]);
      setFrameIdx(i => i + 1);
    });
    return () => cancelAnimationFrame(id);
  }, [animating, frames, frameIdx]);

  useEffect(() => {
    if (autoAnimate) startAnimation(initialAngle, targetAngle);
  }, []);

  function handleTargetChange(e) {
    const v = Number(e.target.value);
    setTarget(v);
  }

  function handleGo() {
    if (!animating) startAnimation(angle, target);
  }

  function handleReset() {
    setAnimating(false);
    setAngle(initialAngle);
    setTarget(targetAngle);
  }

  return (
    <div className="ra-root">
      <div className="ra-header">
        <span className="ra-label">Robot Arm Simulator</span>
        {animating && <span className="ra-badge">simulating PID…</span>}
      </div>

      <ArmSVG angle={angle} targetAngle={target} showTarget={true} />

      {interactive && (
        <div className="ra-controls">
          <label className="ra-ctrl-label">
            Target angle
            <div className="ra-slider-row">
              <input
                type="range"
                min={-180}
                max={180}
                value={target}
                onChange={handleTargetChange}
                disabled={animating}
                className="ra-slider"
              />
              <span className="ra-angle-val">{target}°</span>
            </div>
          </label>

          <div className="ra-btn-row">
            <button
              className="ra-btn ra-btn-primary"
              onClick={handleGo}
              disabled={animating}
            >
              {animating ? 'Moving…' : 'Go →'}
            </button>
            <button className="ra-btn" onClick={handleReset} disabled={animating}>
              Reset
            </button>
          </div>
        </div>
      )}

      <p className="ra-caption">
        Simulates a PID-like step response — the arm accelerates toward the target, overshoots slightly, then settles.
      </p>
    </div>
  );
}
