import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Response {
  id: number;
  message: string | null;
  file_url: string | null;
  file_size: number | null;
  created_at: string;
  responder_nickname: string;
}

interface Detail {
  id: number;
  title: string;
  description: string | null;
  doi: string | null;
  status: string;
  view_count: number;
  created_at: string;
  author_nickname: string;
  responses: Response[];
}

export default function CommunityDetail() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const fetchDetail = () =>
    api.get(`/community/requests/${id}`)
      .then(r => setDetail(r.data.data))
      .catch(() => navigate('/community'));

  useEffect(() => {
    fetchDetail().finally(() => setLoading(false));
  }, [id]);

  const handleRespond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !file) { setError('내용 또는 파일을 첨부해주세요.'); return; }
    setSubmitting(true); setError('');
    try {
      const fd = new FormData();
      if (message) fd.append('message', message);
      if (file) fd.append('file', file);
      await api.post(`/community/requests/${id}/respond`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(''); setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      fetchDetail();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || '응답 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    open:        { label: '요청 중',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    in_progress: { label: '진행 중',  cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    fulfilled:   { label: '완료',     cls: 'bg-green-50 text-green-700 border-green-200' },
    closed:      { label: '닫힘',     cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-100 rounded w-2/3" />
        <div className="h-32 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );

  if (!detail) return null;

  const sc = STATUS_LABEL[detail.status] || STATUS_LABEL.open;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/community" className="text-slate-400 hover:text-slate-600 text-sm">← 목록</Link>
      </div>

      {/* 요청 카드 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-bold text-xl text-slate-900 leading-snug">{detail.title}</h1>
          <span className={`shrink-0 text-xs border rounded-full px-2.5 py-0.5 font-medium ${sc.cls}`}>
            {sc.label}
          </span>
        </div>
        {detail.doi && (
          <p className="text-sm font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">{detail.doi}</p>
        )}
        {detail.description && (
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{detail.description}</p>
        )}
        <div className="flex gap-3 text-xs text-slate-400 pt-1">
          <span>{detail.author_nickname || '익명'}</span>
          <span>·</span>
          <span>조회 {detail.view_count}</span>
          <span>·</span>
          <span>{new Date(detail.created_at).toLocaleDateString('ko-KR')}</span>
        </div>
      </div>

      {/* 응답 목록 */}
      {detail.responses.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-slate-800">응답 {detail.responses.length}개</h2>
          {detail.responses.map(r => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-800">{r.responder_nickname || '익명'}</span>
                <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              {r.message && <p className="text-sm text-slate-600">{r.message}</p>}
              {r.file_url && (
                <a
                  href={r.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  📎 파일 다운로드
                  {r.file_size && <span className="text-blue-500">({(r.file_size / 1024 / 1024).toFixed(1)} MB)</span>}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 응답 폼 */}
      {isLoggedIn ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="font-semibold text-slate-800 mb-4">응답하기</h2>
          <form onSubmit={handleRespond} className="space-y-3">
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="논문 링크나 메시지를 남겨주세요..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div>
              <label className="block text-sm text-slate-600 mb-1">파일 첨부 (PDF, ZIP 등)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.zip,.rar,.tar,.gz"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium file:cursor-pointer hover:file:bg-blue-100"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              {submitting ? '등록 중...' : '응답 등록'}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-sm text-slate-500 mb-3">응답하려면 로그인이 필요합니다.</p>
          <Link to="/login" className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-block transition-colors">
            로그인
          </Link>
        </div>
      )}
    </div>
  );
}
