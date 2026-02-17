export function SkeletonText({ width, className = '' }) {
  return <div className={`skeleton skeleton-text ${className}`} style={width ? { width } : undefined} />;
}

export function SkeletonTitle({ width }) {
  return <div className="skeleton skeleton-title" style={width ? { width } : undefined} />;
}

export function SkeletonCard({ height = 120 }) {
  return <div className="skeleton skeleton-card" style={{ height }} />;
}

export function SkeletonRow({ count = 1 }) {
  return Array.from({ length: count }, (_, i) => (
    <div key={i} className="skeleton skeleton-row" />
  ));
}

export function DashboardSkeleton() {
  return (
    <div>
      <div className="kpi-grid">
        {Array.from({ length: 7 }, (_, i) => (
          <SkeletonCard key={i} height={100} />
        ))}
      </div>
      <div className="charts-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton skeleton-chart" />
        ))}
      </div>
      <div className="data-table-container" style={{ padding: 16 }}>
        <SkeletonTitle />
        <SkeletonRow count={5} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 10 }) {
  return (
    <div className="data-table-container" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <SkeletonTitle width="30%" />
        <div className="skeleton" style={{ width: 200, height: 36, borderRadius: 8 }} />
      </div>
      <SkeletonRow count={rows} />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 80, height: 36, borderRadius: 8 }} />
        <SkeletonTitle width="40%" />
      </div>
      <div className="skeleton" style={{ height: 40, borderRadius: 8, marginBottom: 24 }} />
      <div className="detail-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} height={200} />
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div className="skeleton" style={{ width: 80, height: 36, borderRadius: 8 }} />
        <SkeletonTitle width="40%" />
      </div>
      <div className="edit-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} height={250} />
        ))}
      </div>
    </div>
  );
}
