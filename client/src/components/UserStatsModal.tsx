import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getApiBaseURL, initPromise } from '../services/api';
import DownloadStatsCard from './DownloadStatsCard';
import { isAdminUser } from '../constants/auth';

interface User {
  id: number;
  email: string;
  nickname: string | null;
  tier: string;
  created_at: string;
}

interface Props {
  userId: number;
  /** 모달에 표시할 사용자 라벨 (이메일 등) — 닫기 전까지 표시 */
  email: string;
  onClose: () => void;
}

/**
 * Admin → 다른 사용자 통계를 모달로 확인.
 * GET /admin/users/:id/stats 호출 → user 정보 + DownloadStatsCard 렌더.
 */
export default function UserStatsModal({ userId, email, onClose }: Props) {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [userInfo, setUserInfo] = useState<User | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        await initPromise;
        const res = await fetch(`${getApiBaseURL()}/admin/users/${userId}/stats`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const j = await res.json();
        if (j.success) {
          setUserInfo(j.data.user);
        } else {
          setError(j.message || '조회 실패');
        }
      } catch (e) {
        setError('네트워크 오류');
      }
    })();
  }, [userId, isAdmin, refreshKey]);

  // ESC로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!isAdmin) return null;

  const tierLabel = (t: string) => ({ free: '무료', premium: '프리미엄', vip: 'VIP' }[t] ?? t);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full my-8"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">📊 사용자 통계</h2>
            <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{email}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-100"
              title="새로고침"
            >
              🔄
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        {/* 사용자 정보 */}
        {userInfo && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-500">닉네임</span>
              <p className="font-medium text-slate-800">{userInfo.nickname || '—'}</p>
            </div>
            <div>
              <span className="text-slate-500">플랜</span>
              <p className="font-medium text-slate-800">{tierLabel(userInfo.tier)}</p>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500">가입일</span>
              <p className="font-medium text-slate-800">
                {new Date(userInfo.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>
        )}

        {/* 본문 — 통계 카드 */}
        <div className="p-5">
          {error ? (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : (
            <DownloadStatsCard
              userId={userId}
              title="📊 다운로드 통계"
              refreshKey={refreshKey}
            />
          )}
        </div>

        {/* 푸터 */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}