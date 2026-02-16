import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { useTranslation } from 'react-i18next';

export default function WeeklyComparisonChart({ data }) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return <div className="loading-container">{t('table.noData')}</div>;
  }

  const formatted = data.map(d => ({
    ...d,
    week: new Date(d.week).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
    avgCompliance: parseFloat(d.avgCompliance) || 0,
  }));

  const overallAvg = formatted.reduce((s, d) => s + d.total, 0) / formatted.length;

  const enriched = formatted.map((d, i) => ({
    ...d,
    change: i > 0 ? d.total - formatted[i - 1].total : 0,
  }));

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-card-title">{t('charts.weeklyTrend')}</h3>
        <span className="chart-subtitle">
          {t('common.average')}: {overallAvg.toFixed(0)} / {t('charts.week')}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={enriched} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="weeklyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a73e8" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#1a73e8" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: '#5f6368' }}
            tickLine={false}
            axisLine={{ stroke: '#e0e0e0' }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: '#5f6368' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: '#5f6368' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="chart-tooltip">
                  <div className="chart-tooltip-header">{label}</div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-dot" style={{ background: '#1a73e8' }} />
                    <span className="chart-tooltip-label">{t('charts.surveys')}</span>
                    <span className="chart-tooltip-value">{d.total}</span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-dot" style={{ background: '#ab47bc' }} />
                    <span className="chart-tooltip-label">{t('kpi.uniqueSurveyors')}</span>
                    <span className="chart-tooltip-value">{d.surveyors}</span>
                  </div>
                  {d.change !== 0 && (
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-dot" style={{ background: d.change > 0 ? '#0f9d58' : '#db4437' }} />
                      <span className="chart-tooltip-label">{t('charts.change')}</span>
                      <span className="chart-tooltip-value" style={{ color: d.change > 0 ? '#0f9d58' : '#db4437' }}>
                        {d.change > 0 ? '+' : ''}{d.change}
                      </span>
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <ReferenceLine
            yAxisId="left"
            y={overallAvg}
            stroke="#1a73e8"
            strokeDasharray="4 4"
            strokeOpacity={0.3}
          />
          <Bar
            yAxisId="left"
            dataKey="total"
            name={t('charts.surveys')}
            fill="url(#weeklyGrad)"
            radius={[6, 6, 0, 0]}
            barSize={32}
          />
          <Bar
            yAxisId="right"
            dataKey="surveyors"
            name={t('kpi.uniqueSurveyors')}
            fill="#ab47bc"
            radius={[6, 6, 0, 0]}
            barSize={20}
            opacity={0.7}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
