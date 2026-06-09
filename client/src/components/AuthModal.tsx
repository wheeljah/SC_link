import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;          // 로그인 성공 시 호출 (예: 다운로드 자동 재개)
  title?: string;
  description?: string;
}

export default function AuthModal({ open, onClose, onSuccess, title, description }: Props) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needVerify, setNeedVerify] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedVerify(false);
    setLoading(true);
    try {
      await login(email, password);
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; needVerification?: boolean } } };
      setError(err.response?.data?.message || '로그인에 실패했습니다.');
      if (err.response?.data?.needVerification) setNeedVerify(true);
    } finally {
      setLoading(false);
    }
  };

  const goRegister = () => { onClose(); navigate('/register'); };
  const goForgot = () => { onClose(); navigate('/forgot-password'); };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* 닫기 (우상단) */}
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-3 right-4 text-slate-400 hover:text-slate-700 transition-colors text-xl leading-none"
        >
          ✕
        </button>

        {/* 헤더 */}
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🔒</div>
          <h2 className="text-xl font-bold text-slate-900">{title || '로그인이 필요합니다'}</h2>
          <p className="text-sm text-slate-500 mt-1">
            {description || '검색은 로그인 후 이용할 수 있습니다.'}
          </p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              placeholder="your@email.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">비밀번호</label>
              <button type="button" onClick={goForgot} className="text-xs text-teal-600 hover:underline">
                비밀번호를 잊으셨나요?
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
              {needVerify && (
                <button
                  type="button"
                  onClick={async () => {
                    try { await api.post('/auth/resend-verification', { email }); alert('인증 메일을 재발송했습니다.'); }
                    catch { alert('잠시 후 다시 시도해주세요.'); }
                  }}
                  className="ml-1 underline font-medium"
                >
                  인증 메일 재발송
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* 회원가입 안내 */}
        <p className="text-center text-sm text-slate-500 mt-5">
          계정이 없으신가요?{' '}
          <button onClick={goRegister} className="text-teal-600 hover:underline font-medium">
            회원가입
          </button>
        </p>
      </div>
    </div>
  );
}
