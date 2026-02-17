import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmptyState from '../common/EmptyState';

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

  const parseMissingFields = (mf) => {
    if (Array.isArray(mf)) return mf;
    if (typeof mf === 'string') {
      try { return JSON.parse(mf) || []; } catch { return []; }
    }
    return [];
  };

  const getComplianceColor = (score) => {
    if (score >= 80) return 'var(--color-success)';
    if (score >= 60) return 'var(--color-warning)';
    return 'var(--color-danger)';
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
          aria-label={t('table.search')}
        />
      </div>

      {data.length === 0 ? (
        <EmptyState icon="search" title={t('table.noData')} />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="table-desktop">
            <table>
              <thead>
                <tr>
                  <th scope="col">{t('table.poiNameAr')}</th>
                  <th scope="col">{t('table.poiNameEn')}</th>
                  <th scope="col">{t('table.category')}</th>
                  <th scope="col">{t('table.status')}</th>
                  <th scope="col">{t('table.agent')}</th>
                  <th scope="col">{t('edit.workingDays') || 'Working Days'}</th>
                  <th scope="col">{t('edit.workingHours') || 'Working Hours'}</th>
                  <th scope="col">{t('table.compliance')}</th>
                  <th scope="col">{t('review.missingFields')}</th>
                  <th scope="col">{t('table.date')}</th>
                  <th scope="col">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
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
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{row.working_days || '-'}</td>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{row.working_hours || '-'}</td>
                    <td>
                      <span className={`badge ${getComplianceBadge(row.compliance_score)}`}>
                        {row.compliance_score ? `${Number(row.compliance_score).toFixed(0)}%` : '-'}
                      </span>
                    </td>
                    <td>
                      {(() => {
                        const parsed = parseMissingFields(row.missing_fields);
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
                        aria-label={`${t('edit.editButton')} ${row.poi_name_ar || row.poi_name_en || ''}`}
                      >
                        {t('edit.editButton')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="table-mobile-cards">
            {data.map(row => {
              const missingFields = parseMissingFields(row.missing_fields);
              const score = Number(row.compliance_score) || 0;
              return (
                <div
                  key={row.id}
                  className="mobile-card"
                  onClick={() => navigate(`/surveys/${row.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/surveys/${row.id}`)}
                >
                  <div className="mobile-card-header">
                    <div>
                      <div className="mobile-card-name">{row.poi_name_ar || '-'}</div>
                      <div className="mobile-card-name-en">{row.poi_name_en || '-'}</div>
                    </div>
                    <div className="mobile-card-badges">
                      {row.category && <span className="badge blue">{row.category}</span>}
                      <span className={`badge ${getStatusBadge(row.company_status)}`}>
                        {row.company_status || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="mobile-card-meta">
                    <span>{row.surveyor_username || '-'}</span>
                    <span>{row.submitted_at ? new Date(row.submitted_at).toLocaleDateString('ar-SA') : '-'}</span>
                  </div>

                  <div className="mobile-card-compliance">
                    <div className="mobile-card-compliance-bar">
                      <div
                        className="mobile-card-compliance-fill"
                        style={{ width: `${score}%`, background: getComplianceColor(score) }}
                      />
                    </div>
                    <span className={`badge ${getComplianceBadge(score)}`}>
                      {score ? `${score.toFixed(0)}%` : '-'}
                    </span>
                  </div>

                  <div className="mobile-card-footer">
                    <div className="mobile-card-missing">
                      {missingFields.length > 0 && (
                        <span className="badge yellow">
                          {t('review.missingFieldsCount', { count: missingFields.length })}
                        </span>
                      )}
                    </div>
                    <button
                      className="btn btn-sm"
                      onClick={(e) => { e.stopPropagation(); navigate(`/surveys/${row.id}/edit`); }}
                      aria-label={`${t('edit.editButton')} ${row.poi_name_ar || ''}`}
                    >
                      {t('edit.editButton')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="pagination">
          <span className="pagination-info">
            {t('table.showing')} {data.length} {t('table.of')} {pagination.total} {t('table.entries')}
          </span>
          <div className="pagination-buttons">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page <= 1}
              aria-label={t('table.previousPage', 'Previous page')}
            >
              &laquo;
            </button>
            <span style={{ padding: '8px 12px', fontSize: '14px' }}>
              {t('table.page')} {pagination.page} {t('table.of')} {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              aria-label={t('table.nextPage', 'Next page')}
            >
              &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
