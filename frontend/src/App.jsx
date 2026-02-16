import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { FilterProvider } from './context/FilterContext';
import AppLayout from './components/layout/AppLayout';
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
            <Route path="/" element={<DashboardPage />} />
            <Route path="/review" element={<ReviewQueuePage />} />
            <Route path="/quality" element={<QualityPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/surveys" element={<SurveysPage />} />
            <Route path="/surveys/:id" element={<SurveyDetailPage />} />
            <Route path="/surveys/:id/edit" element={<SurveyEditPage />} />
            <Route path="/media" element={<MediaPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-left" reverseOrder={false} />
    </FilterProvider>
  );
}
