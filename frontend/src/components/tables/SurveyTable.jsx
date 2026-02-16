import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function SurveyTable({ data, pagination, onPageChange, onSearch }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    onSearch?.(e.target.value);
  };

  const getComplianceBadge = (score) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  };

  const getStatusBadge = (status) => {
    if (!status) return 'gray';
    const s = status.toLowerCase();
    if (s === 'open') return 'green';
    if (s === 'closed') return 'red';
    return 'yellow';
  };

  return (
    <div className="data-table-container">
      <div className="data-table-header">
        <h3>{t('nav.surveys')}</h3>
        <input
          type="text"
          className="search-input"
          placeholder={t('table.search')}
          value={searchTerm}
          onChange={handleSearch}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>{t('table.poiNameAr')}</th>
              <th>{t('table.poiNameEn')}</th>
              <th>{t('table.category')}</th>
              <th>{t('table.status')}</th>
              <th>{t('table.agent')}</th>
              <th>{t('table.compliance')}</th>
              <th>{t('review.missingFields')}</th>
              <th>{t('table.date')}</th>
              <th>{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '32px' }}>
                  {t('table.noData')}
                </td>
              </tr>
            ) : (
              data.map(row => (
                <tr
                  key={row.id}
                  onClick={() => navigate(`/surveys/${row.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{row.poi_name_ar || '-'}</td>
                  <td>{row.poi_name_en || '-'}</td>
                  <td>{row.category || '-'}</td>
                  <td>
                    <span className={`badge ${getStatusBadge(row.company_status)}`}>
                      {row.company_status || '-'}
                    </span>
                  </td>
                  <td>{row.surveyor_username || '-'}</td>
                  <td>
                    <span className={`badge ${getComplianceBadge(row.compliance_score)}`}>
                      {row.compliance_score ? `${Number(row.compliance_score).toFixed(0)}%` : '-'}
                    </span>
                  </td>
                  <td>
                    {(() => {
                      const mf = row.missing_fields;
                      const parsed = Array.isArray(mf) ? mf : (typeof mf === 'string' ? (JSON.parse(mf || '[]') || []) : []);
                      return parsed.length > 0
                        ? <span className="badge yellow">{t('review.missingFieldsCount', { count: parsed.length })}</span>
                        : '-';
                    })()}
                  </td>
                  <td>
                    {row.submitted_at
                      ? new Date(row.submitted_at).toLocaleDateString('ar-SA')
                      : '-'}
                  </td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/surveys/${row.id}/edit`); }}
                    >
                      {t('edit.editButton')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="pagination">
          <span className="pagination-info">
            {t('table.showing')} {data.length} {t('table.of')} {pagination.total} {t('table.entries')}
          </span>
          <div className="pagination-buttons">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              &laquo;
            </button>
            <span style={{ padding: '8px 12px', fontSize: '14px' }}>
              {t('table.page')} {pagination.page} {t('table.of')} {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
