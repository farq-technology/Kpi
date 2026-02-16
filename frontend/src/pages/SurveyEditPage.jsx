import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getSurveyById, updateSurvey } from '../api/surveys.api';

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

const AGENT_OPTIONS = ['Ahmad Shuban', 'Fadhel', 'Naver', 'Abdulrhman', 'Other'];

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
      { key: 'surveyor_username', labelKey: 'edit.agentName', type: 'select', options: AGENT_OPTIONS },
    ],
  },
  {
    titleKey: 'edit.contactInfo',
    fields: [
      { key: 'phone_number', labelKey: 'edit.phone', type: 'text' },
      { key: 'website', labelKey: 'edit.website', type: 'text' },
      { key: 'social_media', labelKey: 'edit.socialMedia', type: 'text' },
      { key: 'language', labelKey: 'edit.language', type: 'text' },
    ],
  },
  {
    titleKey: 'edit.locationInfo',
    fields: [
      { key: 'latitude', labelKey: 'edit.latitude', type: 'number' },
      { key: 'longitude', labelKey: 'edit.longitude', type: 'number' },
      { key: 'building_number', labelKey: 'edit.buildingNumber', type: 'text' },
      { key: 'floor_number', labelKey: 'edit.floorNumber', type: 'select', options: FLOOR_OPTIONS },
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
      { key: 'payment_methods', labelKey: 'edit.paymentMethods', type: 'text' },
    ],
  },
  {
    titleKey: 'edit.workingInfo',
    fields: [
      { key: 'working_days', labelKey: 'edit.workingDays', type: 'text' },
      { key: 'working_hours', labelKey: 'edit.workingHours', type: 'text' },
      { key: 'break_time', labelKey: 'edit.breakTime', type: 'text' },
      { key: 'holidays', labelKey: 'edit.holidays', type: 'text' },
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getSurveyById(id);
        const data = res.data;
        setOriginal(data);
        const initial = {};
        ALL_FIELD_KEYS.forEach(key => {
          initial[key] = data[key] ?? '';
        });
        setForm(initial);
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
