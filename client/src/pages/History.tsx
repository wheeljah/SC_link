import { useState, useEffect } from 'react';
import { PaperRequest } from '../types';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../constants/auth';

const STATUS_ICON: Record<string, string> = {
  pending: '⏳', completed: '✅', failed: '❌',
};

function formatBytes(bytes: number | null) {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface StatsSummary {
  searches_total: number;
  completed: number;
  failed: number;
  ratio: number;
}

export default function History() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [history, setHistory] = useState<PaperRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<StatsSummary | null>(null);

  useEffect(() => {
    api.get(`/papers/history?page=${page}&limit=20`)
      .then(r => { setHistory(r.data.data); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, [page]);

  // Admin만 통계 요약 조회 (백엔드도 admin-only 가드)
  useEffect(() => {
    if (!isAdmin) return;
    api.get('/auth/me/stats')
      .then(r => {
        const d = r.data.data;
        setSummary({
          searches_total: d.counters.searches.total,
          completed:      d.success_rate.completed,
          failed:         d.success_rate.failed,
          ratio:          d.success_rate.ratio,
        });
      })
      .catch(() => { /* 무시 */ });
  }, [isAdmin]);

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-3">
        {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <h1 className="text-2xl font-bold text-slate-900">📁 다운로드 이력</h1>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>총 <strong className="text-slate-700">{total.toLocaleString()}</strong>건</span>
        {summary && (
          <>
            <span className="text-slate-300">·</span>
            <span className="text-emerald-600">
              성공 {summary.completed.toLocaleString()}
            </span>
            {summary.failed > 0 && (
              <span className="text-red-500">
                실패 {summary.failed.toLocaleString()}
              </span>
            )}
            {summary.searches_total > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                성공률 {Math.round(summary.ratio * 100)}%
              </span>
            )}
          </>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">📭</div>
          <p>다운로드 이력이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(r => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg shrink-0">{STATUS_ICON[r.status] || '📄'}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {r.title || r.input_value}
                  </p>
                  <div className="flex gap-2 text-xs text-slate-400 mt-0.5">
                    {r.normalized_doi && <span className="font-mono truncate max-w-[160px]">{r.normalized_doi}</span>}
                    <span>{formatBytes(r.file_size)}</span>
                    <span>{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              </div>
              {r.status === 'completed' && (
                <a
                  href={`/api/v1/papers/${r.id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  PDF
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">
            이전
          </button>
          <span className="px-4 py-2 text-sm text-slate-500">{page} / {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">
            다음
          </button>
        </div>
      )}
    </div>
  );
}
