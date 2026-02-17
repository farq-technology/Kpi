import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useKpiData } from '../hooks/useKpiData';
import { useRealtime } from '../hooks/useRealtime';
import { useFilters } from '../context/FilterContext';
import { useSurveys } from '../hooks/useSurveys';
import { useNeedsReviewCount } from '../hooks/useNeedsReviewCount';
import KpiGrid from '../components/kpi/KpiGrid';
import DailyTrendChart from '../components/charts/DailyTrendChart';
import CategoryChart from '../components/charts/CategoryChart';
import AgentChart from '../components/charts/AgentChart';
import StatusChart from '../components/charts/StatusChart';
import CompletenessGauge from '../components/charts/CompletenessGauge';
import WeeklyComparisonChart from '../components/charts/WeeklyComparisonChart';
import TopMissingFieldsChart from '../components/charts/TopMissingFieldsChart';
import SurveyTable from '../components/tables/SurveyTable';
import { DashboardSkeleton } from '../components/common/Skeleton';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { filters } = useFilters();
  const { lastEvent } = useRealtime();

  const {
    summary, daily, weekly, categories, agents, statuses, missingFields,
    loading, error, refetch,
  } = useKpiData(filters.dateFrom, filters.dateTo);

  const {
    data: surveys,
    pagination,
  } = useSurveys({ page: 1, limit: 10, dateFrom: filters.dateFrom, dateTo: filters.dateTo });
  const needsReviewCount = useNeedsReviewCount();

  // Refresh on realtime events
  useEffect(() => {
    if (lastEvent?.type === 'kpi:updated') {
      refetch();
    }
  }, [lastEvent, refetch]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="loading-container">
        <div>
          <p>{t('status.error')}: {error}</p>
          <button className="btn btn-primary" onClick={refetch} style={{ marginTop: '16px' }}>
            {t('filters.apply')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Bar */}
      <FilterBar />

      {/* KPI Cards */}
      <KpiGrid summary={summary} needsReviewCount={needsReviewCount} />

      {/* Row 1: Daily Trend (wide) + Quality Gauges */}
      <div className="charts-grid">
        <DailyTrendChart data={daily} />
        <CompletenessGauge summary={summary} />
      </div>

      {/* Row 2: Category Distribution + Status */}
      <div className="charts-grid">
        <CategoryChart data={categories} />
        <StatusChart data={statuses} />
      </div>

      {/* Row 3: Agent Performance + Weekly Comparison */}
      <div className="charts-grid">
        <AgentChart data={agents} />
        <WeeklyComparisonChart data={weekly} />
      </div>

      {/* Row 4: Missing Fields (full width if data exists) */}
      {missingFields && missingFields.length > 0 && (
        <div className="charts-grid charts-grid-single">
          <TopMissingFieldsChart data={missingFields} />
        </div>
      )}

      {/* Recent Surveys Table */}
      <SurveyTable data={surveys} pagination={pagination} />
    </div>
  );
}

function FilterBar() {
  const { t } = useTranslation();
  const { filters, updateFilter, resetFilters } = useFilters();

  return (
    <div className="filter-bar">
      <label style={{ fontSize: '14px', fontWeight: '600' }}>{t('filters.dateFrom')}</label>
      <input
        type="date"
        value={filters.dateFrom}
        onChange={(e) => updateFilter('dateFrom', e.target.value)}
      />
      <label style={{ fontSize: '14px', fontWeight: '600' }}>{t('filters.dateTo')}</label>
      <input
        type="date"
        value={filters.dateTo}
        onChange={(e) => updateFilter('dateTo', e.target.value)}
      />
      <button className="btn" onClick={resetFilters}>
        {t('filters.reset')}
      </button>
    </div>
  );
}
