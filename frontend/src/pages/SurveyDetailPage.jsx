import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSurveyById } from '../api/surveys.api';

export default function SurveyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await getSurveyById(id);
        setSurvey(res.data);
      } catch (err) {
        console.error('Error fetching survey:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!survey) return <div className="loading-container">{t('table.noData')}</div>;

  const fields = [
    ['table.poiNameAr', survey.poi_name_ar],
    ['table.poiNameEn', survey.poi_name_en],
    ['table.category', survey.category],
    ['table.status', survey.company_status],
    ['table.agent', survey.surveyor_username],
    ['table.compliance', survey.compliance_score ? `${Number(survey.compliance_score).toFixed(1)}%` : '-'],
    ['table.date', survey.submitted_at ? new Date(survey.submitted_at).toLocaleString('ar-SA') : '-'],
  ];

  const detailFields = [
    ['Phone', survey.phone_number],
    ['Website', survey.website],
    ['Social Media', survey.social_media],
    ['Working Days', survey.working_days],
    ['Working Hours', survey.working_hours],
    ['Payment Methods', survey.payment_methods],
    ['Commercial License', survey.commercial_license],
    ['Building Number', survey.building_number],
    ['Floor', survey.floor_number],
    ['Entrance', survey.entrance_location],
    ['Dine In', survey.dine_in],
    ['Family Seating', survey.has_family_seating],
    ['Parking', survey.has_parking_lot],
    ['WiFi', survey.wifi],
    ['Wheelchair', survey.is_wheelchair_accessible],
    ['Cuisine', survey.cuisine],
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className="btn" onClick={() => navigate(-1)}>
          &rarr; {t('nav.surveys')}
        </button>
        <button className="btn btn-primary" onClick={() => navigate(`/surveys/${id}/edit`)}>
          {t('edit.editButton')}
        </button>
      </div>

      <div className="detail-grid">
        {/* Missing Fields Warning */}
        {(() => {
          const mf = survey.missing_fields;
          const parsed = Array.isArray(mf) ? mf : (typeof mf === 'string' ? (JSON.parse(mf || '[]') || []) : []);
          if (parsed.length === 0) return null;
          return (
            <div className="detail-card" style={{ borderLeft: '4px solid #f59e0b', gridColumn: '1 / -1' }}>
              <h3 style={{ color: '#b45309', marginBottom: '12px' }}>
                {t('review.fieldsToComplete')} ({parsed.length})
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {parsed.map((field) => (
                  <span key={field} className="badge yellow" style={{ fontSize: '13px' }}>
                    {field.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Basic Info */}
        <div className="detail-card">
          <h3>{survey.poi_name_ar || survey.poi_name_en}</h3>
          {fields.map(([key, val]) => (
            <div key={key} className="detail-row">
              <span className="detail-row-label">{t(key)}</span>
              <span className="detail-row-value">{val || '-'}</span>
            </div>
          ))}
        </div>

        {/* Detail Fields */}
        <div className="detail-card">
          <h3>{t('map.details')}</h3>
          {detailFields.map(([label, val]) => (
            val ? (
              <div key={label} className="detail-row">
                <span className="detail-row-label">{label}</span>
                <span className="detail-row-value">{val}</span>
              </div>
            ) : null
          ))}
        </div>

        {/* Location */}
        {survey.latitude && survey.longitude && (
          <div className="detail-card">
            <h3>{t('map.title')}</h3>
            <div style={{ height: '200px', background: '#e8e8e8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <a
                href={`https://www.google.com/maps?q=${survey.latitude},${survey.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                {t('map.title')} ({survey.latitude?.toFixed(4)}, {survey.longitude?.toFixed(4)})
              </a>
            </div>
          </div>
        )}

        {/* Media */}
        {survey.media && survey.media.length > 0 && (
          <div className="detail-card">
            <h3>{t('media.title')} ({survey.media.length})</h3>
            <div className="media-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
              {survey.media.map(m => (
                <div key={m.id} className="media-item">
                  {m.mediaCategory === 'image' ? (
                    <a href={`/api/v1/media/${m.id}/download`} target="_blank" rel="noopener noreferrer">
                      <img
                        src={`/api/v1/media/${m.id}/download`}
                        alt={m.fileName}
                        style={{ height: '100px' }}
                        loading="lazy"
                      />
                    </a>
                  ) : m.mediaCategory === 'video' ? (
                    <video
                      src={`/api/v1/media/${m.id}/download`}
                      controls
                      preload="metadata"
                      style={{ width: '100%', height: '100px', objectFit: 'cover', background: '#000' }}
                    />
                  ) : (
                    <div style={{ height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
                      {'\uD83C\uDFA4'}
                    </div>
                  )}
                  <div className="media-item-info">
                    <span className="badge blue">{m.keyword || m.mediaCategory}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
