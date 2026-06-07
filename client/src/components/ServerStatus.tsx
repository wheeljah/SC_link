import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DownloadServer } from '../types';
import api, { getBackendOrigin, initPromise } from '../services/api';

const STATUS_CONFIG = {
  ONLINE:   { dot: 'bg-green-500',  label: 'Online',   text: 'text-green-700'  },
  SLOW:     { dot: 'bg-orange-400', label: 'Slow',     text: 'text-orange-700' },
  CHECKING: { dot: 'bg-yellow-400', label: 'Checking', text: 'text-yellow-700' },
  OFFLINE:  { dot: 'bg-red-500',    label: 'Offline',  text: 'text-red-700'    },
  BLOCKED:  { dot: 'bg-green-400',  label: 'Online',   text: 'text-green-600'  },
  HIDDEN:   { dot: 'bg-slate-200',  label: 'Hidden',   text: 'text-slate-500'  },
};

// BLOCKED = 서버가 살아있지만 데이터센터 IP 차단 → 사용자 브라우저에서는 정상 접속 가능
const ONLINE_STATUSES = ['ONLINE', 'SLOW', 'BLOCKED'];

const TYPE_BADGE: Record<string, string> = {
  scihub:   'bg-blue-50 text-blue-600 border-blue-100',
  libgen:   'bg-violet-50 text-violet-600 border-violet-100',
  archive:  'bg-amber-50 text-amber-600 border-amber-100',
  zlibrary: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  ia:       'bg-sky-50 text-sky-600 border-sky-100',
};
const TYPE_LABEL: Record<string, string> = {
  scihub: 'Sci-Hub', libgen: 'LibGen', archive: "Anna's", zlibrary: 'Z-Lib', ia: 'IA',
};

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function ServerStatus({ compact = false }: { compact?: boolean }) {
  const [servers, setServers] = useState<DownloadServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let es: EventSource | null = null;
    initPromise.then(() => {
      api.get('/servers/status')
        .then(res => setServers(res.data.data))
        .catch(() => {})
        .finally(() => setLoading(false));
      es = new EventSource(`${getBackendOrigin()}/api/v1/servers/sse`);
      es.onmessage = (e) => {
        try { setServers(JSON.parse(e.data)); } catch { /* noop */ }
      };
    });
    return () => { if (es) es.close(); };
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <span>📡</span>
            <span>서버 상태</span>
          </h3>
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block" />
            <span>확인 중</span>
          </span>
        </div>
        <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-start gap-2">
          <span className="text-blue-600 mt-0.5"><Spinner /></span>
          <div>
            <p className="text-xs text-blue-700">서버 상태를 불러오는 중입니다.</p>
            <p className="text-xs text-blue-500 mt-0.5">백엔드 최초 시작 시 30~60초 소요될 수 있습니다.</p>
          </div>
        </div>
        <div className="divide-y divide-slate-50">
          {[72, 96, 64, 88, 80].map((w, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-slate-200 animate-pulse shrink-0" />
                <div className="h-3 bg-slate-200 rounded animate-pulse" style={{ width: `${w}px` }} />
                <div className="h-3 w-10 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-3 w-10 bg-slate-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const onlineCount = servers.filter(s => ONLINE_STATUSES.includes(s.status)).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <span>📡</span>
          <span>서버 상태</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-600 font-medium">{onlineCount}개 온라인</span>
          <span className="text-xs text-slate-300">|</span>
          <span className="text-xs text-slate-400">실시간</span>
        </div>
      </div>

      <div className={compact ? 'max-h-72 overflow-y-auto' : ''}>
        {servers.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400">서버 정보 없음</div>
        ) : servers.map(s => {
          const cfg = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.OFFLINE;
          const typeBadge = TYPE_BADGE[s.type] ?? 'bg-slate-50 text-slate-500 border-slate-100';
          const typeLabel = TYPE_LABEL[s.type] ?? s.type;
          return (
            <div key={s.id} className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                <span className="text-sm text-slate-800 truncate">{s.name}</span>
                <span className={`text-xs border rounded px-1.5 py-0.5 shrink-0 leading-tight ${typeBadge}`}>{typeLabel}</span>
                {s.requires_login && (
                  <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 rounded px-1 py-0.5 shrink-0">🔐</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                {s.avg_latency > 0 && (
                  <span className="text-xs text-slate-400 hidden sm:inline">{s.avg_latency}ms</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between bg-slate-50">
        <span className="text-xs text-slate-400">총 {servers.length}개 서버</span>
        <Link to="/servers" className="text-xs text-blue-600 hover:underline font-medium">전체 관리 →</Link>
      </div>
    </div>
  );
}
