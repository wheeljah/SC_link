import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

export default function CommunityNew() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [doi, setDoi] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('제목을 입력해주세요.'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/community/requests', { title, description, doi });
      navigate(`/community/${res.data.data.id}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || '요청 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/community" className="text-slate-400 hover:text-slate-600">← 뒤로</Link>
        <h1 className="text-xl font-bold text-slate-900">논문 요청하기</h1>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">제목 *</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
            placeholder="요청할 논문 제목 또는 설명을 입력하세요"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">DOI (알고 있다면)</label>
          <input type="text" value={doi} onChange={e => setDoi(e.target.value)}
            placeholder="10.1038/nature12373"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">상세 설명</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
            placeholder="PDF와 supplement data가 필요합니다..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors">
          {loading ? '등록 중...' : '요청 등록'}
        </button>
      </form>
    </div>
  );
}
