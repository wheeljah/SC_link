import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CommunityRequest } from '../types';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open:        { label: '요청 중',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_progress: { label: '진행 중',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  fulfilled:   { label: '완료',     cls: 'bg-green-50 text-green-700 border-green-200' },
  closed:      { label: '닫힘',     cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export default function Community() {
  const [requests, setRequests] = useState<CommunityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = filter ? `?status=${filter}` : '';
    api.get(`/community/requests${params}`)
      .then(r => setRequests(r.data.data))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">💬 커뮤니티 요청</h1>
        <button
          onClick={() => isLoggedIn ? navigate('/community/new') : navigate('/login')}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          + 요청하기
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        {[['', '전체'], ['open', '요청 중'], ['fulfilled', '완료'], ['closed', '닫힘']].map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              filter === val ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">📭</div>
          <p>아직 요청이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => {
            const sc = STATUS_LABEL[r.status] || STATUS_LABEL.open;
            return (
              <Link
                key={r.id}
                to={`/community/${r.id}`}
                className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{r.title}</p>
                    {r.doi && <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">{r.doi}</p>}
                  </div>
                  <span className={`shrink-0 text-xs border rounded-full px-2.5 py-0.5 font-medium ${sc.cls}`}>
                    {sc.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span>{r.author_nickname || '익명'}</span>
                  <span>·</span>
                  <span>응답 {r.response_count}개</span>
                  <span>·</span>
                  <span>조회 {r.view_count}</span>
                  <span>·</span>
                  <span>{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
