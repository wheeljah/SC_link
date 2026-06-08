import { useState, useRef } from 'react';
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
  const [paperMeta, setPaperMeta] = useState<{
    title?: string; authors?: string; year?: number;
    journal?: string; citationCount?: number;
  } | null>(null);
  const [result, setResult] = useState<{ filePath: string; fileSize: number; doi: string } | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportForm, setReportForm] = useState({ title: '', description: '', doi: '' });
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);
  const { isLoggedIn } = useAuth();
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const cancelDownload = () => {
    window.location.reload();
  };

  const handleButtonClick = () => {
    if (loading) { cancelDownload(); return; }
    if (!input.trim()) return;
    if (!isLoggedIn) { setShowAuth(true); return; }
    doDownload();
  };

  const doDownload = async () => {
    if (!input.trim()) return;
    cancelledRef.current = false;
    const abort = new AbortController();
    abortRef.current = abort;
    setLoading(true);
    setError('');
    setResult(null);
    setDirectUrl(null);
    setLogs([]);
    setPaperMeta(null);
    setProgress({ step: 'start', message: '요청 시작 중...', percent: 10 });

    try {
      const res = await fetch(`${getApiBaseURL()}/papers/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ input: input.trim() }),
        signal: abort.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        if (cancelledRef.current) break;
        const { value, done } = await reader.read();
        if (done || cancelledRef.current) break;
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
          if (event === 'metadata') setPaperMeta(payload as typeof paperMeta);
          if (event === 'complete') {
            if (payload.directUrl) {
              setDirectUrl(payload.directUrl as string);
            } else {
              setResult({ filePath: `${getBackendOrigin()}${payload.filePath}`, fileSize: payload.fileSize, doi: payload.doi });
            }
          }
          if (event === 'error') setError(payload.message);
        }
      }
    } catch (e) {
      if (!cancelledRef.current) {
        setError('다운로드 중 오류가 발생했습니다.');
      }
    } finally {
      if (cancelledRef.current) {
        setError('검색이 중지되었습니다.');
      }
      cancelledRef.current = false;
      abortRef.current = null;
      setLoading(false);
      setProgress(null);
    }
  };

  const openReportForm = () => {
    if (!isLoggedIn) { setShowAuth(true); return; }
    const doi = result?.doi || (input.includes('/') ? input.trim() : '');
    setReportForm(v => ({ ...v, doi }));
    setShowReportForm(v => !v);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportForm.title.trim() || !reportForm.description.trim()) return;
    setReportSubmitting(true);
    setReportError('');
    setReportSuccess(false);
    try {
      const res = await fetch(`${getApiBaseURL()}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(reportForm),
      });
      const json = await res.json();
      if (!json.success) { setReportError(json.message || '오류가 발생했습니다.'); return; }
      setReportForm({ title: '', description: '', doi: '' });
      setReportSuccess(true);
      setTimeout(() => { setShowReportForm(false); setReportSuccess(false); }, 2000);
    } catch {
      setReportError('서버 오류가 발생했습니다.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleDownload = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !input.trim()) return;
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
          학술논문/도서, 한 번에 검색/다운로드
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
            type="button"
            onClick={handleButtonClick}
            disabled={!loading && !input.trim()}
            className={`font-semibold px-6 py-3 rounded-xl transition-colors shrink-0 text-white ${
              loading
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400'
            }`}
          >
            {loading ? '검색 중지' : '다운로드'}
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
            <p className="text-xs text-blue-500 mt-1">
              찾기 어려우시면 아래 커뮤니티 요청으로 다른 연구자에게 요청해보세요.
            </p>
          </div>
        )}

        {paperMeta?.title && (
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm space-y-0.5">
            <p className="font-semibold text-slate-800 leading-snug">{paperMeta.title}</p>
            {paperMeta.authors && <p className="text-slate-500 text-xs truncate">{paperMeta.authors}</p>}
            <div className="flex gap-3 text-xs text-slate-400 mt-1">
              {paperMeta.year    && <span>&#128197; {paperMeta.year}</span>}
              {paperMeta.journal && <span className="truncate">&#128214; {paperMeta.journal}</span>}
              {paperMeta.citationCount !== undefined && <span>&#128172; 인용 {paperMeta.citationCount.toLocaleString()}회</span>}
            </div>
          </div>
        )}

        {directUrl && (
          <div className={`mt-4 rounded-xl p-4 border ${
            directUrl.includes('doi.org') && !directUrl.includes('sci-hub')
              ? 'bg-amber-50 border-amber-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                {directUrl.includes('sci-hub') ? (
                  <>
                    <p className="text-sm font-semibold text-blue-800">Sci-Hub 직접 열기</p>
                    <p className="text-xs text-blue-600 mt-1">서버 IP가 차단되어 브라우저에서 직접 다운로드하세요.</p>
                  </>
                ) : directUrl.includes('doi.org') ? (
                  <>
                    <p className="text-sm font-semibold text-amber-800">무료 전문을 찾지 못했습니다</p>
                    <p className="text-xs text-amber-700 mt-1">출판사 페이지에서 오픈 액세스 또는 구독 여부를 확인해보세요.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-blue-800">출판사 OA 논문 &#8212; 브라우저에서 직접 열기</p>
                    <p className="text-xs text-blue-600 mt-1">서버 IP 제한으로 직접 링크를 제공합니다.</p>
                  </>
                )}
              </div>
              <a
                href={directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shrink-0 ml-3 ${
                  directUrl.includes('doi.org') && !directUrl.includes('sci-hub')
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {directUrl.includes('doi.org') && !directUrl.includes('sci-hub') ? '출판사 페이지' : 'PDF 열기'}
              </a>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-green-800">다운로드 완료!</p>
                <p className="text-xs text-green-600 mt-1">DOI: {result.doi} &middot; {(result.fileSize / 1024 / 1024).toFixed(1)} MB</p>
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

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">에러 보고</h3>
            <p className="text-sm text-slate-500 mt-0.5">다운로드 실패, 오작동 등 문제를 알려주세요.</p>
          </div>
          <button
            onClick={openReportForm}
            className="shrink-0 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            보고하기
          </button>
        </div>

        {showReportForm && (
          <form onSubmit={handleReportSubmit} className="space-y-3 mt-4 pt-4 border-t border-slate-100">
            <input
              type="text"
              placeholder="제목 (예: 특정 DOI 다운로드 실패)"
              value={reportForm.title}
              onChange={e => setReportForm(v => ({ ...v, title: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="관련 DOI (선택)"
              value={reportForm.doi}
              onChange={e => setReportForm(v => ({ ...v, doi: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="어떤 문제가 발생했는지 설명해주세요."
              value={reportForm.description}
              onChange={e => setReportForm(v => ({ ...v, description: e.target.value }))}
              rows={3}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            {reportError && <p className="text-sm text-red-600">{reportError}</p>}
            {reportSuccess && <p className="text-sm text-green-600">보고가 등록되었습니다. 감사합니다!</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowReportForm(false)}
                className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">취소</button>
              <button type="submit" disabled={reportSubmitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors">
                {reportSubmitting ? '등록 중...' : '등록'}
              </button>
            </div>
          </form>
        )}

        <Link to="/report" className="text-xs text-slate-400 hover:text-slate-600 mt-3 inline-block">
          전체 보고 목록 &rarr;
        </Link>
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
