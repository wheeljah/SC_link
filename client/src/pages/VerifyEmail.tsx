import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('error'); setMessage('인증 토큰이 없습니다.'); return; }

    let cancelled = false; // React StrictMode 이중 실행 방지

    api.get(`/auth/verify-email?token=${token}`)
      .then(res => {
        if (!cancelled) { setStatus('ok'); setMessage(res.data.message); }
      })
      .catch(e => {
        if (!cancelled) {
          setStatus('error');
          setMessage(e.response?.data?.message || '인증에 실패했습니다.');
        }
      });

    return () => { cancelled = true; };
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <><div className="text-4xl mb-4 animate-spin inline-block">⏳</div><p className="text-slate-500 mt-2">인증 처리 중...</p></>
        )}
        {status === 'ok' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">인증 완료!</h2>
            <p className="text-slate-500 text-sm mb-6">{message}</p>
            <Link to="/login" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg inline-block transition-colors">
              로그인하기
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">인증 실패</h2>
            <p className="text-slate-500 text-sm mb-6">{message}</p>
            <Link to="/register" className="text-blue-600 hover:underline text-sm">다시 회원가입</Link>
          </>
        )}
      </div>
    </div>
  );
}
