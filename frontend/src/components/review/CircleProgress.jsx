import { tokens } from './designTokens';

export default function CircleProgress({ value, size = 72, strokeWidth = 6, color }) {
  const safeValue = Math.min(Number(value) || 0, 100);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (safeValue / 100) * c;
  const col = color || (safeValue >= 80 ? tokens.success : safeValue >= 60 ? tokens.warning : tokens.danger);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tokens.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={col}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.22,
          fontWeight: 700,
          color: col,
        }}
      >
        {safeValue}%
      </div>
    </div>
  );
}
