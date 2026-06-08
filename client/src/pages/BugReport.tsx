import { useState, useEffect } from 'react';
import { getApiBaseURL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import AuthModal from '../components/AuthModal';

const ADMIN_EMAIL = 'wheeljah@gmail.com';

type Status = 'open' | 'in_progress' | 'resolved';

interface Report {
  id: number;
  title: string;
  description: string;
  doi?: string;
  status: Status;
  created_at: string;
  nickname?: string;
  email?: string;
}

const STATUS_MAP: Record<Status, { label: string; className: string }> = {
  open:        { label: '미해결',   className: 'bg-red-100 text-red-700 border border-red-200' },
  in_progress: { label: '해결 중', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  resolved:    { label: '해결됨',  className: 'bg-green-100 text-green-700 border border-green-200' },
};

const NEXT_STATUS: Record<Status, Status> = {
  open: 'in_progress',
  in_progress: 'resolved',
  resolved: 'open',
};

export default function BugReport() {
  const { user, isLoggedIn } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', doi: '' });
  const [error, setError] = useState('');

  const fetchReports = async () => {
    try {
      const res = await fetch(`${getApiBaseURL()}/reports`);
      const json = await res.json();
      if (json.success) setReports(json.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${getApiBaseURL()}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) { setError(json.message || '오류가 발생했습니다.'); return; }
      setForm({ title: '', description: '', doi: '' });
      setShowForm(false);
      await fetchReports();
    } catch {
      setError('서버 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const cycleStatus = async (report: Report) => {
    const next = NEXT_STATUS[report.status];
    const res = await fetch(`${getApiBaseURL()}/reports/${report.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ status: next }),
    });
    const json = await res.json();
    if (json.success) {
      setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: next } : r));
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">에러 보고</h1>
          <p className="text-sm text-slate-500 mt-1">다운로드 실패, 오작동 등 문제를 보고해주세요.</p>
        </div>
        <button
          onClick={() => isLoggedIn ? setShowForm(v => !v) : setShowAuth(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          보고하기
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-800">새 에러 보고</h2>
          <input
            type="text"
            placeholder="제목 (예: 특정 DOI 다운로드 실패)"
            value={form.title}
            onChange={e => setForm(v => ({ ...v, title: e.target.value }))}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="관련 DOI (선택)"
            value={form.doi}
            onChange={e => setForm(v => ({ ...v, doi: e.target.value }))}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="어떤 문제가 발생했는지 자세히 설명해주세요."
            value={form.description}
            onChange={e => setForm(v => ({ ...v, description: e.target.value }))}
            rows={4}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">취소</button>
            <button type="submit" disabled={submitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-center text-slate-400 py-12">불러오는 중...</p>
      ) : reports.length === 0 ? (
        <p className="text-center text-slate-400 py-12">등록된 보고가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const s = STATUS_MAP[r.status];
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-800 text-sm leading-snug">{r.title}</p>
                  {isAdmin ? (
                    <button
                      onClick={() => cycleStatus(r)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 transition-opacity hover:opacity-70 ${s.className}`}
                    >
                      {s.label}
                    </button>
                  ) : (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${s.className}`}>
                      {s.label}
                    </span>
                  )}
                </div>
                {r.doi && (
                  <p className="text-xs text-blue-600 font-mono">DOI: {r.doi}</p>
                )}
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{r.description}</p>
                <p className="text-xs text-slate-400">
                  {r.nickname || r.email?.split('@')[0] || '익명'} · {new Date(r.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => { setShowAuth(false); setShowForm(true); }}
        description="에러 보고는 로그인 후 이용할 수 있습니다."
      />
    </div>
  );
}
