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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <Header
          title={t('app.title')}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
