import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ServerStatus from '../components/ServerStatus';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ step: string; message: string; percent: number } | null>(null);
  const [result, setResult] = useState<{ filePath: string; fileSize: number; doi: string } | null>(null);
  const [error, setError] = useState('');
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    setProgress({ step: 'start', message: '요청 시작 중...', percent: 10 });

    try {
      const res = await fetch('/api/v1/papers/download', {
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
          if (event === 'complete') setResult({ filePath: payload.filePath, fileSize: payload.fileSize, doi: payload.doi });
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

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* 히어로 섹션 */}
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          학술 논문, 한 번에 다운로드
        </h1>
        <p className="text-slate-500">DOI, PubMed ID, arXiv ID, 저널 URL을 입력하면 바로 다운로드됩니다.</p>
      </div>

      {/* 비로그인 상태: 검색 폼 숨김 */}
      {!isLoggedIn && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">로그인 후 이용 가능합니다</h2>
          <p className="text-sm text-slate-500 mb-4">논문 검색과 다운로드는 로그인 후 이용 가능합니다.</p>
          <button
            onClick={() => navigate('/login', { state: { from: '/' } })}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
          >
            로그인하기
          </button>
          <p className="text-xs text-slate-400 mt-3">
            계정이 없으신가요?{' '}
            <Link to="/register" className="text-blue-600 hover:underline">회원가입</Link>
          </p>
        </div>
      )}

      {/* 로그인 상태: 다운로드 폼 + 서브 섹션 */}
      {isLoggedIn && (
        <>
        <form onSubmit={handleDownload} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="DOI, PMID, arXiv ID, 또는 저널 URL 입력..."
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
          </p>

          {/* 진행 상황 */}
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
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                <span className="font-semibold">💡 진행 중:</span> 서버 연결 → 논문 검색 → PDF 확보 → 저장 순으로 진행됩니다. 通常 10~30초 소요됩니다.
              </div>
            </div>
          )}

          {/* 결과 */}
          {result && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-800">✅ 다운로드 완료!</p>
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

          {/* 에러 */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-700">❌ {error}</p>
            </div>
          )}
        </form>

        {/* 서버 상태 */}
        <ServerStatus compact />

        {/* 커뮤니티 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <span>💬</span> 커뮤니티 요청
            </h3>
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
        </>
      )}
    </div>
  );
}