import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-slate-900">
          <span className="text-2xl">🔬</span>
          <span>ScholarLink</span>
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link to="/servers" className="text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
            서버 상태
          </Link>
          <Link to="/community" className="text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
            커뮤니티
          </Link>
          <Link to="/report" className="text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
            에러 보고
          </Link>

          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <span className="text-slate-500 hidden sm:block">
                {user?.nickname || user?.email}
              </span>
              <Link
                to="/history"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                이력
              </Link>
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-red-600 transition-colors"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="text-slate-600 hover:text-slate-900 transition-colors">
                로그인
              </Link>
              <Link
                to="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg font-medium transition-colors"
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
