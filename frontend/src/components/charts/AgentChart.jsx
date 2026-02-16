import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { useTranslation } from 'react-i18next';

function getComplianceColor(score) {
  if (score >= 90) return '#0f9d58';
  if (score >= 70) return '#f4b400';
  return '#db4437';
}

function getRankBadge(index) {
  if (index === 0) return { label: '1st', cls: 'rank-gold' };
  if (index === 1) return { label: '2nd', cls: 'rank-silver' };
  if (index === 2) return { label: '3rd', cls: 'rank-bronze' };
  return null;
}

export default function AgentChart({ data }) {
  const { t } = useTranslation();

  if (!data || data.length === 0) {
    return <div className="loading-container">{t('table.noData')}</div>;
  }

  const sorted = [...data].sort((a, b) => b.totalSubmissions - a.totalSubmissions);
  const maxSubmissions = Math.max(...sorted.map(d => d.totalSubmissions));

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-card-title">{t('charts.agentPerf')}</h3>
        <span className="chart-subtitle">
          {sorted.length} {t('charts.agents')}
        </span>
      </div>

      {/* Agent leaderboard */}
      <div className="agent-leaderboard">
        {sorted.slice(0, 8).map((agent, i) => {
          const complianceScore = parseFloat(agent.avgCompliance) || 0;
          const completionRate = agent.totalSubmissions > 0
            ? (agent.complete / agent.totalSubmissions * 100)
            : 0;
          const barWidth = (agent.totalSubmissions / maxSubmissions) * 100;
          const rank = getRankBadge(i);

          return (
            <div key={i} className="agent-row">
              <div className="agent-info">
                {rank && <span className={`agent-rank ${rank.cls}`}>{rank.label}</span>}
                <span className="agent-name">{agent.agent}</span>
              </div>
              <div className="agent-metrics">
                <div className="agent-bar-container">
                  <div
                    className="agent-bar"
                    style={{ width: `${barWidth}%` }}
                  />
                  <span className="agent-bar-label">{agent.totalSubmissions}</span>
                </div>
                <div className="agent-scores">
                  <span
                    className="agent-compliance-badge"
                    style={{ background: `${getComplianceColor(complianceScore)}18`, color: getComplianceColor(complianceScore) }}
                  >
                    {complianceScore.toFixed(0)}%
                  </span>
                  <span className="agent-completion">{completionRate.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mini bar chart for overview */}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={sorted.slice(0, 10)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="agent"
            tick={{ fontSize: 10, fill: '#5f6368' }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-30}
            textAnchor="end"
            height={40}
          />
          <YAxis hide />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="chart-tooltip">
                  <div className="chart-tooltip-header">{d.agent}</div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-dot" style={{ background: '#1a73e8' }} />
                    <span className="chart-tooltip-label">{t('charts.surveys')}</span>
                    <span className="chart-tooltip-value">{d.totalSubmissions}</span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-dot" style={{ background: '#0f9d58' }} />
                    <span className="chart-tooltip-label">{t('charts.compliance')}</span>
                    <span className="chart-tooltip-value">{d.avgCompliance?.toFixed(1)}%</span>
                  </div>
                  <div className="chart-tooltip-row">
                    <span className="chart-tooltip-dot" style={{ background: '#ab47bc' }} />
                    <span className="chart-tooltip-label">{t('charts.categories')}</span>
                    <span className="chart-tooltip-value">{d.categoriesCovered}</span>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="totalSubmissions" radius={[4, 4, 0, 0]} barSize={24}>
            {sorted.slice(0, 10).map((_, i) => (
              <Cell
                key={i}
                fill={i === 0 ? '#1a73e8' : i === 1 ? '#4a9af5' : '#c5dcf7'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
