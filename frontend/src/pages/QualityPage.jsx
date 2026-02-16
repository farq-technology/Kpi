import { useTranslation } from 'react-i18next';
import { useKpiData } from '../hooks/useKpiData';
import { useFilters } from '../context/FilterContext';
import { Icon, Badge, ComplianceBar, CircleProgress, tokens } from '../components/review';

export default function QualityPage() {
  const { t, i18n } = useTranslation();
  const { filters } = useFilters();
  const isAr = i18n.language === 'ar';
  const {
    summary,
    agents,
    missingFields,
    loading,
    error,
    refetch,
  } = useKpiData(filters.dateFrom, filters.dateTo);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-container">
        <p>{t('status.error')}: {error}</p>
        <button className="btn btn-primary" onClick={refetch} style={{ marginTop: 16 }}>
          {t('filters.apply')}
        </button>
      </div>
    );
  }

  const avgCompliance = summary?.avgCompliance
    ? Math.round(parseFloat(summary.avgCompliance))
    : 0;
  const criticalCount = agents?.filter((a) => (a.avgCompliance || 0) < 60).length ?? 0;
  const topAgent = agents?.length
    ? agents.reduce((best, a) =>
        (a.avgCompliance || 0) > (best?.avgCompliance || 0) ? a : best
      )
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        <div
          style={{
            background: tokens.cardBg,
            borderRadius: 14,
            padding: '20px',
            border: `1px solid ${tokens.border}`,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `${avgCompliance >= 80 ? tokens.success : tokens.warning}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Icon
              name="quality"
              size={20}
              color={avgCompliance >= 80 ? tokens.success : tokens.warning}
            />
          </div>
          <div style={{ fontSize: '0.78rem', color: tokens.textMuted, marginBottom: 4 }}>
            {t('review.avgCompliance')}
          </div>
          <div
            style={{
              fontSize: '1.7rem',
              fontWeight: 800,
              color: tokens.textPrimary,
            }}
          >
            {avgCompliance}%
          </div>
        </div>
        <div
          style={{
            background: tokens.cardBg,
            borderRadius: 14,
            padding: '20px',
            border: `1px solid ${tokens.border}`,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `${tokens.danger}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Icon name="alert" size={20} color={tokens.danger} />
          </div>
          <div style={{ fontSize: '0.78rem', color: tokens.textMuted, marginBottom: 4 }}>
            {t('review.critical')}
          </div>
          <div
            style={{
              fontSize: '1.7rem',
              fontWeight: 800,
              color: tokens.textPrimary,
            }}
          >
            {criticalCount}
          </div>
        </div>
        {topAgent && (
          <div
            style={{
              background: tokens.cardBg,
              borderRadius: 14,
              padding: '20px',
              border: `1px solid ${tokens.border}`,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${tokens.success}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Icon name="user" size={20} color={tokens.success} />
            </div>
            <div style={{ fontSize: '0.78rem', color: tokens.textMuted, marginBottom: 4 }}>
              {isAr ? 'أعلى أداء' : 'Top Performer'}
            </div>
            <div
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                color: tokens.textPrimary,
              }}
            >
              {topAgent.agent || '—'}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 16,
        }}
      >
        <div
          style={{
            background: tokens.cardBg,
            borderRadius: 14,
            padding: '20px',
            border: `1px solid ${tokens.border}`,
          }}
        >
          <h3
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: tokens.textPrimary,
              margin: '0 0 16px',
            }}
          >
            {isAr ? 'توزيع الامتثال' : 'Compliance Distribution'}
          </h3>
          {[
            {
              label: isAr ? 'حرجة (<60%)' : 'Critical (<60%)',
              count: agents?.filter((a) => (a.avgCompliance || 0) < 60).length ?? 0,
              color: tokens.danger,
            },
            {
              label: isAr ? 'تحذير (60-79%)' : 'Warning (60-79%)',
              count: agents?.filter(
                (a) => (a.avgCompliance || 0) >= 60 && (a.avgCompliance || 0) < 80
              ).length ?? 0,
              color: tokens.warning,
            },
            {
              label: isAr ? 'جيدة (≥80%)' : 'Good (≥80%)',
              count: agents?.filter((a) => (a.avgCompliance || 0) >= 80).length ?? 0,
              color: tokens.success,
            },
          ].map((tier, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: tier.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: '0.82rem',
                  color: tokens.textSecondary,
                }}
              >
                {tier.label}
              </span>
              <span
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: tokens.textPrimary,
                }}
              >
                {tier.count}
              </span>
              <div
                style={{
                  width: 60,
                  height: 6,
                  borderRadius: 3,
                  background: '#f1f5f9',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: 3,
                    width: `${agents?.length ? (tier.count / agents.length) * 100 : 0}%`,
                    background: tier.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: tokens.cardBg,
            borderRadius: 14,
            padding: '20px',
            border: `1px solid ${tokens.border}`,
          }}
        >
          <h3
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: tokens.textPrimary,
              margin: '0 0 16px',
            }}
          >
            {t('review.agentPerformance')}
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th
                  style={{
                    padding: '8px 0',
                    textAlign: 'start',
                    color: tokens.textMuted,
                    fontWeight: 500,
                    borderBottom: `1px solid ${tokens.border}`,
                  }}
                >
                  {t('review.agent')}
                </th>
                <th
                  style={{
                    padding: '8px 0',
                    textAlign: 'center',
                    color: tokens.textMuted,
                    fontWeight: 500,
                    borderBottom: `1px solid ${tokens.border}`,
                  }}
                >
                  {t('charts.surveys')}
                </th>
                <th
                  style={{
                    padding: '8px 0',
                    textAlign: 'end',
                    color: tokens.textMuted,
                    fontWeight: 500,
                    borderBottom: `1px solid ${tokens.border}`,
                  }}
                >
                  {t('review.compliance')}
                </th>
              </tr>
            </thead>
            <tbody>
              {(agents || [])
                .sort((a, b) => (b.avgCompliance || 0) - (a.avgCompliance || 0))
                .map((agent, i) => (
                  <tr key={i}>
                    <td
                      style={{
                        padding: '10px 0',
                        borderBottom: `1px solid ${tokens.border}`,
                        fontWeight: 600,
                      }}
                    >
                      {agent.agent}
                    </td>
                    <td
                      style={{
                        padding: '10px 0',
                        borderBottom: `1px solid ${tokens.border}`,
                        textAlign: 'center',
                      }}
                    >
                      {agent.totalSubmissions ?? agent.total_submissions ?? 0}
                    </td>
                    <td
                      style={{
                        padding: '10px 0',
                        borderBottom: `1px solid ${tokens.border}`,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 8,
                        }}
                      >
                        <ComplianceBar value={agent.avgCompliance ?? agent.avg_compliance} height={5} />
                        <span
                          style={{
                            fontWeight: 700,
                            minWidth: 36,
                            textAlign: 'end',
                            color:
                              (agent.avgCompliance ?? agent.avg_compliance) >= 80
                                ? tokens.success
                                : (agent.avgCompliance ?? agent.avg_compliance) >= 60
                                  ? tokens.warning
                                  : tokens.danger,
                          }}
                        >
                          {Math.round(
                            agent.avgCompliance ?? agent.avg_compliance ?? 0
                          )}
                          %
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {(missingFields || []).length > 0 && (
        <div
          style={{
            background: tokens.cardBg,
            borderRadius: 14,
            padding: '20px',
            border: `1px solid ${tokens.border}`,
          }}
        >
          <h3
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: tokens.textPrimary,
              margin: '0 0 16px',
            }}
          >
            {t('review.topMissing')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(missingFields || []).slice(0, 8).map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: tokens.textSecondary,
                    minWidth: 120,
                    textAlign: 'start',
                  }}
                >
                  {item.field || item.fieldEn}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: '#f1f5f9',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 4,
                      width: `${Math.min(
                        ((item.count || 0) / Math.max((missingFields?.[0]?.count || 1), 1)) * 100,
                        100
                      )}%`,
                      background:
                        (item.count || 0) >= 10
                          ? tokens.danger
                          : (item.count || 0) >= 7
                            ? tokens.warning
                            : tokens.info,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: tokens.textPrimary,
                    minWidth: 24,
                    textAlign: 'end',
                  }}
                >
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
