import { useState } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Sector,
} from 'recharts';
import { useTranslation } from 'react-i18next';

const COLORS = ['#1a73e8', '#0f9d58', '#f4b400', '#db4437', '#ab47bc', '#00acc1', '#ff7043', '#8d6e63'];

function renderActiveShape(props) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value,
  } = props;

  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#202124" fontSize={14} fontWeight={600}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#5f6368" fontSize={12}>
        {value} ({(percent * 100).toFixed(0)}%)
      </text>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={innerRadius - 1}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

export default function CategoryChart({ data }) {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);

  if (!data || data.length === 0) {
    return <div className="loading-container">{t('table.noData')}</div>;
  }

  const chartData = data.map(d => ({
    name: d.category,
    value: parseInt(d.count),
  }));

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-card-title">{t('charts.categoryDist')}</h3>
        <span className="chart-subtitle">{total} {t('common.total')}</span>
      </div>
      <div className="category-chart-layout">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={105}
              innerRadius={60}
              dataKey="value"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              animationBegin={0}
              animationDuration={800}
            >
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={COLORS[i % COLORS.length]}
                  stroke="none"
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0];
                return (
                  <div className="chart-tooltip">
                    <div className="chart-tooltip-header">{d.name}</div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-dot" style={{ background: d.payload.fill }} />
                      <span className="chart-tooltip-label">{t('common.total')}</span>
                      <span className="chart-tooltip-value">{d.value}</span>
                    </div>
                    <div className="chart-tooltip-row">
                      <span className="chart-tooltip-dot" style={{ background: 'transparent' }} />
                      <span className="chart-tooltip-label">{t('common.percentage')}</span>
                      <span className="chart-tooltip-value">
                        {(d.payload.percent * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="category-legend">
          {chartData.map((entry, i) => {
            const pct = ((entry.value / total) * 100).toFixed(0);
            return (
              <div
                key={i}
                className={`category-legend-item ${i === activeIndex ? 'active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span
                  className="category-legend-color"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="category-legend-name">{entry.name}</span>
                <span className="category-legend-value">{entry.value}</span>
                <span className="category-legend-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
