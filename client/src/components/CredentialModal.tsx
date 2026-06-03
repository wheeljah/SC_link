import { useState } from 'react';
import { DownloadServer, ServerCredential } from '../types';
import api from '../services/api';

interface Props {
  server: DownloadServer;
  existing: ServerCredential | undefined;
  onClose: () => void;
  onSaved: () => void;
}

export default function CredentialModal({ server, existing, onClose, onSaved }: Props) {
  const [loginId, setLoginId] = useState(existing?.loginId || '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!loginId.trim() || !password.trim()) {
      setError('로그인 아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.put(`/servers/${server.id}/credentials`, { loginId: loginId.trim(), password });
      onSaved();
      onClose();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('자격증명을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      await api.delete(`/servers/${server.id}/credentials`);
      onSaved();
      onClose();
    } catch {
      setError('삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl">🔐</span>
          <div>
            <h2 className="font-bold text-lg text-slate-900">{server.name} 로그인 설정</h2>
            <p className="text-sm text-slate-500">개인 계정 정보를 입력하세요</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
          이 서버는 개인 계정이 필요합니다. 자격증명은 <strong>AES-256-GCM</strong>으로 암호화되어 저장됩니다.
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              로그인 아이디 (이메일 또는 ID)
            </label>
            <input
              type="text"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              placeholder={`${server.name} 계정 아이디`}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder={existing ? '새 비밀번호 (변경 시에만 입력)' : '비밀번호'}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? '저장 중...' : '저장하기'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
        </div>

        {existing && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-2">현재 설정됨: <strong>{existing.loginId}</strong></p>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="text-sm text-red-500 hover:text-red-700 transition-colors"
            >
              자격증명 삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
