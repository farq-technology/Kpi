import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSurveys } from '../hooks/useSurveys';
import { getFilterOptions } from '../api/surveys.api';
import SurveyTable from '../components/tables/SurveyTable';

// Arabic labels for known categories (matches SurveyEditPage)
const CATEGORY_LABELS = {
  'Restaurant': 'مطعم', 'Restaurants': 'مطاعم', 'Cafe': 'مقهى', 'Bakery': 'مخبز',
  'Supermarket': 'سوبرماركت', 'Shopping': 'تسوق', 'Mall / Shopping Center': 'مركز تسوق',
  'Retail': 'بيع بالتجزئة', 'Electronics': 'إلكترونيات',
  'Fashion & Clothing': 'أزياء وملابس', 'Beauty & Spa': 'جمال ومنتجع صحي',
  'Pharmacy': 'صيدلية', 'Hospital': 'مستشفى', 'Health & Medical': 'صحة وطب',
  'Hotel': 'فندق', 'Accommodation': 'إقامة', 'Gym & Fitness': 'صالة رياضية',
  'Education': 'تعليم', 'Government': 'حكومة', 'Bank': 'بنك', 'ATM': 'صراف آلي',
  'Finance & Insurance': 'تمويل وتأمين', 'Gas Station': 'محطة وقود',
  'Mosque': 'مسجد', 'Park': 'حديقة', 'Entertainment': 'ترفيه',
  'Culture & Art': 'ثقافة وفن', 'Car Services': 'خدمات سيارات',
  'Real Estate': 'عقارات', 'Logistics & Delivery': 'لوجستيات وتوصيل',
  'Telecom': 'اتصالات', 'Home Goods': 'مستلزمات منزلية', 'Furniture': 'أثاث',
  'Travel & Tourism': 'سفر وسياحة', 'Life & Convenience': 'حياة ومعيشة',
  'Services & Industry': 'خدمات وصناعة', 'Shopping & Distribution': 'تسوق وتوزيع',
  'Other': 'أخرى',
};

export default function SurveysPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const [category, setCategory] = useState('');
  const [agent, setAgent] = useState('');
  const [filterOptions, setFilterOptions] = useState({ categories: [], agents: [] });

  // Fetch filter dropdown options
  useEffect(() => {
    getFilterOptions()
      .then(res => setFilterOptions(res))
      .catch(err => console.error('Failed to load filters:', err));
  }, []);

  const { data, pagination, loading } = useSurveys({
    page,
    limit: 500,
    search,
    category: category || undefined,
    agent: agent || undefined,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
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

      {/* Category & Agent Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={category}
          onChange={e => { setCategory(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', minWidth: '200px' }}
        >
          <option value="">{t('table.category')}: {t('review.all')}</option>
          {filterOptions.categories.map(cat => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat] ? `${CATEGORY_LABELS[cat]} (${cat})` : cat}
            </option>
          ))}
        </select>

        <select
          value={agent}
          onChange={e => { setAgent(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', minWidth: '180px' }}
        >
          <option value="">{t('table.agent')}: {t('review.all')}</option>
          {filterOptions.agents.map(ag => (
            <option key={ag} value={ag}>{ag}</option>
          ))}
        </select>

        {(category || agent) && (
          <button
            className="btn"
            onClick={() => { setCategory(''); setAgent(''); setPage(1); }}
            style={{ fontSize: '13px' }}
          >
            {t('review.all')}
          </button>
        )}

        {pagination && (
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            {pagination.total} {t('table.entries')}
          </span>
        )}
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
