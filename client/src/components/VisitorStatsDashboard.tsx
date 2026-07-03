// client/src/components/VisitorStatsDashboard.tsx
// 어드민 대시보드 — 방문자 통계 시각화
// scholar-link 디자인 톤(slate + teal)에 맞춰 포팅

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getApiBaseURL } from '../services/api';

export interface VisitorStats {
  totalViews: number;
  uniqueSessions: number;
  todayViews: number;
  todayUnique: number;
  topPaths: { path: string; views: number; unique_visitors: number }[];
  dailyTrend: { day: string; views: number; unique_visitors: number }[];
  recentViews: {
    id: string;
    path: string;
    session_id: string;
    country: string | null;
    country_name: string | null;
    region: string | null;
    city: string | null;
    device_type: 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown' | null;
    created_at: string;
  }[];
  byCountry: {
    country_code: string;
    country_name: string | null;
    views: number;
    unique_visitors: number;
  }[];
  byRegion: { region: string; views: number; unique_visitors: number }[];
  byDevice: { device_type: string; views: number }[];
}

const DEFAULT_PERIODS = [7, 30, 90];

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  };
}

function authHeadersOnly() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` };
}

export function VisitorStatsDashboard() {
  const [stats, setStats] = useState<VisitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const api = getApiBaseURL();
    fetch(`${api}/admin/stats/visitors?days=${days}`, { headers: authHeadersOnly() })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(j => {
        if (cancelled) return;
        if (j.success) setStats(j.data);
        else throw new Error(j.message ?? '통계 조회 실패');
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err?.message ?? err));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-500">
        <div className="animate-spin h-4 w-4 border-2 border-teal-500 border-t-transparent rounded-full mr-2" />
        방문자 통계 로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        ⚠️ {error}
      </div>
    );
  }

  if (!stats) return null;

  const totalViews = stats.totalViews ?? 0;
  const maxViews = Math.max(1, ...stats.dailyTrend.map(d => d.views));
  const chartW = 800;
  const chartH = 200;
  const barWidth = Math.max(2, chartW / Math.max(1, stats.dailyTrend.length) - 4);

  return (
    <div className="space-y-6">
      {/* Period selector + back */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">📊 방문자 통계</h2>
        <div className="flex items-center gap-2">
          {DEFAULT_PERIODS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                days === d
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="오늘 조회수" value={stats.todayViews} accent="cyan" icon={<IconEye />} />
        <KpiCard label="오늘 순방문자" value={stats.todayUnique} accent="emerald" icon={<IconUsers />} />
        <KpiCard label={`${days}일 조회수`} value={totalViews} accent="blue" icon={<IconActivity />} />
        <KpiCard label={`${days}일 순방문자`} value={stats.uniqueSessions} accent="amber" icon={<IconUsers />} />
      </div>

      {/* Daily trend */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">일별 방문 추이</h3>
        <div className="overflow-x-auto">
          <svg width={chartW} height={chartH + 40} className="block mx-auto">
            {stats.dailyTrend.map((d, i) => {
              const x = i * (barWidth + 4) + 2;
              const h = (d.views / maxViews) * chartH;
              const y = chartH - h;
              return (
                <g key={i}>
                  <rect x={x} y={y} width={barWidth} height={h} fill="#14b8a6" rx="2" />
                  <text x={x + barWidth / 2} y={chartH + 15} textAnchor="middle" fontSize="10" fill="#6B7280">
                    {fmtDate(d.day)}
                  </text>
                  <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="10" fill="#374151" fontWeight="600">
                    {d.views}
                  </text>
                </g>
              );
            })}
            {stats.dailyTrend.length === 0 && (
              <text x={chartW / 2} y={chartH / 2} textAnchor="middle" fontSize="14" fill="#9CA3AF">
                아직 데이터가 없습니다
              </text>
            )}
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top paths */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">인기 페이지 TOP {stats.topPaths.length}</h3>
          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {stats.topPaths.length === 0 ? (
              <Empty text="데이터 없음" />
            ) : stats.topPaths.map((p, i) => (
              <div key={p.path} className="flex items-center gap-2 text-sm py-1">
                <span className="w-6 text-right font-mono text-xs text-slate-400">{i + 1}</span>
                <span className="flex-1 truncate font-mono text-xs text-slate-700">{p.path}</span>
                <span className="text-xs text-slate-400 shrink-0">{p.views.toLocaleString()}회</span>
                <span className="text-xs text-emerald-600 shrink-0">순 {p.unique_visitors.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Countries */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">🌍 국가별 방문</h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {stats.byCountry.length === 0 ? (
              <Empty text="데이터 없음" />
            ) : stats.byCountry.map(c => {
              const pct = totalViews > 0 ? (c.views / totalViews) * 100 : 0;
              return (
                <div key={c.country_code} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs font-bold w-10 text-slate-700">{c.country_code}</span>
                  <span className="flex-1 truncate text-xs text-slate-600">{c.country_name ?? c.country_code}</span>
                  <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 w-14 text-right">{c.views.toLocaleString()}회</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* KR regions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">🇰🇷 한국 지역별 방문</h3>
          {stats.byRegion.length === 0 ? (
            <Empty text="한국 트래픽이 아직 없습니다" />
          ) : (() => {
            const krTotal = stats.byRegion.reduce((s, r) => s + r.views, 0) || 1;
            return (
              <div className="space-y-2">
                {stats.byRegion.map(r => {
                  const pct = (r.views / krTotal) * 100;
                  return (
                    <div key={r.region} className="flex items-center gap-2">
                      <span className="text-sm w-28 truncate font-medium text-slate-700">{r.region}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-24 text-right">
                        {r.views.toLocaleString()}회 ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Devices */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">디바이스 분포</h3>
          <div className="space-y-2">
            {stats.byDevice.length === 0 ? (
              <Empty text="데이터 없음" />
            ) : (() => {
              const total = stats.byDevice.reduce((s, x) => s + x.views, 0) || 1;
              return stats.byDevice.map(d => {
                const pct = (d.views / total) * 100;
                return (
                  <div key={d.device_type} className="flex items-center gap-2">
                    {d.device_type === 'mobile' ? <IconMobile /> :
                     d.device_type === 'tablet' ? <IconTablet /> : <IconMonitor />}
                    <span className="text-sm w-20 capitalize text-slate-700">{d.device_type}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 w-20 text-right">{d.views.toLocaleString()}건 ({pct.toFixed(0)}%)</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Recent views */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">최근 방문 기록 (최근 {Math.min(20, stats.recentViews.length)}건)</h3>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {stats.recentViews.length === 0 ? (
              <Empty text="데이터 없음" />
            ) : stats.recentViews.slice(0, 20).map(v => (
              <div key={v.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-slate-50 last:border-0">
                <span className="font-mono truncate flex-1 text-slate-700">{v.path}</span>
                <span className="shrink-0 text-slate-400">
                  {v.country ?? '-'}{v.region ? ` / ${v.region}` : ''}
                  {v.device_type ? ` · ${v.device_type}` : ''}
                </span>
                <span className="shrink-0 w-24 text-right text-slate-400">{fmtTime(v.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub components ──

function KpiCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: number; accent: 'cyan' | 'emerald' | 'blue' | 'amber';
}) {
  const colorMap: Record<string, string> = {
    cyan:    'bg-cyan-50 text-cyan-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue:    'bg-blue-50 text-blue-600',
    amber:   'bg-amber-50 text-amber-600',
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={'flex h-9 w-9 items-center justify-center rounded-lg ' + colorMap[accent]}>
          {icon}
        </div>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-center py-6 text-slate-400">{text}</p>;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Inline icons (lucide-react 대체) ──
const ICON_PROPS = { className: 'h-4 w-4', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

function IconEye()    { return <svg {...ICON_PROPS}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>; }
function IconUsers()  { return <svg {...ICON_PROPS}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>; }
function IconActivity(){return <svg {...ICON_PROPS}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>; }
function IconMonitor(){return <svg {...ICON_PROPS}><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>; }
function IconMobile() { return <svg {...ICON_PROPS}><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>; }
function IconTablet() { return <svg {...ICON_PROPS}><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>; }