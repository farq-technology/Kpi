import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { useTranslation } from 'react-i18next';

const FIELD_COLORS = ['#db4437', '#e57373', '#ef9a9a', '#ffcdd2', '#ffebee', '#fce4ec', '#f8bbd0', '#f48fb1'];

export default function TopMissingFieldsChart({ data }) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return null;
  }

  const sorted = [...data]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const maxCount = sorted[0]?.count || 1;

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-card-title">{t('charts.topMissingFields')}</h3>
        <span className="chart-subtitle">{t('charts.dataGaps')}</span>
      </div>

      <div className="missing-fields-list">
        {sorted.map((field, i) => {
          const barWidth = (field.count / maxCount) * 100;
          return (
            <div key={i} className="missing-field-row">
              <span className="missing-field-name">{field.field}</span>
              <div className="missing-field-bar-container">
                <div
                  className="missing-field-bar"
                  style={{
                    width: `${barWidth}%`,
                    background: FIELD_COLORS[i] || '#ffcdd2',
                  }}
                />
              </div>
              <span className="missing-field-count">{field.count}</span>
              <span className="missing-field-pct">{field.percentage?.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis dataKey="field" type="category" hide />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="chart-tooltip">
                  <div className="chart-tooltip-header">{d.field}</div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-dot" style={{ background: '#db4437' }} />
                    <span className="chart-tooltip-label">{t('charts.missing')}</span>
                    <span className="chart-tooltip-value">{d.count}</span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-dot" style={{ background: 'transparent' }} />
                    <span className="chart-tooltip-label">{t('common.percentage')}</span>
                    <span className="chart-tooltip-value">{d.percentage?.toFixed(1)}%</span>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12}>
            {sorted.map((_, i) => (
              <Cell key={i} fill={FIELD_COLORS[i] || '#ffcdd2'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
