import { FormEvent, useState } from 'react';
import { PaperRecord, searchOpenAccessPaper } from '../services/oaSearch';

const EXAMPLES = ['10.1038/nature12373', 'PMID: 29988009', 'arXiv:1706.03762', 'Attention is all you need'];

function DetailRow({ label, value }: { label: string; value?: string | number }) {
  if (!value) return null;
  return <p><span className="font-medium text-slate-500">{label}</span> {value}</p>;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paper, setPaper] = useState<PaperRecord | null>(null);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setPaper(null);
    try {
      setPaper(await searchOpenAccessPaper(query));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <section id="search" className="text-center">
        <p className="mb-4 text-sm font-semibold text-brand-700">OPEN ACCESS DISCOVERY</p>
        <h1 className="text-4xl font-extrabold leading-tight text-slate-950 sm:text-5xl">오픈액세스 논문을<br />바로 찾으세요</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600">
          DOI, PMID, arXiv ID 또는 논문 제목으로 공식 메타데이터와 공개 원문 위치를 찾습니다.
          회원가입 없이 이용할 수 있습니다.
        </p>
      </section>

      <form onSubmit={onSearch} className="mt-10 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label className="sr-only" htmlFor="paper-query">논문 검색</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input id="paper-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="DOI, PMID, arXiv ID 또는 논문 제목 입력" className="min-w-0 flex-1 rounded-md border border-slate-300 px-4 py-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100" />
          <button type="submit" disabled={loading || !query.trim()} className="rounded-md bg-brand-700 px-5 py-3 font-semibold text-white transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? '공개 원문 찾는 중...' : '공개 원문 찾기'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map(example => <button key={example} type="button" onClick={() => setQuery(example)} className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700">{example}</button>)}
        </div>
      </form>

      {error && <p className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {paper && (
        <article className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold tracking-wide text-emerald-700">METADATA FOUND</p>
          <h2 className="mt-2 text-xl font-bold leading-7 text-slate-950">{paper.title}</h2>
          <div className="mt-4 space-y-1 text-sm leading-6 text-slate-700">
            <DetailRow label="저자" value={paper.authors.join(', ')} />
            <DetailRow label="저널" value={paper.journal} />
            <DetailRow label="연도" value={paper.year} />
            <DetailRow label="DOI" value={paper.doi} />
          </div>
          {paper.abstract && <p className="mt-4 border-l-2 border-brand-400 pl-3 text-sm leading-6 text-slate-600">{paper.abstract}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {paper.openAccessUrl ? (
              <a href={paper.openAccessUrl} target="_blank" rel="noreferrer" className="rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                {paper.openAccessSource ? `${paper.openAccessSource}에서 원문 열기` : '공개 원문 열기'}
              </a>
            ) : <span className="rounded-md bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">확인 가능한 공개 PDF 위치가 없습니다.</span>}
            <a href={paper.landingUrl} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-500">공식 논문 페이지</a>
          </div>
        </article>
      )}

      <section id="sources" className="mt-14 grid gap-4 sm:grid-cols-3">
        {[
          ['Crossref', 'DOI와 학술 메타데이터를 검색합니다.'],
          ['OpenAlex', '공개 원문 위치를 추가로 확인합니다.'],
          ['PubMed · arXiv', '의생명·프리프린트 공개 원문을 연결합니다.'],
        ].map(([name, description]) => <article key={name} className="rounded-lg border border-slate-200 bg-white p-5"><h2 className="font-bold text-slate-900">{name}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}
      </section>

      <section id="guide" className="mt-10 rounded-lg bg-slate-900 p-6 text-slate-100">
        <h2 className="text-lg font-bold">이용 안내</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">ScholarLink는 공개적으로 접근 가능한 학술 자료의 위치를 안내합니다. 저작권, 이용 조건 및 출판사 정책을 준수해 이용하세요.</p>
      </section>
    </div>
  );
}
