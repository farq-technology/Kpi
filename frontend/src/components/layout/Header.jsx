import { useTranslation } from 'react-i18next';
import { useRealtime } from '../../hooks/useRealtime';

export default function Header({ title, onMenuClick }) {
  const { t, i18n } = useTranslation();
  const { connected } = useRealtime();

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };

  return (
    <header className="header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="mobile-menu-btn" onClick={onMenuClick}>
          &#9776;
        </button>
        <h2 className="header-title">{title}</h2>
      </div>
      <div className="header-actions">
        <div className="connection-status">
          <span className={`connection-dot ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? t('status.connected') : t('status.disconnected')}</span>
        </div>
        <button className="lang-toggle" onClick={toggleLang}>
          {i18n.language === 'ar' ? 'EN' : 'عربي'}
        </button>
      </div>
    </header>
  );
}
