import { useEffect, useState } from 'react';
import api from '../services/api';

interface UserStats {
  counters: {
    searches:  { today: number; week7: number; month30: number; total: number };
    downloads: { today: number; week7: number; month30: number; total: number };
  };
  success_rate: { completed: number; failed: number; ratio: number };
  input_types:  Array<{ type: string; label: string; count: number }>;
  daily_30d:    Array<{ day: string; cnt: number }>;
}

interface Props {
  /** 특정 사용자 ID (admin이 다른 사용자 조회 시). 없으면 본인 통계. */
  userId?: number;
  /** 카드 상단 제목. 기본 "📊 내 다운로드 통계" */
  title?: string;
  /** 로딩 완료 후 외부에서 추가 fetch를 트리거하고 싶을 때 사용 (예: 모달 닫힐 때 새로고침) */
  refreshKey?: number;
}

export default function DownloadStatsCard({ userId, title, refreshKey }: Props) {
  const endpoint = userId ? `/admin/users/${userId}/stats` : '/auth/me/stats';
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(endpoint)
      .then(r => setStats(r.data.data))
      .catch(() => { /* 무시 — 빈 상태로 렌더 */ })
      .finally(() => setLoading(false));
  }, [endpoint, refreshKey]);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-1/3 mb-4" />
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[1,2,3,4].map(i => <div key={i} className="h-14 bg-slate-100 rounded-lg" />)}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-14 bg-slate-100 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const s = stats.counters.searches;
  const d = stats.counters.downloads;
  const totalAttempts = stats.success_rate.completed + stats.success_rate.failed;
  const maxInput = Math.max(...stats.input_types.map(i => i.count), 1);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 space-y-5">
      <h2 className="text-base font-semibold text-slate-900">{title || '📊 내 다운로드 통계'}</h2>

      {/* 검색 */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-2">🔍 검색 (시도)</div>
        <div className="grid grid-cols-4 gap-2">
          <StatCell label="오늘" value={s.today} />
          <StatCell label="7일" value={s.week7} />
          <StatCell label="30일" value={s.month30} />
          <StatCell label="누적" value={s.total} accent />
        </div>
      </div>

      {/* 다운로드 */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-2">📥 다운로드 (성공)</div>
        <div className="grid grid-cols-4 gap-2">
          <StatCell label="오늘" value={d.today} />
          <StatCell label="7일" value={d.week7} />
          <StatCell label="30일" value={d.month30} />
          <StatCell label="누적" value={d.total} accent />
        </div>
      </div>

      {/* 성공률 */}
      {totalAttempts > 0 && (
        <div className="flex items-center justify-between py-2 px-3 bg-emerald-50 border border-emerald-100 rounded-lg">
          <span className="text-xs font-medium text-emerald-700">✅ 성공률</span>
          <span className="text-sm font-bold text-emerald-700">
            {Math.round(stats.success_rate.ratio * 100)}%
            <span className="text-xs font-normal text-emerald-600 ml-1">
              ({stats.success_rate.completed} / {totalAttempts})
            </span>
          </span>
        </div>
      )}

      {/* 입력 유형별 */}
      <div>
        <div className="text-xs font-medium text-slate-500 mb-2">입력 유형별</div>
        <div className="space-y-1.5">
          {stats.input_types.map(it => (
            <div key={it.type} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-slate-500">{it.label}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-500 h-full rounded-full transition-all"
                  style={{ width: `${(it.count / maxInput) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-xs font-medium text-slate-700">
                {it.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 text-center ${accent
      ? 'bg-teal-50 border border-teal-200'
      : 'bg-slate-50 border border-slate-100'}`}>
      <div className={`text-lg font-bold ${accent ? 'text-teal-700' : 'text-slate-800'}`}>
        {value.toLocaleString()}
      </div>
      <div className={`text-[10px] mt-0.5 ${accent ? 'text-teal-600' : 'text-slate-400'}`}>
        {label}
      </div>
    </div>
  );
}