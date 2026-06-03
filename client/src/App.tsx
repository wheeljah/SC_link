import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import TopAdBanner from './components/ads/TopAdBanner';
import BottomAdBanner from './components/ads/BottomAdBanner';
import CopyProtection from './components/CopyProtection';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import Servers from './pages/Servers';
import Community from './pages/Community';
import CommunityNew from './pages/CommunityNew';
import CommunityDetail from './pages/CommunityDetail';
import History from './pages/History';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <>{children}</> : <Navigate to="/login" replace />;
}

function Layout() {
  return (
    <>
      <TopAdBanner />
      <Navbar />
      <CopyProtection />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ResetPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/servers" element={<Servers />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/:id" element={<CommunityDetail />} />
          <Route path="/community/new" element={
            <PrivateRoute><CommunityNew /></PrivateRoute>
          } />
          <Route path="/history" element={
            <PrivateRoute><History /></PrivateRoute>
          } />
        </Routes>
      </main>
      <BottomAdBanner />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Layout />
    </AuthProvider>
  );
}
