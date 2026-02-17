import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getSurveyById, updateSurvey, getSurveyAttachments } from '../api/surveys.api';
import { API_BASE } from '../api/client';
import { getMediaDownloadUrl } from '../api/media.api';

const YES_NO = ['Yes', 'No'];

const CATEGORIES = [
  'Health & Medical', 'Finance & Insurance', 'Culture & Art', 'Life & Convenience',
  'Services & Industry', 'Shopping & Distribution', 'Accommodation', 'Restaurants',
  'Restaurant', 'Cafe', 'Bakery', 'Shopping', 'Retail', 'Electronics',
  'Fashion & Clothing', 'Beauty & Spa', 'Pharmacy', 'Hospital', 'Hotel',
  'Gym & Fitness', 'Education', 'Government', 'Bank', 'ATM', 'Gas Station',
  'Mosque', 'Park', 'Entertainment', 'Supermarket', 'Mall / Shopping Center',
  'Car Services', 'Real Estate', 'Logistics & Delivery', 'Telecom', 'Home Goods',
  'Furniture', 'Travel & Tourism', 'Other',
];

const STATUS_OPTIONS = [
  'Open', 'Permanently Closed', 'Temporarily Closed',
  'Under Construction', 'Coming Soon', 'Relocated',
];

const FLOOR_OPTIONS = [
  'Basement -2', 'Basement -1', 'Ground Floor', 'Mezzanine',
  '1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', 'Rooftop',
];

const AGENT_OPTIONS = [
  { code: 'ahmad_shuban', label: 'Ahmad Shuban' },
  { code: 'fadhel', label: 'Fadhel' },
  { code: 'naver', label: 'Naver' },
  { code: 'abdulrhman', label: 'Abdulrhman' },
  { code: 'other', label: 'Other' },
];

const WORKING_DAYS_OPTIONS = [
  { code: 'all_days', label: 'All Days (7 days)' },
  { code: 'sat_thu', label: 'Saturday - Thursday' },
  { code: 'sun_thu', label: 'Sunday - Thursday' },
  { code: 'custom_days', label: 'Custom Days' },
];

const WORKING_HOURS_OPTIONS = [
  { code: '24h', label: '24 Hours' },
  { code: '8am_12am', label: '8 AM - 12 AM' },
  { code: '9am_11pm', label: '9 AM - 11 PM' },
  { code: '9am_12am', label: '9 AM - 12 AM' },
  { code: '8am_10pm', label: '8 AM - 10 PM' },
  { code: '6am_12am', label: '6 AM - 12 AM' },
  { code: '7am_11pm', label: '7 AM - 11 PM' },
  { code: 'custom_hours', label: 'Custom Hours' },
];

const BREAK_TIME_OPTIONS = [
  { code: 'no_break', label: 'No Break' },
  { code: '12pm_1pm', label: '12 PM - 1 PM' },
  { code: '1pm_2pm', label: '1 PM - 2 PM' },
  { code: '2pm_4pm', label: '2 PM - 4 PM' },
  { code: '12pm_4pm', label: '12 PM - 4 PM' },
  { code: '1pm_4pm', label: '1 PM - 4 PM' },
  { code: 'custom_break', label: 'Custom Break' },
];

const HOLIDAYS_OPTIONS = [
  { code: 'none', label: 'None' },
  { code: 'friday', label: 'Friday' },
  { code: 'fri_sat', label: 'Friday & Saturday' },
  { code: 'eid_fitr', label: 'Eid Al-Fitr' },
  { code: 'eid_adha', label: 'Eid Al-Adha' },
  { code: 'national_day', label: 'National Day' },
  { code: 'founding_day', label: 'Founding Day' },
  { code: 'ramadan', label: 'Ramadan' },
];

const PAYMENT_OPTIONS = [
  { code: 'cash', label: 'Cash' },
  { code: 'mada', label: 'Mada' },
  { code: 'visa', label: 'Visa / Mastercard' },
  { code: 'apple_pay', label: 'Apple Pay' },
  { code: 'stc_pay', label: 'STC Pay' },
  { code: 'bank_transfer', label: 'Bank Transfer' },
  { code: 'other', label: 'Other' },
];

