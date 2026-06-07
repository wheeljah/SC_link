import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needVerify, setNeedVerify] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedVerify(false);
    setResendStatus('idle');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; needVerification?: boolean } } };
      setError(err.response?.data?.message || '로그인에 실패했습니다.');
      if (err.response?.data?.needVerification) setNeedVerify(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendStatus('sending');
    try {
      await api.post('/auth/resend-verification', { email });
      setResendStatus('sent');
    } catch {
      setResendStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="text-3xl">🔬</Link>
          <h1 className="text-xl font-bold text-slate-900 mt-2">로그인</h1>
          <p className="text-sm text-slate-500 mt-1">이메일로 로그인하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your@email.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">비밀번호</label>
              <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
                비밀번호를 잊으셨나요?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              <p>{error}</p>
              {needVerify && (
                <div className="mt-2">
                  {resendStatus === 'sent' ? (
                    <p className="text-green-700 text-xs">✅ 인증 메일을 재발송했습니다. 받은 편지함을 확인하세요.</p>
                  ) : resendStatus === 'error' ? (
                    <p className="text-red-600 text-xs">발송 실패. 잠시 후 다시 시도해주세요.</p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendStatus === 'sending'}
                      className="text-xs text-blue-700 underline disabled:opacity-50"
                    >
                      {resendStatus === 'sending' ? '발송 중...' : '인증 메일 재발송'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          계정이 없으신가요?{' '}
          <Link to="/register" className="text-blue-600 hover:underline font-medium">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}
