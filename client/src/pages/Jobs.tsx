// client/src/pages/Jobs.tsx
// 🎓 커리어 — 국내 공고 목록 / 해외 공고 "구성 중" + 이메일 출시 알림
// W1 MVP

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchJobs, subscribeForeignInterest, type JobItem, type JobCategory } from '../services/api';

const FIELDS = ['AI', '바이오', '화학', '물리', '신소재', '에너지', '의학', '환경', 'ICT'];
const CATEGORIES: { value: JobCategory; label: string }[] = [
  { value: 'graduate', label: '대학원' },
  { value: 'postdoc', label: '박사후' },
  { value: 'researcher', label: '연구원' },
  { value: 'professor', label: '교수' },
  { value: 'staff', label: '행정직' },
];

export default function Jobs() {
  const nav = useNavigate();
  const [tab, setTab] = useState<'kr' | 'global'>('kr');
  const [items, setItems] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<JobCategory | ''>('');

  useEffect(() => {
    if (tab === 'kr') {
      void loadJobs();
    }
  }, [tab, keyword, category]);

  async function loadJobs() {
    setLoading(true);
    setError('');
    try {
      const res = await fetchJobs({
        region: 'kr',
        keyword: keyword || undefined,
        category: category || undefined,
        deadline_within: 90,
        limit: 30,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError((e as Error).message || '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">🎓 커리어</h1>
        <p className="text-slate-600">국내 대학원·연구기관 모집공고를 한곳에서</p>
      </header>

      {/* 탭 */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setTab('kr')}
          className={`px-5 py-3 font-medium transition-colors ${
            tab === 'kr'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          🇰🇷 국내 공고 {total > 0 && <span className="ml-1 text-sm text-slate-400">({total})</span>}
        </button>
        <button
          onClick={() => setTab('global')}
          className={`px-5 py-3 font-medium text-slate-400 cursor-not-allowed flex items-center gap-2`}
        >
          🌍 해외 공고
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            🔧 구성 중
          </span>
        </button>
      </div>

      {/* 국내 탭 */}
      {tab === 'kr' && (
        <>
          {/* 필터 */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6">
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="검색어 (제목·기관)"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as JobCategory | '')}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm"
              >
                <option value="">전체 분류</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={() => loadJobs()}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '불러오는 중…' : '🔄 새로고침'}
              </button>
            </div>
          </div>

          {/* 결과 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="bg-slate-50 border border-slate-200 text-slate-600 px-6 py-12 rounded-lg text-center">
              <p className="mb-2 text-lg">🔍 공고가 없습니다</p>
              <p className="text-sm">아직 수집된 공고가 없습니다. 다음 수집 중입니다.</p>
            </div>
          )}

          <div className="space-y-3">
            {items.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => nav(`/jobs/${job.id}`)} />
            ))}
          </div>
        </>
      )}

      {/* 해외 탭 (구성 중) */}
      {tab === 'global' && <ForeignComingSoon />}
    </div>
  );
}

function JobCard({ job, onClick }: { job: JobItem; onClick: () => void }) {
  const daysLeft = job.days_left;
  const urgent = daysLeft !== null && daysLeft <= 7;
  const soon = daysLeft !== null && daysLeft <= 30 && daysLeft > 7;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-sm cursor-pointer transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 mb-1 truncate">{job.title}</h3>
          <p className="text-sm text-slate-600 mb-2">
            {job.organization && <span className="mr-2">📍 {job.organization}</span>}
            {job.category && <span className="mr-2">💼 {CATEGORIES.find((c) => c.value === job.category)?.label}</span>}
          </p>
          {job.fields && job.fields.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {job.fields.slice(0, 4).map((f) => (
                <span key={f} className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {daysLeft !== null && (
            <span
              className={`text-xs font-bold px-2 py-1 rounded ${
                urgent
                  ? 'bg-red-100 text-red-700'
                  : soon
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              D-{daysLeft}
            </span>
          )}
          <span className="text-xs text-slate-400">{job.source_name}</span>
        </div>
      </div>
    </div>
  );
}

function ForeignComingSoon() {
  const [email, setEmail] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function toggleField(f: string) {
    setSelectedFields((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await subscribeForeignInterest(email, selectedFields);
      if (res.success) {
        setDone(true);
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert('등록 중 오류: ' + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-8 text-center">
        <p className="text-3xl mb-3">🎉</p>
        <p className="text-lg font-semibold text-slate-900 mb-2">등록 완료!</p>
        <p className="text-slate-600">해외 공고 출시되면 알려드릴게요.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-8">
      <div className="text-center mb-6">
        <p className="text-5xl mb-4">🌍</p>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">해외 공고</h2>
        <p className="text-slate-600">지금 열심히 준비하고 있습니다</p>
        <p className="text-sm text-slate-500 mt-3">
          Springer Nature · AAAS Science Careers · jobs.ac.uk · AAS · HigherEdJobs
        </p>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <h3 className="font-semibold text-slate-900 mb-3">📬 출시 알림 받기</h3>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div>
            <p className="text-sm text-slate-700 mb-2">관심 분야 (복수 선택)</p>
            <div className="flex flex-wrap gap-2">
              {FIELDS.map((f) => (
                <label
                  key={f}
                  className={`cursor-pointer px-3 py-1 rounded-full border text-sm transition-colors ${
                    selectedFields.includes(f)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f)}
                    onChange={() => toggleField(f)}
                    className="hidden"
                  />
                  {f}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !email}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '등록 중…' : '🔔 출시되면 알림 받기'}
          </button>
        </form>
      </div>
    </div>
  );
}