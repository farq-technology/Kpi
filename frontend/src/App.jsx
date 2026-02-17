import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { FilterProvider } from './context/FilterContext';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/common/ErrorBoundary';
import DashboardPage from './pages/DashboardPage';
import MapPage from './pages/MapPage';
import SurveysPage from './pages/SurveysPage';
import SurveyDetailPage from './pages/SurveyDetailPage';
import SurveyEditPage from './pages/SurveyEditPage';
import MediaPage from './pages/MediaPage';
import ReviewQueuePage from './pages/ReviewQueuePage';
import QualityPage from './pages/QualityPage';

export default function App() {
  return (
    <FilterProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
            <Route path="/review" element={<ErrorBoundary><ReviewQueuePage /></ErrorBoundary>} />
            <Route path="/quality" element={<ErrorBoundary><QualityPage /></ErrorBoundary>} />
            <Route path="/map" element={<ErrorBoundary><MapPage /></ErrorBoundary>} />
            <Route path="/surveys" element={<ErrorBoundary><SurveysPage /></ErrorBoundary>} />
            <Route path="/surveys/:id" element={<ErrorBoundary><SurveyDetailPage /></ErrorBoundary>} />
            <Route path="/surveys/:id/edit" element={<ErrorBoundary><SurveyEditPage /></ErrorBoundary>} />
            <Route path="/media" element={<ErrorBoundary><MediaPage /></ErrorBoundary>} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 3000,
          success: { duration: 3000 },
          error: { duration: 6000 },
          style: { fontSize: '14px' },
        }}
      />
    </FilterProvider>
  );
}
