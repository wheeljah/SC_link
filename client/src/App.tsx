import { Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import TopAdBanner from './components/ads/TopAdBanner';
import BottomAdBanner from './components/ads/BottomAdBanner';
import Home from './pages/Home';

export default function App() {
  return (
    <>
      <TopAdBanner />
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomAdBanner />
    </>
  );
}
