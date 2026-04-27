import { useState, useMemo } from 'react';

const NODE_R  = 32;
const LABEL_Y = 10;

function layoutStates(states) {
  const n = states.length;
  if (n <= 1) return [{ x: 200, y: 150, label: states[0] }];

  const cx = 230, cy = 150;
  const rx = n <= 3 ? 130 : n <= 5 ? 150 : 170;
  const ry = n <= 3 ? 80  : n <= 5 ? 100 : 115;
  const startAngle = -Math.PI / 2;

  return states.map((label, i) => {
    const a = startAngle + (2 * Math.PI * i) / n;
    return {
      x: Math.round(cx + rx * Math.cos(a)),
      y: Math.round(cy + ry * Math.sin(a)),
      label,
    };
  });
}

function arrowHead(x, y, angle) {
  const len = 9;
  const spread = 0.42;
  return [
    x, y,
    x - len * Math.cos(angle - spread), y - len * Math.sin(angle - spread),
    x - len * Math.cos(angle + spread), y - len * Math.sin(angle + spread),
  ].join(',');
}

function edgePoints(from, to, allNodes) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return null;
  const nx = dx / dist;
  const ny = dy / dist;

  // Offset slightly so parallel edges don't overlap
  const offsetMag = 18;
  const ox = -ny * offsetMag;
  const oy =  nx * offsetMag;

  const sx = from.x + nx * NODE_R + ox;
  const sy = from.y + ny * NODE_R + oy;
  const ex = to.x - nx * (NODE_R + 4) + ox;
  const ey = to.y - ny * (NODE_R + 4) + oy;

  const mx = (sx + ex) / 2 + ox * 0.6;
  const my = (sy + ey) / 2 + oy * 0.6;

  const angle = Math.atan2(ey - sy, ex - sx);
  return { sx, sy, ex, ey, mx, my, angle };
}

export default function StateDiagram({ states = [], transitions = [], initial = null }) {
  const [active, setActive] = useState(initial ?? states[0] ?? null);

  const nodes = useMemo(() => layoutStates(states), [states]);
  const nodeMap = useMemo(
    () => Object.fromEntries(nodes.map(n => [n.label, n])),
    [nodes]
  );

  const width  = useMemo(() => Math.max(...nodes.map(n => n.x)) + NODE_R + 20, [nodes]);
  const height = useMemo(() => Math.max(...nodes.map(n => n.y)) + NODE_R + 30, [nodes]);

  const activeTransitions = useMemo(
    () => transitions.filter(t => t.from === active),
    [transitions, active]
  );

  function handleTransition(to) {
    setActive(to);
  }

  return (
    <div className="sd-root">
      <div className="sd-header">
        <span className="sd-label">State Diagram</span>
        <span className="sd-current">
          Current: <strong>{active}</strong>
        </span>
      </div>

      <div className="sd-svg-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} className="sd-svg">
          {/* Edges */}
          {transitions.map((t, i) => {
            const from = nodeMap[t.from];
            const to   = nodeMap[t.to];
            if (!from || !to) return null;
            const pts = edgePoints(from, to, nodes);
            if (!pts) return null;
            const isActive = t.from === active;
            const color = isActive ? 'var(--accent)' : 'var(--dark-grey)';

            return (
              <g key={i}>
                <path
                  d={`M ${pts.sx} ${pts.sy} Q ${pts.mx} ${pts.my} ${pts.ex} ${pts.ey}`}
                  stroke={color}
                  strokeWidth={isActive ? 2 : 1.5}
                  fill="none"
                  opacity={isActive ? 1 : 0.45}
                />
                <polygon
                  points={arrowHead(pts.ex, pts.ey, pts.angle)}
                  fill={color}
                  opacity={isActive ? 1 : 0.45}
                />
                <text
                  x={pts.mx}
                  y={pts.my - 6}
                  textAnchor="middle"
                  fill={color}
                  fontSize="10"
                  fontFamily="Kanit, sans-serif"
                  opacity={isActive ? 1 : 0.5}
                >
                  {t.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((n, i) => {
            const isActive  = n.label === active;
            const isInitial = n.label === initial;
            return (
              <g key={i} className={`sd-node${isActive ? ' sd-node-active' : ''}`}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={NODE_R}
                  fill={isActive ? 'var(--accent-dim)' : 'var(--surface)'}
                  stroke={isActive ? 'var(--accent)' : 'var(--border)'}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                {isInitial && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={NODE_R + 5}
                    fill="none"
                    stroke={isActive ? 'var(--accent)' : 'var(--border)'}
                    strokeWidth="1"
                    opacity="0.5"
                    strokeDasharray="3 3"
                  />
                )}
                <text
                  x={n.x}
                  y={n.y + 5}
                  textAnchor="middle"
                  fill={isActive ? 'var(--accent)' : 'var(--text)'}
                  fontSize="11"
                  fontFamily="Audiowide, Kanit, sans-serif"
                  fontWeight={isActive ? '700' : '400'}
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Transition buttons */}
      <div className="sd-transitions">
        <span className="sd-transition-label">Fire event:</span>
        {activeTransitions.length === 0 && (
          <span className="sd-no-transitions">No outgoing transitions from {active}</span>
        )}
        {activeTransitions.map((t, i) => (
          <button
            key={i}
            className="sd-transition-btn"
            onClick={() => handleTransition(t.to)}
          >
            {t.label} →
          </button>
        ))}
      </div>

      <div className="sd-history">
        <span className="sd-transition-label">Click an event above to fire it and watch the active state change.</span>
      </div>
    </div>
  );
}
