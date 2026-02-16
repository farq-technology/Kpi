import { useTranslation } from 'react-i18next';
import MediaGallery from '../components/media/MediaGallery';

export default function MediaPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h2 style={{ marginBottom: '16px' }}>{t('media.title')}</h2>
      <MediaGallery />
    </div>
  );
}
