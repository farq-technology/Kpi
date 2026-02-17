import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getGeoJSON } from '../../api/surveys.api';
import EmptyState from '../common/EmptyState';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function getComplianceColor(score) {
  const num = Number(score) || 0;
  if (num >= 80) return '#0f9d58';
  if (num >= 60) return '#f4b400';
  return '#db4437';
}

function createComplianceIcon(compliance) {
  const color = getComplianceColor(compliance);
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 14px; height: 14px; border-radius: 50%;
      background: ${color}; border: 2.5px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [19, 19],
    iconAnchor: [9, 9],
  });
}

function MapPopup({ props, t, navigate }) {
  const compliance = Number(props.compliance) || 0;
  const compColor = getComplianceColor(compliance);
  return (
    <div style={{ minWidth: '220px', direction: 'rtl', fontFamily: 'inherit' }}>
      <h4 style={{ margin: '0 0 4px', fontSize: '14px' }}>{props.nameAr || props.nameEn || '-'}</h4>
      {props.nameEn && (
        <p style={{ margin: '0 0 8px', color: '#666', fontSize: '12px' }}>{props.nameEn}</p>
      )}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {props.category && <span className="badge blue">{props.category}</span>}
        <span className={`badge ${props.status?.toLowerCase() === 'open' ? 'green' : 'red'}`}>
          {props.status || '-'}
        </span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
        padding: '6px 8px', background: '#f8f9fa', borderRadius: '6px',
      }}>
        <span style={{ fontSize: '12px', fontWeight: 600 }}>{t('table.compliance')}:</span>
        <div style={{ flex: 1, height: '6px', background: '#e0e0e0', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${compliance}%`, height: '100%', background: compColor, borderRadius: '3px' }} />
        </div>
        <span style={{ fontSize: '12px', fontWeight: 700, color: compColor }}>
          {compliance ? `${compliance.toFixed(0)}%` : '-'}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
        <div>{t('table.agent')}: {props.agent || '-'}</div>
        {props.mediaCount > 0 && <div>{t('media.title')}: {props.mediaCount}</div>}
      </div>
      {props.id && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn btn-sm"
            onClick={(e) => { e.stopPropagation(); navigate(`/surveys/${props.id}`); }}
            style={{ flex: 1 }}
          >
            {t('review.viewDetails', 'Details')}
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={(e) => { e.stopPropagation(); navigate(`/surveys/${props.id}/edit`); }}
            style={{ flex: 1 }}
          >
            {t('edit.editButton', 'Edit')}
          </button>
        </div>
      )}
    </div>
  );
}

export default function SurveyMap() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [geojson, setGeojson] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getGeoJSON();
        setGeojson(data);
      } catch (err) {
        console.error('Error fetching GeoJSON:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  const defaultCenter = [24.7136, 46.6753];
  const features = geojson?.features || [];

  if (features.length === 0) {
    return <EmptyState icon="map" title={t('map.noData', 'No survey locations to display')} />;
  }

  const center = [features[0].geometry.coordinates[1], features[0].geometry.coordinates[0]];

  return (
    <div className="map-container">
      {/* Legend */}
      <div className="map-legend">
        <span className="map-legend-item">
          <span className="map-legend-dot" style={{ background: '#0f9d58' }} />
          {t('review.good', 'Good')} (&ge;80%)
        </span>
        <span className="map-legend-item">
          <span className="map-legend-dot" style={{ background: '#f4b400' }} />
          {t('review.warning', 'Warning')} (60-79%)
        </span>
        <span className="map-legend-item">
          <span className="map-legend-dot" style={{ background: '#db4437' }} />
          {t('review.critical', 'Critical')} (&lt;60%)
        </span>
      </div>
      <MapContainer center={center} zoom={10} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {features.map((feature, idx) => {
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties;
          return (
            <Marker
              key={idx}
              position={[lat, lng]}
              icon={createComplianceIcon(props.compliance)}
            >
              <Popup>
                <MapPopup props={props} t={t} navigate={navigate} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
