import { useTranslation } from 'react-i18next';
import SurveyMap from '../components/map/SurveyMap';

export default function MapPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h2 style={{ marginBottom: '16px' }}>{t('map.title')}</h2>
      <SurveyMap />
    </div>
  );
}
