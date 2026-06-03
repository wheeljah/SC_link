import { useState, useEffect } from 'react';
import { DownloadServer, ServerCredential } from '../types';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import CredentialModal from '../components/CredentialModal';

const STATUS_CONFIG = {
  ONLINE:   { dot: 'bg-green-500',  badge: 'bg-green-50 text-green-700 border-green-200',   label: 'Online'   },
  SLOW:     { dot: 'bg-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Slow'     },
  CHECKING: { dot: 'bg-yellow-400', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Checking' },
  OFFLINE:  { dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200',           label: 'Offline'  },
  BLOCKED:  { dot: 'bg-slate-500',  badge: 'bg-slate-50 text-slate-700 border-slate-200',     label: 'Blocked'  },
  HIDDEN:   { dot: 'bg-slate-300',  badge: 'bg-white text-slate-500 border-slate-200',        label: 'Hidden'   },
};

const TYPE_LABELS: Record<string, string> = {
  scihub: 'Sci-Hub', libgen: 'LibGen', zlibrary: 'Z-Library', archive: "Anna's Archive",
};

export default function Servers() {
  const [servers, setServers] = useState<DownloadServer[]>([]);
  const [credentials, setCredentials] = useState<ServerCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalServer, setModalServer] = useState<DownloadServer | null>(null);
  const { isLoggedIn } = useAuth();

  const fetchServers = () =>
    api.get('/servers/status').then(r => setServers(r.data.data));

  const fetchCredentials = () => {
    if (!isLoggedIn) return;
    api.get('/servers/credentials').then(r => setCredentials(r.data.data)).catch(() => {});
  };

  useEffect(() => {
    Promise.all([fetchServers(), fetchCredentials() || Promise.resolve()])
      .finally(() => setLoading(false));

    const es = new EventSource('/api/v1/servers/sse');
    es.onmessage = e => { try { setServers(JSON.parse(e.data)); } catch { /* noop */ } };
    return () => es.close();
  }, [isLoggedIn]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await api.post('/servers/refresh'); setTimeout(fetchServers, 3000); }
    finally { setRefreshing(false); }
  };

  const grouped = Object.entries(TYPE_LABELS).map(([type, label]) => ({
    type, label, servers: servers.filter(s => s.type === type),
  }));

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">📡 서버 상태</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing || !isLoggedIn}
          className="text-sm border border-slate-200 hover:bg-slate-50 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          <span className={refreshing ? 'animate-spin' : ''}>🔄</span>
          {refreshing ? '확인 중...' : '새로고침'}
        </button>
      </div>

      {grouped.map(({ type, label, servers: grp }) => (
        grp.length > 0 && (
          <div key={type} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">{label}</h2>
            </div>
            <div className="divide-y divide-slate-50">
              {grp.map(s => {
                const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.OFFLINE;
                const cred = credentials.find(c => c.serverId === s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${cfg.dot}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800 text-sm">{s.name}</span>
                          {s.location && (
                            <span className="text-xs text-slate-400 hidden sm:inline">({s.location})</span>
                          )}
                        </div>
                        {s.avg_latency > 0 && (
                          <span className="text-xs text-slate-400">{s.avg_latency}ms · 성공률 {Math.round(s.success_rate)}%</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs border rounded-full px-2.5 py-0.5 font-medium ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                      {s.requires_login && isLoggedIn && (
                        <button
                          onClick={() => setModalServer(s)}
                          className={`text-xs px-2.5 py-0.5 rounded-full border font-medium transition-colors ${
                            cred
                              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {cred ? '🔐 설정됨' : '🔑 계정 설정'}
                        </button>
                      )}
                      {s.requires_login && !isLoggedIn && (
                        <span className="text-xs text-slate-400">로그인 필요</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ))}

      {modalServer && (
        <CredentialModal
          server={modalServer}
          existing={credentials.find(c => c.serverId === modalServer.id)}
          onClose={() => setModalServer(null)}
          onSaved={() => { fetchCredentials(); setModalServer(null); }}
        />
      )}
    </div>
  );
}
