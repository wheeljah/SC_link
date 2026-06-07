import { useState } from 'react';
import { Link } from 'react-router-dom';
import ServerStatus from '../components/ServerStatus';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../context/AuthContext';
import { getApiBaseURL, getBackendOrigin } from '../services/api';

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ step: string; message: string; percent: number } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [result, setResult] = useState<{ filePath: string; fileSize: number; doi: string } | null>(null);
  const [error, setError] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const { isLoggedIn } = useAuth();

  const doDownload = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setLogs([]);
    setProgress({ step: 'start', message: '요청 시작 중...', percent: 10 });

    try {
      const res = await fetch(`${getApiBaseURL()}/papers/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ input: input.trim() }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const part of parts) {
          const lines = part.split('\n');
          let event = 'message', data = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) event = line.slice(7);
            if (line.startsWith('data: ')) data = line.slice(6);
          }
          if (!data) continue;
          const payload = JSON.parse(data);
          if (event === 'progress') setProgress({ step: payload.step, message: payload.message, percent: payload.progress });
          if (event === 'log') setLogs(prev => [...prev, payload.message as string]);
          if (event === 'complete') setResult({ filePath: `${getBackendOrigin()}${payload.filePath}`, fileSize: payload.fileSize, doi: payload.doi });
          if (event === 'error') setError(payload.message);
        }
      }
    } catch {
      setError('다운로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleDownload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (!isLoggedIn) {
      setShowAuth(true);
      return;
    }
    doDownload();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          학술 논문, 한 번에 다운로드
        </h1>
        <p className="text-slate-500">DOI, PubMed ID, arXiv ID, 저널 URL을 입력하면 바로 다운로드됩니다.</p>
      </div>

      <form onSubmit={handleDownload} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="DOI, PMID, arXiv ID, 논문 제목, 또는 저널 URL 입력..."
            className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors shrink-0"
          >
            {loading ? '...' : '다운로드'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 px-1">
          예시: <code className="bg-slate-100 px-1 rounded">10.1038/nature12373</code>
          &nbsp;|&nbsp;<code className="bg-slate-100 px-1 rounded">PMID: 29988009</code>
          &nbsp;|&nbsp;<code className="bg-slate-100 px-1 rounded">arXiv:2103.14030</code>
          &nbsp;|&nbsp;<code className="bg-slate-100 px-1 rounded">Attention is all you need</code>
        </p>

        {progress && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{progress.message}</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            {logs.length > 0 && (
              <div className="bg-slate-950 rounded-lg px-3 py-2 max-h-40 overflow-y-auto font-mono text-xs">
                {logs.map((log, i) => {
                  const isOk  = log.startsWith('✅');
                  const isFail = log.startsWith('✗');
                  const color = isOk ? 'text-green-400' : isFail ? 'text-red-400' : 'text-slate-300';
                  return (
                    <div key={i} className={`leading-5 ${color}`}>
                      {log}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-slate-400">논문에 따라 시간이 많이 소요될 수 있습니다.</p>
          </div>
        )}

        {result && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-800">다운로드 완료!</p>
                <p className="text-xs text-green-600 mt-1">DOI: {result.doi} · {(result.fileSize / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <a
                href={result.filePath}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                PDF 열기
              </a>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
            <p className="text-sm text-red-700">{error}</p>
            <p className="text-xs text-slate-500">
              아래 커뮤니티 요청으로 다른 연구자에게 요청해보세요.
            </p>
          </div>
        )}
      </form>

      <ServerStatus compact />

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800">커뮤니티 요청</h3>
          <Link to="/community" className="text-sm text-blue-600 hover:underline">전체 보기</Link>
        </div>
        <p className="text-sm text-slate-500">원하는 논문을 요청하거나, 다른 연구자의 요청에 응답하세요.</p>
        <div className="mt-3 flex gap-2">
          <Link
            to="/community"
            className="text-sm border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg transition-colors"
          >
            요청 목록
          </Link>
          <Link
            to="/community/new"
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            요청하기
          </Link>
        </div>
      </div>

      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => { setShowAuth(false); doDownload(); }}
        description="논문 검색·다운로드는 로그인 후 이용할 수 있습니다."
      />
    </div>
  );
}
