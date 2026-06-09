import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DownloadServer } from '../types';
import api, { initPromise } from '../services/api';

const TYPE_BADGE: Record<string, string> = {
  scihub:   'bg-teal-50 text-teal-600 border-teal-100',
  libgen:   'bg-violet-50 text-violet-600 border-violet-100',
  archive:  'bg-amber-50 text-amber-600 border-amber-100',
  zlibrary: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  ia:       'bg-sky-50 text-sky-600 border-sky-100',
};
const TYPE_LABEL: Record<string, string> = {
  scihub: 'Sci-Hub', libgen: 'LibGen', archive: "Anna's", zlibrary: 'Z-Lib', ia: 'IA',
};

export default function ServerStatus({ compact = false }: { compact?: boolean }) {
  const [servers, setServers] = useState<DownloadServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initPromise.then(() => {
      api.get('/servers/status')
        .then(res => setServers(res.data.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <span>📡</span><span>검색 서버</span>
          </h3>
        </div>
        <div className="divide-y divide-slate-50">
          {[72, 96, 64, 88, 80].map((w, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-3 bg-slate-200 rounded animate-pulse" style={{ width: `${w}px` }} />
                <div className="h-3 w-10 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <span>📡</span><span>검색 서버</span>
        </h3>
        <span className="text-xs text-green-600 font-medium">{servers.length}개 준비됨</span>
      </div>

      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <p className="text-xs text-slate-500">검색 요청 시 자동으로 최적 서버를 선택합니다.</p>
      </div>

      <div className={compact ? 'max-h-72 overflow-y-auto' : ''}>
        {servers.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">서버 정보 없음</div>
        ) : servers.map(s => {
          const typeBadge = TYPE_BADGE[s.type] ?? 'bg-slate-50 text-slate-500 border-slate-100';
          const typeLabel = TYPE_LABEL[s.type] ?? s.type;
          return (
            <div key={s.id} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                <span className="text-sm text-slate-800 truncate">{s.name}</span>
                <span className={`text-xs border rounded px-1.5 py-0.5 shrink-0 leading-tight ${typeBadge}`}>{typeLabel}</span>
                {s.requires_login && (
                  <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded px-1 py-0.5 shrink-0">🔐</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
        <span className="text-xs text-slate-400">총 {servers.length}개 서버</span>
      </div>
    </div>
  );
}
