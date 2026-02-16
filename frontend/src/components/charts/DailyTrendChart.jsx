import {
  ResponsiveContainer, ComposedChart, Area, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import { useTranslation } from 'react-i18next';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-header">{label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: entry.color }} />
          <span className="chart-tooltip-label">{entry.name}</span>
          <span className="chart-tooltip-value">
            {entry.dataKey === 'avgCompliance'
              ? `${entry.value?.toFixed(1)}%`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DailyTrendChart({ data }) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return <div className="loading-container">{t('table.noData')}</div>;
  }

  const formatted = data.map(d => ({
    ...d,
    day: new Date(d.day).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }),
    avgCompliance: parseFloat(d.avgCompliance) || 0,
  }));

  const avgTotal = formatted.reduce((s, d) => s + d.total, 0) / formatted.length;

  // Trend: compare last 3 days vs first 3 days
  const recent = formatted.slice(-3);
  const early = formatted.slice(0, 3);
  const recentAvg = recent.reduce((s, d) => s + d.total, 0) / recent.length;
  const earlyAvg = early.reduce((s, d) => s + d.total, 0) / early.length;
  const trendPct = earlyAvg > 0 ? ((recentAvg - earlyAvg) / earlyAvg * 100).toFixed(0) : 0;
  const trendUp = recentAvg >= earlyAvg;

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-card-title">{t('charts.dailyTrend')}</h3>
        <div className={`chart-trend-badge ${trendUp ? 'trend-up' : 'trend-down'}`}>
          {trendUp ? '\u2191' : '\u2193'} {Math.abs(trendPct)}%
        </div>
      </div>
      <div className="chart-summary-row">
        <div className="chart-summary-item">
          <span className="chart-summary-label">{t('common.average')}</span>
          <span className="chart-summary-value">{avgTotal.toFixed(0)}</span>
          <span className="chart-summary-unit">{t('charts.surveysPerDay')}</span>
        </div>
        <div className="chart-summary-item">
          <span className="chart-summary-label">{t('charts.peak')}</span>
          <span className="chart-summary-value">{Math.max(...formatted.map(d => d.total))}</span>
          <span className="chart-summary-unit">{t('charts.surveys')}</span>
        </div>
        <div className="chart-summary-item">
          <span className="chart-summary-label">{t('charts.totalDays')}</span>
          <span className="chart-summary-value">{formatted.length}</span>
          <span className="chart-summary-unit">{t('charts.days')}</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradSurveys" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#1a73e8" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradCompliance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0f9d58" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#0f9d58" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="day"
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
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#5f6368' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <ReferenceLine
            yAxisId="left"
            y={avgTotal}
            stroke="#1a73e8"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="total"
            name={t('charts.surveys')}
            fill="url(#gradSurveys)"
            stroke="#1a73e8"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#1a73e8', strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#1a73e8', stroke: '#fff', strokeWidth: 2 }}
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="avgCompliance"
            name={t('charts.compliance')}
            fill="url(#gradCompliance)"
            stroke="#0f9d58"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: '#0f9d58', stroke: '#fff', strokeWidth: 2 }}
          />
          {formatted.some(d => d.surveyors) && (
            <Bar
              yAxisId="left"
              dataKey="surveyors"
              name={t('kpi.uniqueSurveyors')}
              fill="#e8eaf6"
              radius={[3, 3, 0, 0]}
              barSize={16}
              opacity={0.5}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
