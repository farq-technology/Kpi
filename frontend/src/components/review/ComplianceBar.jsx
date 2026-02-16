import { tokens } from './designTokens';

export default function ComplianceBar({ value, height = 6, showLabel = false }) {
  const safeValue = Math.min(Number(value) || 0, 100);
  const color = safeValue >= 80 ? tokens.success : safeValue >= 60 ? tokens.warning : tokens.danger;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div
        style={{
          flex: 1,
          height,
          borderRadius: height,
          background: tokens.border,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${safeValue}%`,
            height: '100%',
            borderRadius: height,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
      {showLabel && (
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color, minWidth: 36, textAlign: 'end' }}>
          {safeValue}%
        </span>
      )}
    </div>
  );
}