const LANGUAGE_OPTIONS = [
  { code: 'arabic', label: 'Arabic' },
  { code: 'english', label: 'English' },
  { code: 'arabic,english', label: 'Arabic & English' },
  { code: 'urdu', label: 'Urdu' },
  { code: 'hindi', label: 'Hindi' },
  { code: 'tagalog', label: 'Tagalog' },
  { code: 'other', label: 'Other' },
];

const FIELD_GROUPS = [
  {
    titleKey: 'edit.basicInfo',
    fields: [
      { key: 'poi_name_ar', labelKey: 'edit.nameAr', type: 'text' },
      { key: 'poi_name_en', labelKey: 'edit.nameEn', type: 'text' },
      { key: 'legal_name', labelKey: 'edit.legalName', type: 'text' },
      { key: 'category', labelKey: 'edit.verifiedCategory', type: 'select', options: CATEGORIES },
      { key: 'secondary_category', labelKey: 'edit.secondaryCategory', type: 'text' },
      { key: 'company_status', labelKey: 'edit.verifiedStatus', type: 'select', options: STATUS_OPTIONS },
      { key: 'status_notes', labelKey: 'edit.statusNotes', type: 'text' },
      { key: 'identity_correct', labelKey: 'edit.identityCorrect', type: 'select', options: YES_NO },
      { key: 'identity_notes', labelKey: 'edit.identityNotes', type: 'text' },
      { key: 'surveyor_username', labelKey: 'edit.agentName', type: 'coded_select', options: AGENT_OPTIONS },
    ],
  },
  {
    titleKey: 'edit.contactInfo',
    fields: [
      { key: 'phone_number', labelKey: 'edit.phone', type: 'text' },
      { key: 'website', labelKey: 'edit.website', type: 'text' },
      { key: 'social_media', labelKey: 'edit.socialMedia', type: 'text' },
      { key: 'language', labelKey: 'edit.language', type: 'multi_select', options: LANGUAGE_OPTIONS },
    ],
  },
  {
    titleKey: 'edit.locationInfo',
    fields: [
      { key: 'latitude', labelKey: 'edit.latitude', type: 'number' },
      { key: 'longitude', labelKey: 'edit.longitude', type: 'number' },
      { key: 'building_number', labelKey: 'edit.buildingNumber', type: 'text' },
      { key: 'floor_number', labelKey: 'edit.floorNumber', type: 'coded_select', options: FLOOR_OPTIONS.map(f => ({ code: f.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_'), label: f })) },
      { key: 'entrance_description', labelKey: 'edit.entranceDescription', type: 'text' },
      { key: 'is_landmark', labelKey: 'edit.isLandmark', type: 'select', options: YES_NO },
      { key: 'pickup_point_exists', labelKey: 'edit.pickupPointExists', type: 'select', options: YES_NO },
      { key: 'pickup_description', labelKey: 'edit.pickupDescription', type: 'text' },
    ],
  },
  {
    titleKey: 'edit.licenseInfo',
    fields: [
      { key: 'commercial_license', labelKey: 'edit.commercialLicense', type: 'text' },
      { key: 'payment_methods', labelKey: 'edit.paymentMethods', type: 'multi_select', options: PAYMENT_OPTIONS },
    ],
  },
  {
    titleKey: 'edit.workingInfo',
    fields: [
      { key: 'working_days', labelKey: 'edit.workingDays', type: 'coded_select', options: WORKING_DAYS_OPTIONS },
      { key: 'working_hours', labelKey: 'edit.workingHours', type: 'coded_select', options: WORKING_HOURS_OPTIONS },
      { key: 'break_time', labelKey: 'edit.breakTime', type: 'coded_select', options: BREAK_TIME_OPTIONS },
      { key: 'holidays', labelKey: 'edit.holidays', type: 'multi_select', options: HOLIDAYS_OPTIONS },
    ],
  },
  {
    titleKey: 'edit.menuInfo',
    fields: [
      { key: 'has_physical_menu', labelKey: 'edit.hasPhysicalMenu', type: 'select', options: YES_NO },
      { key: 'has_digital_menu', labelKey: 'edit.hasDigitalMenu', type: 'select', options: YES_NO },
      { key: 'menu_barcode_url', labelKey: 'edit.menuBarcodeUrl', type: 'text' },
      { key: 'cuisine', labelKey: 'edit.cuisine', type: 'text' },
    ],
  },
  {
    titleKey: 'edit.diningServices',
    fields: [
      { key: 'dine_in', labelKey: 'edit.dineIn', type: 'select', options: YES_NO },
      { key: 'only_delivery', labelKey: 'edit.onlyDelivery', type: 'select', options: YES_NO },
      { key: 'drive_thru', labelKey: 'edit.driveThru', type: 'select', options: YES_NO },
      { key: 'order_from_car', labelKey: 'edit.orderFromCar', type: 'select', options: YES_NO },
      { key: 'has_family_seating', labelKey: 'edit.familySeating', type: 'select', options: YES_NO },
      { key: 'has_separate_rooms_for_dining', labelKey: 'edit.separateRooms', type: 'select', options: YES_NO },
      { key: 'large_groups_can_be_seated', labelKey: 'edit.largeGroups', type: 'select', options: YES_NO },
      { key: 'reservation', labelKey: 'edit.reservation', type: 'select', options: YES_NO },
    ],
  },
  {
    titleKey: 'edit.facilities',
    fields: [
      { key: 'has_parking_lot', labelKey: 'edit.parking', type: 'select', options: YES_NO },
      { key: 'valet_parking', labelKey: 'edit.valetParking', type: 'select', options: YES_NO },
      { key: 'wifi', labelKey: 'edit.wifi', type: 'select', options: YES_NO },
      { key: 'is_wheelchair_accessible', labelKey: 'edit.wheelchair', type: 'select', options: YES_NO },
      { key: 'has_smoking_area', labelKey: 'edit.smokingArea', type: 'select', options: YES_NO },
      { key: 'has_a_waiting_area', labelKey: 'edit.waitingArea', type: 'select', options: YES_NO },
      { key: 'has_women_only_prayer_room', labelKey: 'edit.womenPrayerRoom', type: 'select', options: YES_NO },
      { key: 'children_area', labelKey: 'edit.childrenArea', type: 'select', options: YES_NO },
    ],
  },
  {
    titleKey: 'edit.entertainment',
    fields: [
      { key: 'music', labelKey: 'edit.music', type: 'select', options: YES_NO },
      { key: 'live_sport_broadcasting', labelKey: 'edit.liveSports', type: 'select', options: YES_NO },
      { key: 'shisha', labelKey: 'edit.shisha', type: 'select', options: YES_NO },
    ],
  },
  {
    titleKey: 'edit.ramadanInfo',
    fields: [
      { key: 'offers_iftar_menu', labelKey: 'edit.iftar', type: 'select', options: YES_NO },
      { key: 'is_open_during_suhoor', labelKey: 'edit.suhoor', type: 'select', options: YES_NO },
      { key: 'provides_iftar_tent', labelKey: 'edit.iftarTent', type: 'select', options: YES_NO },
    ],
  },
  {
    titleKey: 'edit.accessInfo',
    fields: [
      { key: 'require_ticket', labelKey: 'edit.requireTicket', type: 'select', options: YES_NO },
      { key: 'is_free_entry', labelKey: 'edit.freeEntry', type: 'select', options: YES_NO },
    ],
  },
  {
    titleKey: 'edit.notesSection',
    fields: [
      { key: 'general_notes', labelKey: 'edit.generalNotes', type: 'textarea' },
    ],
  },
];

const ALL_FIELD_KEYS = FIELD_GROUPS.flatMap(g => g.fields.map(f => f.key));

export default function SurveyEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [original, setOriginal] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [media, setMedia] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getSurveyById(id);
        const data = res.data;
        setOriginal(data);

        // Merge attributes JSONB into form so extra fields show up
        const attrs = data.attributes || {};
        const initial = {};
        ALL_FIELD_KEYS.forEach(key => {
          initial[key] = data[key] ?? attrs[key] ?? '';
        });
        setForm(initial);

        // Fetch media: first check local DB, then ArcGIS
        if (data.media && data.media.length > 0) {
          setMedia(data.media.map(m => ({
            ...m,
            url: getMediaDownloadUrl(m.id),
          })));
        } else if (data.arcgis_object_id) {
          setMediaLoading(true);
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
                  fileSize: att.size || 0,
                  url: `${API_BASE}/api/v1/media/arcgis-proxy/${data.arcgis_object_id}/${att.id}`,
                });
              }
            }
            setMedia(items);
          } catch (attErr) {
            console.error('Error fetching attachments:', attErr);
          } finally {
            setMediaLoading(false);
          }
        }
      } catch (err) {
        console.error('Error fetching survey:', err);
        toast.error(t('status.error'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, t]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const getChangedFields = () => {
    const changed = {};
    for (const key of Object.keys(form)) {
      const newVal = form[key];
      const oldVal = original[key] ?? '';
      if (String(newVal) !== String(oldVal)) {
        changed[key] = newVal === '' ? null : newVal;
      }
    }
    return changed;
  };

  const handleSave = async () => {
    const changed = getChangedFields();
    if (Object.keys(changed).length === 0) {
      toast(t('edit.noChanges'), { icon: '\u2139\uFE0F' });
      return;
    }

    setSaving(true);
    setSyncResult(null);
    try {
      const result = await updateSurvey(id, changed);
      setSyncResult(result.arcgisSync);
      setOriginal(result.data);
      const updated = {};
      ALL_FIELD_KEYS.forEach(key => {
        updated[key] = result.data[key] ?? '';
      });
      setForm(updated);

      if (result.arcgisSync?.synced) {
        toast.success(t('edit.savedAndSynced'));
      } else {
        toast.success(t('edit.savedLocally'));
      }
    } catch (err) {
      console.error('Error saving:', err);
      toast.error(t('edit.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!original) return <div className="loading-container">{t('table.noData')}</div>;

  const changedCount = Object.keys(getChangedFields()).length;

  return (
    <div className="edit-page">
      <div className="edit-header">
        <button className="btn" onClick={() => navigate(`/surveys/${id}`)}>
          &rarr; {t('edit.backToDetail')}
        </button>
        <h2>{t('edit.title')}: {original.poi_name_ar || original.poi_name_en}</h2>
        <div className="edit-actions">
          {changedCount > 0 && (
            <span className="badge blue" style={{ marginInlineEnd: '8px' }}>
              {changedCount} {t('edit.changedFields')}
            </span>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || changedCount === 0}
          >
            {saving ? t('edit.saving') : t('edit.saveAndSync')}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`sync-banner ${syncResult.synced ? 'success' : 'warning'}`}>
          {syncResult.synced
            ? t('edit.syncSuccess')
            : `${t('edit.syncFailed')}: ${syncResult.error || ''}`
          }
        </div>
      )}

      <div className="compliance-bar">
        <span>{t('table.compliance')}: </span>
        <span className={`badge ${original.compliance_score >= 80 ? 'green' : original.compliance_score >= 50 ? 'yellow' : 'red'}`}>
          {Number(original.compliance_score).toFixed(1)}%
        </span>
        <span style={{ marginInlineStart: '12px' }}>
          {original.filled_fields}/{original.total_fields} {t('edit.fieldsFilled')}
        </span>
      </div>

      {/* Media Gallery - at top for validation */}
      {mediaLoading && (
        <div className="edit-card" style={{ marginBottom: '16px', textAlign: 'center', padding: '24px' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '8px', color: '#6b7280' }}>Loading photos...</p>
        </div>
      )}
      {media.length > 0 && (
        <div className="edit-card" style={{ marginBottom: '16px' }}>
          <h3 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Photos & Media
            <span className="badge blue">{media.length}</span>
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '12px',
          }}>
            {media.map(m => (
              <div key={m.id} style={{
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #e5e7eb',
                background: '#f9fafb',
                cursor: 'pointer',
              }}
                onClick={() => m.mediaCategory === 'image' && setSelectedImage(m)}
              >
                {m.mediaCategory === 'image' ? (
                  <img
                    src={m.url}
                    alt={m.fileName}
                    style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                    loading="lazy"
                  />
                ) : m.mediaCategory === 'video' ? (
                  <video
                    src={m.url}
                    controls
                    preload="metadata"
                    style={{ width: '100%', height: '160px', objectFit: 'cover', background: '#000' }}
                  />
                ) : (
                  <div style={{
                    height: '160px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '32px', background: '#f3f4f6'
                  }}>
                    📄
                  </div>
                )}
                <div style={{ padding: '6px 8px', fontSize: '11px', color: '#6b7280' }}>
                  <span className="badge blue" style={{ fontSize: '10px' }}>
                    {m.keyword || m.mediaCategory}
                  </span>
                  <div style={{ marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.fileName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {!mediaLoading && media.length === 0 && (
        <div className="edit-card" style={{ marginBottom: '16px', padding: '16px', textAlign: 'center', color: '#9ca3af', background: '#fef3c7', borderLeft: '4px solid #f59e0b' }}>
          No photos/media attached to this POI
        </div>
      )}

      {/* Fullscreen image viewer */}
      {selectedImage && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setSelectedImage(null)}
        >
          <img
            src={selectedImage.url}
            alt={selectedImage.fileName}
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '8px' }}
          />
          <div style={{
            position: 'absolute', top: '16px', right: '16px',
            color: '#fff', fontSize: '24px', fontWeight: 'bold', cursor: 'pointer',
          }}>
            ✕
          </div>
        </div>
      )}

      <div className="edit-grid">
        {FIELD_GROUPS.map(group => (
          <div key={group.titleKey} className="edit-card">
            <h3>{t(group.titleKey)}</h3>
            {group.fields.map(field => {
              const isChanged = String(form[field.key] ?? '') !== String(original[field.key] ?? '');
              return (
                <div key={field.key} className={`edit-field ${isChanged ? 'changed' : ''}`}>
                  <label>{t(field.labelKey)}</label>
                  {field.type === 'select' ? (
                    <select
                      value={form[field.key] || ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                    >
                      <option value="">--</option>
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'coded_select' ? (
                    <select
                      value={form[field.key] || ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                    >
                      <option value="">--</option>
                      {field.options.map(opt => (
                        <option key={opt.code} value={opt.code}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'multi_select' ? (
                    <div className="multi-select-chips">
                      {field.options.map(opt => {
                        const currentVal = form[field.key] || '';
                        const selected = currentVal.split(',').filter(Boolean);
                        const isActive = selected.includes(opt.code);
                        return (
                          <button
                            key={opt.code}
                            type="button"
                            className={`chip ${isActive ? 'chip-active' : ''}`}
                            onClick={() => {
                              let next;
                              if (isActive) {
                                next = selected.filter(c => c !== opt.code);
                              } else {
                                next = [...selected, opt.code];
                              }
                              handleChange(field.key, next.join(','));
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={form[field.key] ?? ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                      rows={3}
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={form[field.key] ?? ''}
                      onChange={e => handleChange(field.key, e.target.value)}
                      step={field.type === 'number' ? 'any' : undefined}
                    />
                  )}
                  {isChanged && original[field.key] && (
                    <small className="original-value">
                      {t('edit.was')}: {String(original[field.key])}
                    </small>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="edit-footer">
        <button className="btn" onClick={() => navigate(`/surveys/${id}`)}>
          {t('edit.cancel')}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || changedCount === 0}
        >
          {saving ? t('edit.saving') : t('edit.saveAndSync')}
        </button>
      </div>
    </div>
  );
}
