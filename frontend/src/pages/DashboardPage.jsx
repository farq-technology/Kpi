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
import SurveyTable from '../components/tables/SurveyTable';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { filters } = useFilters();
  const { lastEvent } = useRealtime();

  const {
    summary, daily, categories, agents, statuses,
    loading, error, refetch,
  } = useKpiData(filters.dateFrom, filters.dateTo);

  const {
    data: surveys,
    pagination,
  } = useSurveys({ page: 1, limit: 10 });
  const needsReviewCount = useNeedsReviewCount();

  // Refresh on realtime events
  useEffect(() => {
    if (lastEvent?.type === 'kpi:updated') {
      refetch();
    }
  }, [lastEvent, refetch]);

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
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

      {/* Charts Row 1 */}
      <div className="charts-grid">
        <DailyTrendChart data={daily} />
        <CategoryChart data={categories} />
      </div>

      {/* Charts Row 2 */}
      <div className="charts-grid">
        <AgentChart data={agents} />
        <StatusChart data={statuses} />
      </div>

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
