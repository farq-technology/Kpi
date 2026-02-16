import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSurveys } from '../hooks/useSurveys';
import SurveyTable from '../components/tables/SurveyTable';

export default function SurveysPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [needsReview, setNeedsReview] = useState(false);

  const { data, pagination, loading } = useSurveys({
    page,
    limit: 500,
    search,
    needsReview: needsReview || undefined,
    sort: needsReview ? 'compliance' : undefined,
  });

  const handleSearch = useCallback((term) => {
    setSearch(term);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((review) => {
    setNeedsReview(review);
    setPage(1);
  }, []);

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <h2 style={{ margin: 0 }}>{t('nav.surveys')}</h2>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            className={`btn ${!needsReview ? 'btn-primary' : ''}`}
            onClick={() => handleFilterChange(false)}
          >
            {t('review.all')}
          </button>
          <button
            className={`btn ${needsReview ? 'btn-primary' : ''}`}
            onClick={() => handleFilterChange(true)}
          >
            {t('review.needsReview')}
            {needsReview && pagination?.total != null && (
              <span style={{
                marginInlineStart: '6px',
                background: 'rgba(255,255,255,0.25)',
                borderRadius: '10px',
                padding: '1px 7px',
                fontSize: '12px',
              }}>
                {pagination.total}
              </span>
            )}
          </button>
        </div>
      </div>
      <SurveyTable
        data={data}
        pagination={pagination}
        onPageChange={setPage}
        onSearch={handleSearch}
      />
    </div>
  );
}
