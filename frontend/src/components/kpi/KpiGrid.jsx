import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import KpiCard from './KpiCard';

export default function KpiGrid({ summary, needsReviewCount = 0 }) {
  const { t } = useTranslation();

  const cards = [
    {
      label: t('kpi.totalSurveys'),
      value: summary?.totalResponses,
      icon: '\uD83D\uDCCB',
      color: 'blue',
      link: '/surveys',
    },
    {
      label: t('kpi.uniqueSurveyors'),
      value: summary?.uniqueSurveyors,
      icon: '\uD83D\uDC65',
      color: 'green',
    },
    {
      label: t('kpi.avgCompliance'),
      value: summary?.avgCompliance != null ? Math.round(summary.avgCompliance) : 0,
      icon: '\u2705',
      color: 'teal',
      suffix: '%',
      target: 100,
      link: '/quality',
    },
    {
      label: t('kpi.mediaUsage'),
      value: summary?.mediaUsageRate != null ? Math.round(summary.mediaUsageRate) : 0,
      icon: '\uD83D\uDCF7',
      color: 'purple',
      suffix: '%',
      target: 100,
      link: '/media',
    },
    {
      label: t('kpi.totalImages'),
      value: summary?.totalImages,
      icon: '\uD83D\uDDBC\uFE0F',
      color: 'orange',
      link: '/media',
    },
    {
      label: t('kpi.completeness'),
      value: summary?.completenessRate != null ? Math.round(summary.completenessRate) : 0,
      icon: '\uD83C\uDFAF',
      color: (summary?.completenessRate || 0) > 80 ? 'green' : 'red',
      suffix: '%',
      target: 100,
      link: '/quality',
    },
    ...(needsReviewCount > 0
      ? [
          {
            label: t('review.needsReview'),
            value: needsReviewCount,
            icon: '\u26A0\uFE0F',
            color: 'red',
            link: '/review',
            description: t('review.reviewQueue'),
          },
        ]
      : []),
  ];

  return (
    <div className="kpi-grid">
      {cards.map((card, i) =>
        card.link ? (
          <Link key={i} to={card.link} style={{ textDecoration: 'none' }}>
            <KpiCard {...card} />
          </Link>
        ) : (
          <KpiCard key={i} {...card} />
        )
      )}
    </div>
  );
}
