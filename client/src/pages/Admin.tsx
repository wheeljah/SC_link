import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBaseURL, initPromise } from '../services/api';
import UserStatsModal from '../components/UserStatsModal';
import { VisitorStatsDashboard } from '../components/VisitorStatsDashboard';
import { ADMIN_EMAIL, isAdminUser } from '../constants/auth';

interface Stats {
  user_count: number; download_count: number; bug_count: number;
  db_size: string; new_users_7d: number; downloads_7d: number;
}
interface User {
  id: number; email: string; nickname: string | null; tier: string;
  download_count: number; email_verified: boolean;
  last_login_at: string | null; created_at: string;
  region: string | null; region_ip: string | null;
}
interface Download {
  id: number; input_type: string; input_value: string;
  normalized_doi: string | null; title: string | null; status: string;
  file_size: number | null; user_email: string | null; created_at: string;
}
interface AllStatsSummary {
  aggregate: {
    user_count: number;
    searches_total: number;
    downloads_total: number;
    failed_total: number;
    downloads_today: number;
    downloads_7d: number;
    success_ratio: number;
  };
  leaderboard: Array<{
    id: number; email: string; nickname: string | null;
    downloads: number; searches: number; failures: number;
  }>;
  input_distribution: Array<{ input_type: string; cnt: number }>;
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` };
}

async function csvDownload(path: string, filename: string) {
  await initPromise;
  const res = await fetch(`${getApiBaseURL()}${path}`, { headers: authHeaders() });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Admin() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isAdminUser(user);

  const [tab, setTab] = useState<'users' | 'downloads' | 'visitors'>('users');
  const [stats, setStats] = useState<Stats | null>(null);
  const [allStats, setAllStats] = useState<AllStatsSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [dlTotal, setDlTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [dlPage, setDlPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deleteDays, setDeleteDays] = useState('30');
  const [msg, setMsg] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ id: number; email: string } | null>(null);

  const PER = 50;

  useEffect(() => {
    if (!isLoggedIn) { navigate('/login'); return; }
    if (!isAdmin)    { navigate('/');      return; }
  }, [isLoggedIn, isAdmin, navigate]);

  const loadStats = useCallback(async () => {
    await initPromise;
    const api = getApiBaseURL();
    const res = await fetch(`${api}/admin/stats`, { headers: authHeaders() });
    const j = await res.json();
    if (j.success) setStats(j.data);
  }, []);

  const loadAllStats = useCallback(async () => {
    await initPromise;
    const api = getApiBaseURL();
    try {
      const res = await fetch(`${api}/admin/stats/all`, { headers: authHeaders() });
      const j = await res.json();
      if (j.success) setAllStats(j.data);
    } catch { /* 무시 */ }
  }, []);

  const loadUsers = useCallback(async (page: number) => {
    await initPromise;
    const api = getApiBaseURL();
    setLoading(true);
    const res = await fetch(`${api}/admin/users?page=${page}&limit=${PER}`, { headers: authHeaders() });
    const j = await res.json();
    if (j.success) { setUsers(j.data); setUserTotal(j.total); }
    setLoading(false);
  }, []);

  const loadDownloads = useCallback(async (page: number) => {
    await initPromise;
    const api = getApiBaseURL();
    setLoading(true);
    const res = await fetch(`${api}/admin/downloads?page=${page}&limit=${PER}`, { headers: authHeaders() });
    const j = await res.json();
    if (j.success) { setDownloads(j.data); setDlTotal(j.total); }
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) { loadStats(); loadAllStats(); loadUsers(1); } }, [isAdmin, loadStats, loadAllStats, loadUsers]);
  useEffect(() => { if (isAdmin && tab === 'downloads') loadDownloads(dlPage); }, [isAdmin, tab, dlPage, loadDownloads]);
  useEffect(() => { if (isAdmin && tab === 'users')     loadUsers(userPage);     }, [isAdmin, tab, userPage, loadUsers]);

  const handleDeleteUser = async (id: number, email: string) => {
    if (!confirm(`${email} 계정을 삭제하시겠습니까?`)) return;
    await initPromise;
    const api = getApiBaseURL();
    await fetch(`${api}/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
    setUsers(prev => prev.filter(u => u.id !== id));
    setUserTotal(t => t - 1);
    setMsg('사용자 삭제 완료');
  };

  const handleDeleteOld = async () => {
    const days = parseInt(deleteDays);
    if (!days || days < 1) return;
    if (!confirm(`${days}일 이전 다운로드 기록을 삭제하시겠습니까?`)) return;
    await initPromise;
    const api = getApiBaseURL();
    const res = await fetch(`${api}/admin/downloads/old`, {
      method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ days }),
    });
    const j = await res.json();
    setMsg(`${j.deleted}건 삭제 완료`);
    loadDownloads(1); setDlPage(1); loadStats();
  }

  const handleResendUnverified = async () => {
    if (!confirm('미인증 사용자 전체에게 인증 메일을 재발송하시겠습니까?')) return;
    setMsg('발송 중...');
    await initPromise;
    const api = getApiBaseURL();
    const res = await fetch(`${api}/admin/resend-unverified`, { method: 'POST', headers: authHeaders() });
    const j = await res.json();
    setMsg(`재발송 완료: 성공 ${j.sent}건, 실패 ${j.failed}건 (총 ${j.total}명)`);
  };;

  if (!isAdmin) return null;

  const userPages = Math.ceil(userTotal / PER);
  const dlPages   = Math.ceil(dlTotal   / PER);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">관리자</h1>
        {msg && (
          <span className="text-sm text-green-600 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
            {msg}
          </span>
        )}
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: '총 가입자',       value: stats.user_count.toLocaleString() + '명',   sub: `+${stats.new_users_7d}명 (7일)` },
            { label: '총 다운로드',     value: stats.download_count.toLocaleString() + '건', sub: `+${stats.downloads_7d}건 (7일)` },
            { label: '에러 보고',       value: stats.bug_count.toLocaleString() + '건',    sub: '' },
            { label: 'DB 사용량',       value: stats.db_size,                               sub: 'Neon 무료: 512MB' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
              {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* 전체 사용자 통계 + 리더보드 */}
      {allStats && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">📊 전체 사용자 통계</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <AggregateCell label="전체 검색" value={allStats.aggregate.searches_total.toLocaleString()} sub="모든 사용자 합계" />
            <AggregateCell label="전체 다운로드" value={allStats.aggregate.downloads_total.toLocaleString()} sub={`성공 ${Math.round(allStats.aggregate.success_ratio * 100)}%`} />
            <AggregateCell label="오늘 다운로드" value={allStats.aggregate.downloads_today.toLocaleString()} sub={`+${allStats.aggregate.downloads_7d.toLocaleString()} (7일)`} />
            <AggregateCell label="전체 실패" value={allStats.aggregate.failed_total.toLocaleString()} sub="재시도 가능" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 리더보드 */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">🏆 다운로드 Top 10</h3>
              {allStats.leaderboard.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">아직 다운로드 데이터가 없습니다.</p>
              ) : (
                <div className="space-y-1">
                  {allStats.leaderboard.map((u, idx) => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUser({ id: u.id, email: u.email })}
                      className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
                    >
                      <span className={`w-5 text-center font-bold ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-400' : 'text-slate-300'}`}>
                        {idx + 1}
                      </span>
                      <span className="flex-1 truncate font-mono text-slate-700">{u.email}</span>
                      <span className="text-slate-400 shrink-0">검색 {u.searches}</span>
                      <span className="font-semibold text-teal-700 shrink-0">↓ {u.downloads}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 입력 유형 분포 (전체) */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">📥 입력 유형 분포</h3>
              {allStats.input_distribution.length === 0 ? (
                <p className="text-xs text-slate-400 py-4">아직 성공한 다운로드가 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {(() => {
                    const total = allStats.input_distribution.reduce((s, i) => s + i.cnt, 0);
                    const labelMap: Record<string, string> = {
                      doi: 'DOI', pmid: 'PubMed', arxiv: 'arXiv', url: 'URL', title: '논문 제목',
                    };
                    return allStats.input_distribution.map(it => (
                      <div key={it.input_type} className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-xs text-slate-500">{labelMap[it.input_type] || it.input_type}</span>
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-teal-500 h-full rounded-full"
                            style={{ width: `${(it.cnt / total) * 100}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs font-medium text-slate-700">
                          {Math.round((it.cnt / total) * 100)}%
                        </span>
                        <span className="w-10 text-right text-xs text-slate-400">
                          {it.cnt}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          {(['users', 'downloads', 'visitors'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-3 text-sm font-semibold transition-colors ${
                tab === t ? 'text-teal-600 border-b-2 border-teal-600' : 'text-slate-500 hover:text-slate-800'
              }`}>
              {t === 'users' ? `가입자 (${userTotal.toLocaleString()})` :
               t === 'downloads' ? `다운로드 이력 (${dlTotal.toLocaleString()})` :
               '방문자 통계'}
            </button>
          ))}
        </div>

        {tab === 'visitors' && (
          <div className="p-5">
            <VisitorStatsDashboard />
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* Action bar */}
          {tab === 'users' ? (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleResendUnverified}
                className="text-sm bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg transition-colors">
                미인증 재발송
              </button>
              <button
                onClick={() => csvDownload('/admin/export/users', `users_${new Date().toISOString().slice(0,10)}.csv`)}
                className="text-sm bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg transition-colors">
                CSV 내보내기
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="number" value={deleteDays} onChange={e => setDeleteDays(e.target.value)}
                  className="w-20 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  min={1} max={3650}
                />
                <span className="text-sm text-slate-500">일 이전 삭제</span>
                <button onClick={handleDeleteOld}
                  className="text-sm bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg transition-colors">
                  삭제
                </button>
              </div>
              <button
                onClick={() => csvDownload('/admin/export/downloads', `downloads_${new Date().toISOString().slice(0,10)}.csv`)}
                className="text-sm bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg transition-colors">
                CSV 내보내기
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <p className="text-center text-slate-400 py-8">불러오는 중...</p>
            ) : tab === 'users' ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="pb-2 pr-4">ID</th>
                    <th className="pb-2 pr-4">이메일</th>
                    <th className="pb-2 pr-4">닉네임</th>
                    <th className="pb-2 pr-4">인증</th>
                    <th className="pb-2 pr-4">다운로드</th>
                    <th className="pb-2 pr-4">가입일</th>
                    <th className="pb-2 pr-4">지역</th>
                    <th className="pb-2">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 pr-4 text-slate-400">{u.id}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{u.email}</td>
                      <td className="py-2 pr-4">{u.nickname || '-'}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${u.email_verified ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {u.email_verified ? '인증' : '미인증'}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{u.download_count}</td>
                      <td className="py-2 pr-4 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                      <td className="py-2 pr-4 text-xs text-slate-500">{u.region || u.region_ip || '-'}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSelectedUser({ id: u.id, email: u.email })}
                            className="text-xs text-teal-600 hover:text-teal-800 font-medium">
                            통계
                          </button>
                          {u.email !== ADMIN_EMAIL && (
                            <button onClick={() => handleDeleteUser(u.id, u.email)}
                              className="text-xs text-red-500 hover:text-red-700">
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="pb-2 pr-4">ID</th>
                    <th className="pb-2 pr-4">유저</th>
                    <th className="pb-2 pr-4">입력값</th>
                    <th className="pb-2 pr-4">DOI</th>
                    <th className="pb-2 pr-4">상태</th>
                    <th className="pb-2 pr-4">크기</th>
                    <th className="pb-2">요청일</th>
                  </tr>
                </thead>
                <tbody>
                  {downloads.map(d => (
                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 pr-4 text-slate-400">{d.id}</td>
                      <td className="py-2 pr-4 text-xs text-slate-500 max-w-[140px] truncate">{d.user_email || '-'}</td>
                      <td className="py-2 pr-4 text-xs max-w-[160px] truncate" title={d.input_value}>{d.input_value}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-teal-600 max-w-[160px] truncate">{d.normalized_doi || '-'}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          d.status === 'completed' ? 'bg-green-100 text-green-700' :
                          d.status === 'failed'    ? 'bg-red-100 text-red-600'    :
                          'bg-slate-100 text-slate-500'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs text-slate-400">
                        {d.file_size ? (d.file_size / 1024 / 1024).toFixed(1) + 'MB' : '-'}
                      </td>
                      <td className="py-2 text-xs text-slate-400">{new Date(d.created_at).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {(tab === 'users' ? userPages : dlPages) > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                disabled={(tab === 'users' ? userPage : dlPage) <= 1}
                onClick={() => tab === 'users' ? setUserPage(p => p - 1) : setDlPage(p => p - 1)}
                className="px-3 py-1 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                이전
              </button>
              <span className="text-sm text-slate-500">
                {tab === 'users' ? userPage : dlPage} / {tab === 'users' ? userPages : dlPages}
              </span>
              <button
                disabled={(tab === 'users' ? userPage : dlPage) >= (tab === 'users' ? userPages : dlPages)}
                onClick={() => tab === 'users' ? setUserPage(p => p + 1) : setDlPage(p => p + 1)}
                className="px-3 py-1 text-sm border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                다음
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 사용자 통계 모달 */}
      {selectedUser && (
        <UserStatsModal
          userId={selectedUser.id}
          email={selectedUser.email}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

function AggregateCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-900 mt-1">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
