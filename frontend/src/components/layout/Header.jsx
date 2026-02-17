import { useTranslation } from 'react-i18next';
import { useRealtime } from '../../hooks/useRealtime';

export default function Header({ title, onMenuClick }) {
  const { t, i18n } = useTranslation();
  const { connected } = useRealtime();

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  };

  return (
    <header className="header" role="banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          className="mobile-menu-btn"
          onClick={onMenuClick}
          aria-label={t('accessibility.toggleMenu', 'Toggle menu')}
          aria-expanded="false"
        >
          &#9776;
        </button>
        <h2 className="header-title">{title}</h2>
      </div>
      <div className="header-actions">
        <div className="connection-status" role="status" aria-live="polite">
          <span
            className={`connection-dot ${connected ? 'connected' : 'disconnected'}`}
            aria-hidden="true"
          />
          <span>{connected ? t('status.connected') : t('status.disconnected')}</span>
        </div>
        <button
          className="lang-toggle"
          onClick={toggleLang}
          aria-label={i18n.language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
        >
          {i18n.language === 'ar' ? 'EN' : 'عربي'}
        </button>
      </div>
    </header>
  );
}
