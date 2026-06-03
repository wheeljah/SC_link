import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  // 비밀번호 재설정 요청 폼 (토큰 없을 때)
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 w-full max-w-md">
          <h1 className="text-xl font-bold text-slate-900 mb-6 text-center">비밀번호 재설정</h1>
          {sent ? (
            <div className="text-center">
              <div className="text-4xl mb-3">📧</div>
              <p className="text-slate-600 text-sm">비밀번호 재설정 링크를 이메일로 발송했습니다.</p>
              <Link to="/login" className="mt-4 inline-block text-blue-600 hover:underline text-sm">로그인으로</Link>
            </div>
          ) : (
            <form onSubmit={async e => {
              e.preventDefault();
              setLoading(true); setError('');
              try { await api.post('/auth/forgot-password', { email }); setSent(true); }
              catch { setError('오류가 발생했습니다.'); }
              finally { setLoading(false); }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">가입 이메일</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors">
                {loading ? '전송 중...' : '재설정 링크 발송'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 새 비밀번호 입력 폼 (토큰 있을 때)
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 w-full max-w-md">
        <h1 className="text-xl font-bold text-slate-900 mb-6 text-center">새 비밀번호 설정</h1>
        {done ? (
          <div className="text-center">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-slate-600 text-sm mb-4">비밀번호가 변경되었습니다.</p>
            <button onClick={() => navigate('/login')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors">
              로그인하기
            </button>
          </div>
        ) : (
          <form onSubmit={async e => {
            e.preventDefault();
            if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
            setLoading(true); setError('');
            try { await api.post('/auth/reset-password', { token, newPassword: password }); setDone(true); }
            catch (err: unknown) {
              const e = err as { response?: { data?: { message?: string } } };
              setError(e.response?.data?.message || '오류가 발생했습니다.');
            } finally { setLoading(false); }
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">새 비밀번호 (영문+숫자 8자 이상)</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호 확인</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors">
              {loading ? '저장 중...' : '비밀번호 변경'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
