import {
  ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';

function getGaugeColor(value) {
  if (value >= 80) return '#0f9d58';
  if (value >= 60) return '#f4b400';
  return '#db4437';
}

export default function CompletenessGauge({ summary }) {
  const { t } = useTranslation();

  if (!summary) return null;

  const metrics = [
    {
      name: t('kpi.completeness'),
      value: parseFloat(summary.completenessRate) || 0,
      fill: getGaugeColor(parseFloat(summary.completenessRate) || 0),
    },
    {
      name: t('kpi.avgCompliance'),
      value: parseFloat(summary.avgCompliance) || 0,
      fill: getGaugeColor(parseFloat(summary.avgCompliance) || 0),
    },
    {
      name: t('kpi.mediaUsage'),
      value: parseFloat(summary.mediaUsageRate) || 0,
      fill: getGaugeColor(parseFloat(summary.mediaUsageRate) || 0),
    },
  ];

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-card-title">{t('charts.qualityOverview')}</h3>
      </div>
      <div className="gauge-grid">
        {metrics.map((metric, i) => (
          <div key={i} className="gauge-item">
            <ResponsiveContainer width="100%" height={160}>
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="65%"
                outerRadius="90%"
                startAngle={210}
                endAngle={-30}
                data={[metric]}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  angleAxisId={0}
                  tick={false}
                />
                <RadialBar
                  background={{ fill: '#f0f0f0' }}
                  clockWise
                  dataKey="value"
                  cornerRadius={10}
                  animationDuration={1000}
                />
                <text
                  x="50%" y="46%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={22}
                  fontWeight={700}
                  fill={metric.fill}
                >
                  {metric.value.toFixed(0)}%
                </text>
                <text
                  x="50%" y="62%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={11}
                  fill="#5f6368"
                >
                  {metric.name}
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
      <div className="gauge-legend">
        <span className="gauge-legend-item">
          <span className="gauge-legend-dot" style={{ background: '#0f9d58' }} />
          {t('charts.good')} (80%+)
        </span>
        <span className="gauge-legend-item">
          <span className="gauge-legend-dot" style={{ background: '#f4b400' }} />
          {t('charts.fair')} (60-79%)
        </span>
        <span className="gauge-legend-item">
          <span className="gauge-legend-dot" style={{ background: '#db4437' }} />
          {t('charts.poor')} (&lt;60%)
        </span>
      </div>
    </div>
  );
}
