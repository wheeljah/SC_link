import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface ProfileData {
  id: number;
  email: string;
  nickname: string | null;
  email_verified: boolean;
  tier: string;
  download_count: number;
  created_at: string;
}

export default function Profile() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/auth/me')
      .then(r => setProfile(r.data.data))
      .catch(() => setError('계정 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const handleWithdraw = async () => {
    if (confirmText !== '탈퇴') return;
    setWithdrawing(true);
    try {
      await api.delete('/auth/me');
      await logout();
      navigate('/');
    } catch {
      setError('회원탈퇴 처리 중 오류가 발생했습니다.');
      setWithdrawing(false);
    }
  };

  const tierLabel = (t: string) => ({ free: '무료', premium: '프리미엄', vip: 'VIP' }[t] ?? t);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center text-slate-400">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">계정정보</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {profile && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm divide-y divide-slate-100">
          <Row label="이메일" value={profile.email} />
          <Row label="닉네임" value={profile.nickname ?? '—'} />
          <Row label="이메일 인증" value={profile.email_verified ? '완료' : '미완료'} />
          <Row label="플랜" value={tierLabel(profile.tier)} />
          <Row label="검색 횟수" value={`${profile.download_count.toLocaleString()}회`} />
          <Row label="가입일" value={new Date(profile.created_at).toLocaleDateString('ko-KR')} />
        </div>
      )}

      <button
        onClick={() => { navigate(-1); }}
        className="w-full py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
      >
        돌아가기
      </button>

      {/* 회원탈퇴 섹션 */}
      <div className="border border-red-100 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-red-600">회원탈퇴</h2>
        <p className="text-xs text-slate-500">
          탈퇴 시 계정 및 모든 검색 이력이 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-sm text-red-500 hover:text-red-700 underline"
          >
            회원탈퇴 신청
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-700">
              탈퇴하려면 아래에 <strong>탈퇴</strong>를 입력하세요.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="탈퇴"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowConfirm(false); setConfirmText(''); }}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleWithdraw}
                disabled={confirmText !== '탈퇴' || withdrawing}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold transition-colors"
              >
                {withdrawing ? '처리 중...' : '탈퇴 확인'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}
