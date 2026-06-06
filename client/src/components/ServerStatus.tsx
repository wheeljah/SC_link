import { useState, useEffect } from 'react';
import { DownloadServer } from '../types';
import api, { getBackendOrigin, initPromise } from '../services/api';

const STATUS_CONFIG = {
  ONLINE:   { dot: 'bg-green-500',  label: 'Online',    text: 'text-green-700'  },
  SLOW:     { dot: 'bg-orange-400', label: 'Slow',      text: 'text-orange-700' },
  CHECKING: { dot: 'bg-yellow-400', label: 'Checking',  text: 'text-yellow-700' },
  OFFLINE:  { dot: 'bg-red-500',    label: 'Offline',   text: 'text-red-700'    },
  BLOCKED:  { dot: 'bg-slate-500',  label: 'Blocked',   text: 'text-slate-700'  },
  HIDDEN:   { dot: 'bg-slate-200',  label: 'Hidden',    text: 'text-slate-500'  },
};

export default function ServerStatus({ compact = false }: { compact?: boolean }) {
  const [servers, setServers] = useState<DownloadServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let es: EventSource | null = null;

    // Wait for backend URL to be resolved before making requests
    initPromise.then(() => {
      api.get('/servers/status')
        .then(res => setServers(res.data.data))
        .catch(() => {})
        .finally(() => setLoading(false));

      // SSE 실시간 업데이트 — use absolute backend URL
      es = new EventSource(`${getBackendOrigin()}/api/v1/servers/sse`);
      es.onmessage = (e) => {
        try { setServers(JSON.parse(e.data)); } catch { /* noop */ }
      };
    });

    return () => { if (es) es.close(); };
  }, []);

  if (loading) {
    return <div className="animate-pulse h-24 bg-slate-100 rounded-xl" />;
  }

  const display = compact ? servers.slice(0, 4) : servers;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <span>📡</span> 서버 상태
        </h3>
        <span className="text-xs text-slate-400">실시간</span>
      </div>
      <div className="divide-y divide-slate-50">
        {display.map(s => {
          const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.OFFLINE;
          return (
            <div key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                <span className="text-sm font-medium text-slate-800 truncate">{s.name}</span>
                {s.requires_login && (
                  <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
                    🔐 계정 필요
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                {s.avg_latency > 0 && (
                  <span className="text-xs text-slate-400">{s.avg_latency}ms</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
