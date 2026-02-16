import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, LabelList,
} from 'recharts';
import { useTranslation } from 'react-i18next';

const STATUS_COLORS = {
  open: '#0f9d58',
  closed: '#db4437',
  'temporarily closed': '#f4b400',
};

const STATUS_BG = {
  open: '#e8f5e9',
  closed: '#fce4ec',
  'temporarily closed': '#fff8e1',
};

export default function StatusChart({ data }) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return <div className="loading-container">{t('table.noData')}</div>;
  }

  const chartData = data.map(d => ({
    name: d.status,
    count: parseInt(d.count),
  }));

  const total = chartData.reduce((s, d) => s + d.count, 0);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-card-title">{t('charts.statusDist')}</h3>
        <span className="chart-subtitle">{total} {t('common.total')}</span>
      </div>

      {/* Status summary cards */}
      <div className="status-summary">
        {chartData.map((entry, i) => {
          const color = STATUS_COLORS[entry.name?.toLowerCase()] || '#1a73e8';
          const bg = STATUS_BG[entry.name?.toLowerCase()] || '#e3f2fd';
          const pct = total > 0 ? (entry.count / total * 100).toFixed(1) : 0;
          return (
            <div key={i} className="status-card" style={{ background: bg, borderColor: color }}>
              <div className="status-card-count" style={{ color }}>{entry.count}</div>
              <div className="status-card-name">{entry.name}</div>
              <div className="status-card-pct" style={{ color }}>{pct}%</div>
              <div className="status-card-bar">
                <div
                  className="status-card-bar-fill"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <defs>
            {chartData.map((entry, i) => {
              const color = STATUS_COLORS[entry.name?.toLowerCase()] || '#1a73e8';
              return (
                <linearGradient key={i} id={`statusGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.6} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: '#5f6368' }}
            tickLine={false}
            axisLine={{ stroke: '#e0e0e0' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#5f6368' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              const pct = total > 0 ? (d.count / total * 100).toFixed(1) : 0;
              return (
                <div className="chart-tooltip">
                  <div className="chart-tooltip-header">{d.name}</div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-dot" style={{ background: STATUS_COLORS[d.name?.toLowerCase()] }} />
                    <span className="chart-tooltip-label">{t('common.total')}</span>
                    <span className="chart-tooltip-value">{d.count}</span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-dot" style={{ background: 'transparent' }} />
                    <span className="chart-tooltip-label">{t('common.percentage')}</span>
                    <span className="chart-tooltip-value">{pct}%</span>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={56}>
            <LabelList
              dataKey="count"
              position="top"
              style={{ fontSize: 13, fontWeight: 600, fill: '#202124' }}
            />
            {chartData.map((_, i) => (
              <Cell key={i} fill={`url(#statusGrad${i})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
