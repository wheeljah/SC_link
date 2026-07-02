// client/src/pages/JobDetail.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { fetchJob, type JobItem } from '../services/api';

const CATEGORY_LABEL: Record<string, string> = {
  graduate: '대학원',
  postdoc: '박사후',
  researcher: '연구원',
  professor: '교수',
  staff: '행정직',
};

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [job, setJob] = useState<(JobItem & { summary: string; description_html: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const data = await fetchJob(parseInt(id));
        setJob(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-slate-500">
        불러오는 중…
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600 mb-4">공고를 찾을 수 없습니다.</p>
        <button onClick={() => nav('/jobs')} className="text-blue-600 hover:underline">
          ← 목록으로 돌아가기
        </button>
      </div>
    );
  }

  const daysLeft = job.days_left;
  const urgent = daysLeft !== null && daysLeft <= 7;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/jobs" className="text-sm text-slate-500 hover:text-slate-700 mb-4 inline-block">
        ← 목록으로
      </Link>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h1 className="text-2xl font-bold text-slate-900 flex-1">{job.title}</h1>
          {daysLeft !== null && (
            <span
              className={`shrink-0 text-sm font-bold px-3 py-1 rounded ${
                urgent ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}
            >
              D-{daysLeft}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-sm text-slate-600 mb-3">
          {job.organization && <span>📍 {job.organization}</span>}
          {job.category && <span>· 💼 {CATEGORY_LABEL[job.category] || job.category}</span>}
          {job.deadline && (
            <span>· ⏰ 마감 {new Date(job.deadline).toLocaleDateString('ko-KR')}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {job.fields?.map((f) => (
            <span key={f} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              {f}
            </span>
          ))}
        </div>
      </header>

      {/* 슬롯 1: 공고 본문 요약 */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
        <h2 className="text-lg font-semibold mb-3">📌 공고 본문 요약</h2>
        {job.summary ? (
          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{job.summary}</p>
        ) : (
          <p className="text-slate-400 italic">요약 정보가 없습니다.</p>
        )}
        <a
          href={job.canonical_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          원문 보기 →
        </a>
      </section>

      {/* 슬롯 2: 관련 공고 3건 (cross-link) — W2에서 구현, 지금은 placeholder */}
      <section className="bg-slate-50 border border-slate-200 rounded-lg p-6 mb-4">
        <h2 className="text-lg font-semibold mb-3">💼 관련 채용/공고</h2>
        <p className="text-slate-500 text-sm">W2에서 같은 분야 공고 3건 자동 노출 예정</p>
      </section>

      {/* 슬롯 3: 공고 등록하기 (B2B) */}
      <section className="bg-slate-50 border border-slate-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-3">📝 공고 등록하기</h2>
        <p className="text-slate-600 text-sm mb-3">
          대학원·연구소에서 직접 공고를 올리시겠어요?
        </p>
        <a
          href="mailto:hello@scholarlink.com?subject=공고 등록 문의"
          className="text-blue-600 hover:underline text-sm"
        >
          hello@scholarlink.com
        </a>
      </section>

      {/* 출처 박제 (§2.5 안전선 ④) */}
      <footer className="mt-6 text-xs text-slate-400 text-center">
        출처: <span className="font-medium text-slate-600">{job.source_name}</span> ·
        크롤링: {new Date(job.created_at).toLocaleString('ko-KR')} ·
        <a href={job.canonical_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600 hover:underline">
          원본 링크
        </a>
      </footer>
    </div>
  );
}