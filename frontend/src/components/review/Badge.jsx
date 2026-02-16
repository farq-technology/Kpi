import { tokens } from './designTokens';

const colorMap = {
  success: { bg: tokens.successLight, color: tokens.success, border: `${tokens.success}33` },
  warning: { bg: tokens.warningLight, color: '#b45309', border: `${tokens.warning}44` },
  danger: { bg: tokens.dangerLight, color: tokens.danger, border: `${tokens.danger}33` },
  info: { bg: tokens.primaryLight, color: tokens.primary, border: `${tokens.primary}33` },
  default: { bg: '#f1f5f9', color: tokens.textSecondary, border: tokens.border },
  approved: { bg: tokens.successLight, color: tokens.success, border: `${tokens.success}33` },
  rejected: { bg: tokens.dangerLight, color: tokens.danger, border: `${tokens.danger}33` },
  pending: { bg: tokens.warningLight, color: '#b45309', border: `${tokens.warning}44` },
};

export default function Badge({ type = 'default', children, size = 'sm' }) {
  const c = colorMap[type] || colorMap.default;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: size === 'xs' ? '1px 6px' : '2px 10px',
        borderRadius: 20,
        fontSize: size === 'xs' ? '0.65rem' : '0.75rem',
        fontWeight: 600,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        whiteSpace: 'nowrap',
        lineHeight: 1.6,
      }}
    >
      {children}
    </span>
  );
}
