import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LangToggle from './LangToggle';

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth();
  const isAdmin = user?.email === 'wheeljah@gmail.com';
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const link = 'text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0';

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-slate-900 shrink-0">
          <span className="text-2xl">🔬</span>
          <span>ScholarLink</span>
        </Link>

        {/* 모바일에서도 모든 항목 노출 — 넘치면 가로 스크롤 */}
        <div className="flex items-center gap-4 text-sm overflow-x-auto scrollbar-hide min-w-0">
          <LangToggle />

          {isAdmin && <Link to="/servers" className={link}>서버 상태</Link>}
          <Link to="/community" className={link}>커뮤니티</Link>
          <Link to="/report" className={link}>에러 보고</Link>

          {isLoggedIn ? (
            <div className="flex items-center gap-3 shrink-0">
              <Link to="/profile" className={link}>계정정보</Link>
              <Link to="/history" className={link}>이력</Link>
              {isAdmin && (
                <Link to="/admin" className="text-purple-600 hover:text-purple-800 font-semibold transition-colors whitespace-nowrap shrink-0">
                  어드민
                </Link>
              )}
              <button onClick={handleLogout} className="text-slate-500 hover:text-red-600 transition-colors whitespace-nowrap shrink-0">
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <Link to="/login" className={link}>로그인</Link>
              <Link
                to="/register"
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0"
              >
                회원가입
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
