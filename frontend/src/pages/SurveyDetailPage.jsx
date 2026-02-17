import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSurveyById, getSurveyAttachments } from '../api/surveys.api';
import { API_BASE } from '../api/client';
import { getMediaDownloadUrl } from '../api/media.api';

const YES_NO_LABEL = {
  Yes: 'نعم (Yes)',
  No: 'لا (No)',
  'N/A': 'لا ينطبق (N/A)',
};

export default function SurveyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getSurveyById(id);
        const data = res.data;
        setSurvey(data);

        // Fetch media
        if (data.media && data.media.length > 0) {
          setMedia(data.media.map(m => ({
            ...m,
            url: getMediaDownloadUrl(m.id),
          })));
        } else if (data.arcgis_object_id) {
          try {
            const attRes = await getSurveyAttachments(data.arcgis_object_id);
            const groups = attRes.data || [];
            const items = [];
            for (const group of groups) {
              if (!group.attachmentInfos) continue;
              for (const att of group.attachmentInfos) {
                items.push({
                  id: att.id,
                  fileName: att.name,
                  contentType: att.contentType || '',
                  mediaCategory: (att.contentType || '').startsWith('image/') ? 'image'
                    : (att.contentType || '').startsWith('video/') ? 'video' : 'document',
                  keyword: att.keywords || null,
                  url: `${API_BASE}/api/v1/media/arcgis-proxy/${data.arcgis_object_id}/${att.id}`,
                });
              }
            }
            setMedia(items);
          } catch (attErr) {
            console.error('Error fetching attachments:', attErr);
          }
        }
      } catch (err) {
        console.error('Error fetching survey:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!survey) return <div className="loading-container">{t('table.noData')}</div>;

  const fmt = (val) => {
    if (!val || val === '') return '-';
    if (YES_NO_LABEL[val]) return YES_NO_LABEL[val];
    return val;
  };

  // Merge attributes JSONB for fields not in dedicated columns
  const attrs = survey.attributes || {};
  const get = (key) => survey[key] ?? attrs[key] ?? '';

  const sections = [
    {
      title: 'المعلومات الأساسية (Basic Info)',
      fields: [
        ['الاسم بالعربي (Name AR)', get('poi_name_ar')],
        ['الاسم بالإنجليزي (Name EN)', get('poi_name_en')],
        ['الاسم القانوني (Legal Name)', get('legal_name')],
        ['التصنيف (Category)', get('category')],
        ['التصنيف الفرعي (Sub-Category)', get('secondary_category')],
        ['الحالة (Status)', get('company_status')],
        ['ملاحظات الحالة (Status Notes)', get('status_notes')],
        ['الهوية صحيحة (Identity Correct)', get('identity_correct')],
        ['ملاحظات الهوية (Identity Notes)', get('identity_notes')],
        ['اسم المحقق (Agent)', get('surveyor_username')],
        ['الامتثال (Compliance)', survey.compliance_score ? `${Number(survey.compliance_score).toFixed(1)}%` : '-'],
        ['تاريخ الإرسال (Submitted)', survey.submitted_at ? new Date(survey.submitted_at).toLocaleString('ar-SA') : '-'],
      ],
    },
    {
      title: 'أوقات العمل (Working Schedule)',
      fields: [
        ['أيام العمل (Working Days)', get('working_days')],
        ['ساعات العمل (Working Hours)', get('working_hours')],
        ['وقت الاستراحة (Break Time)', get('break_time')],
        ['الإجازات (Holidays)', get('holidays')],
      ],
    },
    {
      title: 'معلومات الاتصال (Contact Info)',
      fields: [
        ['الهاتف (Phone)', get('phone_number')],
        ['الموقع (Website)', get('website')],
        ['التواصل الاجتماعي (Social Media)', get('social_media')],
        ['اللغة (Language)', get('language')],
      ],
    },
    {
      title: 'الموقع (Location)',
      fields: [
        ['رقم المبنى (Building Number)', get('building_number')],
        ['الطابق (Floor)', get('floor_number')],
        ['وصف المدخل (Entrance)', get('entrance_description') || get('entrance_location')],
        ['معلم بارز (Landmark)', get('is_landmark')],
        ['نقطة استلام (Pickup Point)', get('pickup_point_exists')],
        ['وصف نقطة الاستلام (Pickup Description)', get('pickup_description')],
      ],
    },
    {
      title: 'الرخصة والدفع (License & Payment)',
      fields: [
        ['الرخصة التجارية (Commercial License)', get('commercial_license')],
        ['طرق الدفع (Payment Methods)', get('payment_methods')],
      ],
    },
    {
      title: 'القائمة (Menu)',
      fields: [
        ['قائمة ورقية (Physical Menu)', get('has_physical_menu')],
        ['قائمة رقمية (Digital Menu)', get('has_digital_menu')],
        ['رابط الباركود (Menu Barcode URL)', get('menu_barcode_url')],
        ['المطبخ (Cuisine)', get('cuisine')],
      ],
    },
    {
      title: 'خدمات الطعام (Dining Services)',
      fields: [
        ['تناول الطعام في المكان (Dine In)', get('dine_in')],
        ['توصيل فقط (Delivery Only)', get('only_delivery')],
        ['خدمة السيارة (Drive Thru)', get('drive_thru')],
        ['الطلب من السيارة (Order From Car)', get('order_from_car')],
        ['جلسات عائلية (Family Seating)', get('has_family_seating')],
        ['غرف منفصلة (Separate Rooms)', get('has_separate_rooms_for_dining')],
        ['مجموعات كبيرة (Large Groups)', get('large_groups_can_be_seated')],
        ['حجز (Reservation)', get('reservation')],
      ],
    },
    {
      title: 'المرافق (Facilities)',
      fields: [
        ['موقف سيارات (Parking)', get('has_parking_lot')],
        ['خدمة صف السيارات (Valet)', get('valet_parking')],
        ['واي فاي (WiFi)', get('wifi')],
        ['وصول الكراسي المتحركة (Wheelchair)', get('is_wheelchair_accessible')],
        ['منطقة تدخين (Smoking Area)', get('has_smoking_area')],
        ['منطقة انتظار (Waiting Area)', get('has_a_waiting_area')],
        ['مصلى نساء (Women Prayer Room)', get('has_women_only_prayer_room')],
        ['منطقة أطفال (Children Area)', get('children_area')],
      ],
    },
    {
      title: 'الترفيه (Entertainment)',
      fields: [
        ['موسيقى (Music)', get('music')],
        ['بث رياضي مباشر (Live Sports)', get('live_sport_broadcasting')],
        ['شيشة (Shisha)', get('shisha')],
      ],
    },
    {
      title: 'رمضان (Ramadan)',
      fields: [
        ['قائمة إفطار (Iftar Menu)', get('offers_iftar_menu')],
        ['مفتوح للسحور (Open During Suhoor)', get('is_open_during_suhoor')],
        ['خيمة إفطار (Iftar Tent)', get('provides_iftar_tent')],
      ],
    },
    {
      title: 'الدخول (Access)',
      fields: [
        ['يتطلب تذكرة (Requires Ticket)', get('require_ticket')],
        ['دخول مجاني (Free Entry)', get('is_free_entry')],
      ],
    },
  ];

  const generalNotes = get('general_notes');

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

      {/* Compliance Bar */}
      <div className="compliance-bar" style={{ marginBottom: '16px' }}>
        <span>{t('table.compliance')}: </span>
        <span className={`badge ${survey.compliance_score >= 80 ? 'green' : survey.compliance_score >= 50 ? 'yellow' : 'red'}`}>
          {Number(survey.compliance_score || 0).toFixed(1)}%
        </span>
        <span style={{ marginInlineStart: '12px' }}>
          {survey.filled_fields}/{survey.total_fields} fields filled
        </span>
        <span style={{ marginInlineStart: '12px', color: '#6b7280' }}>
          {survey.submitted_at ? new Date(survey.submitted_at).toLocaleString('ar-SA') : '-'}
        </span>
      </div>

      {/* Missing Fields Warning */}
      {(() => {
        const mf = survey.missing_fields;
        const parsed = Array.isArray(mf) ? mf : (typeof mf === 'string' ? (JSON.parse(mf || '[]') || []) : []);
        if (parsed.length === 0) return null;
        return (
          <div className="detail-card" style={{ borderLeft: '4px solid #f59e0b', marginBottom: '16px' }}>
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

      {/* Media Gallery */}
      {media.length > 0 && (
        <div className="detail-card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            الصور والوسائط (Photos & Media)
            <span className="badge blue">{media.length}</span>
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '12px',
          }}>
            {media.map(m => (
              <div key={m.id} style={{
                borderRadius: '8px', overflow: 'hidden',
                border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer',
              }}
                onClick={() => m.mediaCategory === 'image' && setSelectedImage(m)}
              >
                {m.mediaCategory === 'image' ? (
                  <img src={m.url} alt={m.fileName}
                    style={{ width: '100%', height: '140px', objectFit: 'cover' }} loading="lazy" />
                ) : m.mediaCategory === 'video' ? (
                  <video src={m.url} controls preload="metadata"
                    style={{ width: '100%', height: '140px', objectFit: 'cover', background: '#000' }} />
                ) : (
                  <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', fontSize: '28px' }}>
                    📄
                  </div>
                )}
                <div style={{ padding: '4px 8px', fontSize: '11px', color: '#6b7280' }}>
                  <span className="badge blue" style={{ fontSize: '10px' }}>{m.keyword || m.mediaCategory}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen image viewer */}
      {selectedImage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }} onClick={() => setSelectedImage(null)}>
          <img src={selectedImage.url} alt={selectedImage.fileName}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px' }} />
          <div style={{ position: 'absolute', top: '16px', right: '16px', color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
            ✕
          </div>
        </div>
      )}

      {/* Detail Sections */}
      <div className="detail-grid">
        {sections.map(section => {
          const hasData = section.fields.some(([, val]) => val && val !== '' && val !== '-');
          return (
            <div key={section.title} className="detail-card">
              <h3>{section.title}</h3>
              {section.fields.map(([label, val]) => (
                <div key={label} className="detail-row">
                  <span className="detail-row-label">{label}</span>
                  <span className="detail-row-value">
                    {val === 'N/A' ? (
                      <span style={{ color: '#9ca3af' }}>{fmt(val)}</span>
                    ) : (
                      fmt(val)
                    )}
                  </span>
                </div>
              ))}
              {!hasData && (
                <div style={{ padding: '8px 0', color: '#9ca3af', fontSize: '13px' }}>
                  لا توجد بيانات (No data)
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* General Notes */}
      {generalNotes && (
        <div className="detail-card" style={{ marginTop: '16px' }}>
          <h3>ملاحظات عامة (General Notes)</h3>
          <p style={{ whiteSpace: 'pre-wrap', color: '#374151' }}>{generalNotes}</p>
        </div>
      )}

      {/* Location */}
      {survey.latitude && survey.longitude && (
        <div className="detail-card" style={{ marginTop: '16px' }}>
          <h3>{t('map.title')}</h3>
          <div style={{ height: '200px', background: '#e8e8e8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <a
              href={`https://www.google.com/maps?q=${survey.latitude},${survey.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              {t('map.title')} ({Number(survey.latitude).toFixed(4)}, {Number(survey.longitude).toFixed(4)})
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
