import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useTranslation } from 'react-i18next';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="app-layout">
      <a href="#main-content" className="skip-link">
        {t('accessibility.skipToContent', 'Skip to content')}
      </a>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          style={{ display: 'block' }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="main-content">
        <Header
          title={t('app.title')}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        <main id="main-content" className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
