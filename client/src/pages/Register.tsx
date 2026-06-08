import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', nickname: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [serverMsg, setServerMsg] = useState('');
  const [verifyLink, setVerifyLink] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        nickname: form.nickname || undefined,
      });
      setDevMode(!!res.data.devMode);
      setServerMsg(res.data.message || '');
      if (res.data.previewUrl) setVerifyLink(res.data.previewUrl); // Ethereal 미리보기
      setDone(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">{devMode ? '📮' : '📧'}</div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {devMode ? '테스트 메일 발송 완료' : '인증 이메일을 발송했습니다'}
          </h2>

          {devMode ? (
            <div className="text-left bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-teal-800 mb-1">📮 Ethereal 임시 메일함으로 발송됨</p>
              <p className="text-sm text-teal-600 mb-3">
                아래 버튼으로 인증 메일을 확인하세요.
              </p>

              {verifyLink ? (
                <a
                  href={verifyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors mb-2"
                >
                  📬 Ethereal 메일함에서 인증 메일 보기 →
                </a>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      const res = await api.get(`/auth/dev-verify-link?email=${encodeURIComponent(form.email)}`);
                      setVerifyLink(res.data.verifyLink);
                    } catch {
                      alert('링크 조회 실패. 서버 터미널을 확인하세요.');
                    }
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors mb-2"
                >
                  🔗 인증 링크 직접 가져오기
                </button>
              )}
              <p className="text-xs text-teal-400 mt-1">
                실제 Gmail 발송: server/.env → SMTP_USER · SMTP_PASS 설정
              </p>
            </div>
          ) : (
            <p className="text-slate-500 text-sm mb-4">
              <strong>{form.email}</strong>으로 발송된 인증 링크를 클릭해주세요.<br />
              <span className="text-slate-400">(유효 시간: 24시간)</span>
            </p>
          )}

          {!devMode && (
            <button
              onClick={async () => {
                try { await api.post('/auth/resend-verification', { email: form.email }); alert('재발송했습니다.'); }
                catch { alert('잠시 후 다시 시도해주세요.'); }
              }}
              className="text-sm text-teal-600 hover:underline"
            >
              인증 메일 재발송
            </button>
          )}
          <div className="mt-6">
            <Link to="/login" className="text-slate-500 hover:text-slate-800 text-sm">
              로그인 페이지로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="text-3xl">🔬</Link>
          <h1 className="text-xl font-bold text-slate-900 mt-2">ScholarLink 회원가입</h1>
          <p className="text-sm text-slate-500 mt-1">이메일로 가입하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">이메일 *</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              required
              autoComplete="email"
              placeholder="your@email.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              비밀번호 * <span className="text-slate-400 font-normal">(영문+숫자 8자 이상)</span>
            </label>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호 확인 *</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={set('confirmPassword')}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              닉네임 <span className="text-slate-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={form.nickname}
              onChange={set('nickname')}
              autoComplete="nickname"
              placeholder="연구자"
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white font-semibold py-2.5 rounded-lg transition-colors mt-2"
          >
            {loading ? '처리 중...' : '이메일로 가입하기'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-teal-600 hover:underline font-medium">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
