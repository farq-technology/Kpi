import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { getGeoJSON } from '../../api/surveys.api';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon issue
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const CATEGORY_COLORS = {
  restaurants: '#e53935',
  Retail: '#1e88e5',
  Healthcare: '#43a047',
  Education: '#fb8c00',
  Entertainment: '#8e24aa',
};

function createCategoryIcon(category) {
  const color = CATEGORY_COLORS[category] || '#1a73e8';
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 12px; height: 12px; border-radius: 50%;
      background: ${color}; border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function SurveyMap() {
  const { t } = useTranslation();
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

  // Default center: Saudi Arabia
  const defaultCenter = [24.7136, 46.6753];

  const features = geojson?.features || [];
  const center = features.length > 0
    ? [features[0].geometry.coordinates[1], features[0].geometry.coordinates[0]]
    : defaultCenter;

  return (
    <div className="map-container">
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
              icon={createCategoryIcon(props.category)}
            >
              <Popup>
                <div style={{ minWidth: '200px', direction: 'rtl' }}>
                  <h4 style={{ margin: '0 0 8px' }}>{props.nameAr || props.nameEn || '-'}</h4>
                  {props.nameEn && <p style={{ margin: '2px 0', color: '#666', fontSize: '12px' }}>{props.nameEn}</p>}
                  <p style={{ margin: '4px 0' }}>
                    <strong>{t('table.category')}:</strong> {props.category || '-'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>{t('table.status')}:</strong>{' '}
                    <span className={`badge ${props.status?.toLowerCase() === 'open' ? 'green' : 'red'}`}>
                      {props.status || '-'}
                    </span>
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>{t('table.agent')}:</strong> {props.agent || '-'}
                  </p>
                  <p style={{ margin: '4px 0' }}>
                    <strong>{t('table.compliance')}:</strong> {props.compliance ? `${Number(props.compliance).toFixed(0)}%` : '-'}
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#888' }}>
                    {t('media.title')}: {props.mediaCount || 0}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
