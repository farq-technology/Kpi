export default function KpiCard({ label, value, icon, color = 'blue', suffix = '', target, description }) {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const progress = target && numValue ? Math.min((numValue / target) * 100, 100) : null;

  return (
    <div className="kpi-card">
      <div className="kpi-card-top">
        <div className={`kpi-card-icon ${color}`}>{icon}</div>
        {target && (
          <span className="kpi-card-target">
            {progress >= 100 ? '\u2713' : `${progress?.toFixed(0)}%`}
          </span>
        )}
      </div>
      <div className="kpi-card-label">{label}</div>
      <div className="kpi-card-value">
        {typeof numValue === 'number' && !isNaN(numValue) ? numValue.toLocaleString() : value}
        {suffix && <span className="kpi-card-suffix">{suffix}</span>}
      </div>
      {progress !== null && (
        <div className="kpi-card-progress">
          <div
            className="kpi-card-progress-fill"
            style={{
              width: `${progress}%`,
              background: progress >= 80 ? 'var(--color-success)' : progress >= 50 ? 'var(--color-warning)' : 'var(--color-danger)',
            }}
          />
        </div>
      )}
      {description && <div className="kpi-card-desc">{description}</div>}
    </div>
  );
}
