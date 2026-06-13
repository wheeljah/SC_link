import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import ServerStatus from '../components/ServerStatus';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../context/AuthContext';
import { getApiBaseURL, getBackendOrigin } from '../services/api';

// ── 인라인 라인 아이콘 (의존성 없음) ──
type IconProps = { className?: string };
const svg = (p: React.ReactNode) => ({ className }: IconProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p}</svg>
);
const IconSearch = svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>);
const IconCalendar = svg(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>);
const IconBook = svg(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>);
const IconQuote = svg(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></>);
const IconUsers = svg(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>);
const IconAlert = svg(<><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>);
const IconArrow = svg(<><path d="M5 12h14M12 5l7 7-7 7" /></>);
const IconExternal = svg(<><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>);
const IconCheck = svg(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></>);
const IconDownload = svg(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5M12 15V3" /></>);

const EXAMPLES = [
  '10.1038/nature12373',
  '29988009',
  'arXiv:2103.14030',
  'Attention is all you need',
];

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
  const qrRef = useRef<HTMLDivElement>(null);

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
        setError('검색 중 오류가 발생했습니다.');
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

  const downloadQR = () => {
    const el = qrRef.current?.querySelector('svg');
    if (!el) return;
    const clone = el.cloneNode(true) as SVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.removeAttribute('class');
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scholarlink-qr.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      {/* 은은한 브랜드 배경 */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 -z-10
        bg-[radial-gradient(60%_120%_at_50%_-10%,rgba(26,172,218,0.16),transparent_70%)]" />

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* ── Hero ── */}
        <header className="text-center pt-4">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.15]">
            <span className="bg-gradient-to-r from-navy via-brand-700 to-brand-500 bg-clip-text text-transparent whitespace-pre-line">오픈액세스 논문 · 도서 통합 검색</span>
          </h1>
          <p className="mt-4 text-slate-500 text-base sm:text-lg">
            DOI · PubMed ID · arXiv ID · 저널 URL 입력으로 OA 논문과 학술 도서를 바로 검색합니다.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
            {['DOI', 'PMID', 'arXiv', '저널 URL'].map(t => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-semibold border border-brand-100">
                {t}
              </span>
            ))}
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold">
              23개 오픈액세스 소스
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 font-semibold border border-emerald-100">
              OA 서버 지속 업데이트 중
            </span>
          </div>
        </header>

        {/* ── 검색 커맨드 바 ── */}
        <form onSubmit={handleDownload} className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-soft">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <IconSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="DOI, PMID, arXiv ID, 논문 제목, 또는 저널 URL 입력..."
                className="w-full border border-slate-300 rounded-2xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition"
              />
            </div>
            <button
              type="button"
              onClick={handleButtonClick}
              disabled={!loading && !input.trim()}
              className={`font-semibold px-6 py-3.5 rounded-2xl transition-colors shrink-0 text-white ${
                loading
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400'
              }`}
            >
              {loading ? '검색 중지' : '검색하기'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 px-1">
            <span className="text-xs text-slate-400 mr-0.5">예시:</span>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                type="button"
                onClick={() => setInput(ex)}
                className="text-xs font-mono bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-500 px-2 py-1 rounded-md transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>

          {progress && (
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{progress.message}</span>
                <span className="font-semibold text-brand-700">{progress.percent}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-brand-700 rounded-full transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              {logs.length > 0 && (
                <div className="bg-navy/95 border border-slate-800 rounded-xl px-3 py-2 max-h-40 overflow-y-auto font-mono text-xs">
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
              <p className="text-xs text-brand-600 mt-1">
                찾기 어려우시면 아래 커뮤니티 요청으로 다른 연구자에게 요청해보세요.
              </p>
            </div>
          )}

          {paperMeta?.title && (
            <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-sm space-y-1">
              <p className="font-semibold text-navy leading-snug">{paperMeta.title}</p>
              {paperMeta.authors && <p className="text-slate-500 text-xs truncate">{paperMeta.authors}</p>}
              <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                {paperMeta.year && <span className="inline-flex items-center gap-1"><IconCalendar className="w-3.5 h-3.5" />{paperMeta.year}</span>}
                {paperMeta.journal && <span className="inline-flex items-center gap-1 truncate"><IconBook className="w-3.5 h-3.5 shrink-0" />{paperMeta.journal}</span>}
                {paperMeta.citationCount !== undefined && <span className="inline-flex items-center gap-1"><IconQuote className="w-3.5 h-3.5" />인용 {paperMeta.citationCount.toLocaleString()}회</span>}
              </div>
            </div>
          )}

          {directUrl && (
            <div className={`mt-4 rounded-2xl p-4 border ${
              directUrl.includes('doi.org') && !directUrl.includes('sci-hub')
                ? 'bg-amber-50 border-amber-200'
                : 'bg-brand-50 border-brand-200'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  {directUrl.includes('sci-hub') ? (
                    <>
                      <p className="text-sm font-semibold text-brand-800">Sci-Hub 직접 열기</p>
                      <p className="text-xs text-brand-700 mt-1">서버 IP가 차단되어 브라우저에서 직접 열어보세요.</p>
                    </>
                  ) : directUrl.includes('doi.org') ? (
                    <>
                      <p className="text-sm font-semibold text-amber-800">무료 전문을 찾지 못했습니다</p>
                      <p className="text-xs text-amber-700 mt-1">출판사 페이지에서 오픈 액세스 또는 구독 여부를 확인해보세요.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-brand-800">출판사 OA 논문 &#8212; 브라우저에서 직접 열기</p>
                      <p className="text-xs text-brand-700 mt-1">서버 IP 제한으로 직접 링크를 제공합니다.</p>
                    </>
                  )}
                </div>
                <a
                  href={directUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shrink-0 ${
                    directUrl.includes('doi.org') && !directUrl.includes('sci-hub')
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-brand-600 hover:bg-brand-700'
                  }`}
                >
                  <IconExternal className="w-4 h-4" />
                  {directUrl.includes('doi.org') && !directUrl.includes('sci-hub') ? '출판사 페이지' : 'PDF 열기'}
                </a>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <IconCheck className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">검색 완료!</p>
                    <p className="text-xs text-green-600 mt-1">DOI: {result.doi} &middot; {(result.fileSize / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                </div>
                <a
                  href={result.filePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shrink-0"
                >
                  <IconExternal className="w-4 h-4" />
                  PDF 열기
                </a>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5">
              <IconAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm text-red-700">{error}</p>
                <p className="text-xs text-slate-500">
                  아래 커뮤니티 요청으로 다른 연구자에게 요청해보세요.
                </p>
              </div>
            </div>
          )}
        </form>

        {/* ── QR 코드 ── */}
        <div className="flex flex-col items-center gap-2 py-2">
          <div ref={qrRef}>
            <QRCodeSVG
              value="https://wheeljah.github.io/SC_link/"
              size={96}
              bgColor="#ffffff"
              fgColor="#0f172a"
              level="M"
              className="rounded-lg border border-slate-100 p-1.5 shadow-sm"
            />
          </div>
          <p className="text-xs text-slate-400">모바일에서 바로 접속</p>
          <button
            type="button"
            onClick={downloadQR}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800 border border-brand-200 hover:bg-brand-50 rounded-lg px-2.5 py-1 transition-colors"
          >
            <IconDownload className="w-3.5 h-3.5" />
            SVG 다운로드
          </button>
        </div>

        <ServerStatus compact />

        {/* ── 커뮤니티 ── */}
        <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-soft transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="flex items-center gap-2 font-bold text-navy">
              <span className="grid place-items-center w-8 h-8 rounded-xl bg-brand-50 text-brand-600">
                <IconUsers className="w-4 h-4" />
              </span>
              커뮤니티 요청
            </h3>
            <Link to="/community" className="text-sm text-brand-700 font-medium hover:underline">전체 보기</Link>
          </div>
          <p className="text-sm text-slate-500">원하는 논문을 요청하거나, 다른 연구자의 요청에 응답하세요.</p>
          <div className="mt-4 flex gap-2">
            <Link
              to="/community"
              className="text-sm border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl transition-colors"
            >
              요청 목록
            </Link>
            <Link
              to="/community/new"
              className="text-sm bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl transition-colors"
            >
              요청하기
            </Link>
          </div>
        </section>

        {/* ── 에러 보고 ── */}
        <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-soft transition-shadow">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-bold text-navy">
              <span className="grid place-items-center w-8 h-8 rounded-xl bg-amber-50 text-amber-600">
                <IconAlert className="w-4 h-4" />
              </span>
              <span>
                에러 보고
                <span className="block text-sm font-normal text-slate-500 mt-0.5">검색 실패, 오작동 등 문제를 알려주세요.</span>
              </span>
            </h3>
            <button
              onClick={openReportForm}
              className="shrink-0 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              보고하기
            </button>
          </div>

          {showReportForm && (
            <form onSubmit={handleReportSubmit} className="space-y-3 mt-4 pt-4 border-t border-slate-100">
              <input
                type="text"
                placeholder="제목 (예: 특정 DOI 검색 실패)"
                value={reportForm.title}
                onChange={e => setReportForm(v => ({ ...v, title: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                type="text"
                placeholder="관련 DOI (선택)"
                value={reportForm.doi}
                onChange={e => setReportForm(v => ({ ...v, doi: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <textarea
                placeholder="어떤 문제가 발생했는지 설명해주세요."
                value={reportForm.description}
                onChange={e => setReportForm(v => ({ ...v, description: e.target.value }))}
                rows={3}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              {reportError && <p className="text-sm text-red-600">{reportError}</p>}
              {reportSuccess && <p className="text-sm text-green-600">보고가 등록되었습니다. 감사합니다!</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowReportForm(false)}
                  className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2">취소</button>
                <button type="submit" disabled={reportSubmitting}
                  className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
                  {reportSubmitting ? '등록 중...' : '등록'}
                </button>
              </div>
            </form>
          )}

          <Link to="/report" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-brand-600 mt-3 transition-colors">
            전체 보고 목록 <IconArrow className="w-3.5 h-3.5" />
          </Link>
        </section>


        {/* ── 하단 고지 ── */}
        <p className="text-xs text-slate-400 text-center leading-relaxed px-2 break-keep">
          <span>본 서비스는 오픈액세스(OA) 논문의 공개 링크를 탐색·제공합니다.</span>
          <br />
          <span>논문 저작권은 원저자 및 출판사에 있으며, ScholarLink는 저작물을 직접 호스팅하지 않습니다.</span>
          <br />
          <span>상단·하단 광고는 서비스 운영비 충당을 위한 것입니다.</span>
        </p>

                <AuthModal
          open={showAuth}
          onClose={() => setShowAuth(false)}
          onSuccess={() => { setShowAuth(false); doDownload(); }}
          description="논문 검색은 로그인 후 이용할 수 있습니다."
        />
      </div>
    </div>
  );
}
