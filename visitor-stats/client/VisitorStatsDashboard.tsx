// lib/visitor-stats/client/VisitorStatsDashboard.tsx
// 재사용 가능한 어드민 대시보드 — 통계 시각화
// 다른 서비스에서 가져다 쓰기만 하면 됨
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, Users, Activity, Smartphone, Monitor, Tablet, Loader2 } from 'lucide-react'
import type { VisitorStats } from '../server/types'

export interface VisitorStatsDashboardProps {
  /** API endpoint (기본 '/api/visitor-stats') */
  endpoint?: string
  /** 후크 인증 미들웨어 경로 (401 시 redirect) */
  loginPath?: string
  /** 401 시 동작: 'redirect' = 페이지 이동, 'logout' = localStorage 정리 */
  onUnauthorized?: 'redirect' | 'logout' | 'silent'
  /** 페이지 타이틀 */
  title?: string
  /** 대시보드 상단 좌측에 표시할 breadcrumb / back link */
  backHref?: string
  /** 사용 가능 기간 옵션 (일) */
  periodOptions?: number[]
  /** 다크모드 사용 */
  darkMode?: boolean
  /** 통화 / 지역화용 locale */
  locale?: 'ko' | 'en' | string
}

const DEFAULT_PERIODS = [7, 30, 90, 365]

export function VisitorStatsDashboard({
  endpoint = '/api/visitor-stats',
  loginPath = '/admin',
  onUnauthorized = 'redirect',
  title = '웹페이지 방문자 통계',
  backHref,
  periodOptions = DEFAULT_PERIODS,
  darkMode = false,
  locale = 'ko',
}: VisitorStatsDashboardProps) {
  const router = useRouter()
  const [stats, setStats] = useState<VisitorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(periodOptions[1] || 30)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`${endpoint}?days=${days}`)
      .then(r => {
        if (r.status === 401) {
          if (onUnauthorized === 'redirect') router.push(loginPath)
          if (onUnauthorized === 'logout') {
            try { localStorage.clear(); sessionStorage.clear() } catch {}
          }
          return null
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        if (cancelled) return
        if (d) setStats(d)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(String(err))
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [days, endpoint, loginPath, onUnauthorized, router])

  // 안전한 통계 (null/undefined 필드 → 빈 배열/0)
  const safe: VisitorStats = {
    totalViews: stats?.totalViews ?? 0,
    uniqueSessions: stats?.uniqueSessions ?? 0,
    todayViews: stats?.todayViews ?? 0,
    todayUnique: stats?.todayUnique ?? 0,
    topPaths: stats?.topPaths ?? [],
    dailyTrend: stats?.dailyTrend ?? [],
    recentViews: stats?.recentViews ?? [],
    byCountry: stats?.byCountry ?? [],
    byRegion: stats?.byRegion ?? [],
    byDevice: stats?.byDevice ?? stats?.recentViews?.reduce<Record<string, number>>((acc, v) => {
      const d = v.device_type ?? 'unknown'
      acc[d] = (acc[d] ?? 0) + 1
      return acc
    }, {})
      ? Object.entries(stats!.recentViews!.reduce<Record<string, number>>((acc, v) => {
          const d = v.device_type ?? 'unknown'
          acc[d] = (acc[d] ?? 0) + 1
          return acc
        }, {})).map(([device_type, views]) => ({ device_type, views }))
      : [],
  }

  const maxViews = Math.max(1, ...safe.dailyTrend.map(d => d.views))
  const chartW = 800
  const chartH = 200
  const barWidth = Math.max(1, chartW / Math.max(1, safe.dailyTrend.length) - 4)

  // 스타일 헬퍼
  const base = darkMode ? 'min-h-screen bg-gray-900 text-gray-100' : 'min-h-screen bg-gray-50 text-gray-900'
  const card = darkMode ? 'rounded-xl border border-gray-700 bg-gray-800' : 'rounded-xl border border-gray-200 bg-white'
  const sub = darkMode ? 'text-gray-400' : 'text-gray-500'
  const head = darkMode ? 'text-gray-200' : 'text-gray-700'

  return (
    <div className={base}>
      <header className={darkMode ? 'border-b border-gray-700 bg-gray-800 px-6 py-4 flex items-center justify-between' : 'border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between'}>
        <div className="flex items-center gap-3">
          {backHref && (
            <Link href={backHref} className={sub + ' hover:opacity-80'}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <h1 className="text-lg font-bold">{title}</h1>
        </div>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className={darkMode ? 'rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-100' : 'rounded-lg border border-gray-300 px-3 py-1.5 text-sm'}
        >
          {periodOptions.map(d => (
            <option key={d} value={d}>
              {d === 7 ? '최근 7일' : d === 30 ? '최근 30일' : d === 90 ? '최근 90일' : d === 365 ? '최근 1년' : `${d}일`}
            </option>
          ))}
        </select>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> 로딩 중…
          </div>
        ) : error ? (
          <div className={'rounded-xl border p-6 text-center text-sm ' + (darkMode ? 'border-red-700 bg-red-900/20 text-red-300' : 'border-red-200 bg-red-50 text-red-600')}>
            ⚠️ {error}
          </div>
        ) : (
          <>
            {/* KPI */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard icon={<Eye className="h-5 w-5" />} label="오늘 조회수" value={safe.todayViews} color="cyan" dark={darkMode} />
              <KpiCard icon={<Users className="h-5 w-5" />} label="오늘 순방문자" value={safe.todayUnique} color="emerald" dark={darkMode} />
              <KpiCard icon={<Activity className="h-5 w-5" />} label={`${days}일 조회수`} value={safe.totalViews} color="blue" dark={darkMode} />
              <KpiCard icon={<Users className="h-5 w-5" />} label={`${days}일 순방문자`} value={safe.uniqueSessions} color="amber" dark={darkMode} />
            </section>

            {/* 일별 추이 */}
            <section className={card + ' p-6'}>
              <h2 className={'text-sm font-semibold mb-4 ' + head}>일별 방문 추이</h2>
              <div className="overflow-x-auto">
                <svg width={chartW} height={chartH + 40} className="block">
                  {safe.dailyTrend.map((d, i) => {
                    const x = i * (barWidth + 4) + 2
                    const h = (d.views / maxViews) * chartH
                    const y = chartH - h
                    return (
                      <g key={i}>
                        <rect x={x} y={y} width={barWidth} height={h} fill="#06B6D4" rx="2" />
                        <text x={x + barWidth / 2} y={chartH + 15} textAnchor="middle" fontSize="10" fill={darkMode ? '#9CA3AF' : '#6B7280'}>
                          {fmtDate(d.day, locale)}
                        </text>
                        <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="10" fill={darkMode ? '#E5E7EB' : '#374151'} fontWeight="600">
                          {d.views}
                        </text>
                      </g>
                    )
                  })}
                  {safe.dailyTrend.length === 0 && (
                    <text x={chartW / 2} y={chartH / 2} textAnchor="middle" fontSize="14" fill={darkMode ? '#6B7280' : '#9CA3AF'}>
                      아직 데이터가 없습니다
                    </text>
                  )}
                </svg>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* 인기 페이지 */}
              <section className={card + ' p-6'}>
                <h2 className={'text-sm font-semibold mb-4 ' + head}>인기 페이지 TOP {safe.topPaths.length}</h2>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {safe.topPaths.length === 0 ? <Empty text="데이터 없음" dark={darkMode} /> : safe.topPaths.map((p, i) => (
                    <div key={p.path} className="flex items-center gap-3 text-sm">
                      <span className={'w-6 text-right font-mono text-xs ' + sub}>{i + 1}</span>
                      <span className={'flex-1 truncate font-mono text-xs ' + head}>{p.path}</span>
                      <span className={'text-xs shrink-0 ' + sub}>{num(p.views, locale)}회</span>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0">순 {num(p.unique_visitors, locale)}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* 국가별 */}
              <section className={card + ' p-6'}>
                <h2 className={'text-sm font-semibold mb-4 ' + head}>🌍 국가별 방문</h2>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {safe.byCountry.length === 0 ? <Empty text="데이터 없음" dark={darkMode} /> : safe.byCountry.map(c => {
                    const pct = safe.totalViews > 0 ? (c.views / safe.totalViews) * 100 : 0
                    return (
                      <div key={c.country_code} className="flex items-center gap-3 text-sm">
                        <span className={'font-mono text-xs font-bold w-10 ' + head}>{c.country_code}</span>
                        <span className={'flex-1 truncate text-xs ' + head}>{c.country_name ?? c.country_code}</span>
                        <div className="w-24 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className={'text-xs shrink-0 w-16 text-right ' + sub}>{num(c.views, locale)}회</span>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* 디바이스 + 한국지역 */}
              <section className="space-y-6 lg:col-span-2">
                {/* 한국 지역 */}
                <div className={card + ' p-6'}>
                  <h2 className={'text-sm font-semibold mb-4 ' + head}>🇰🇷 한국 지역별 방문 (KR 트래픽)</h2>
                  {safe.byRegion.length === 0 ? <Empty text="한국 트래픽이 아직 없습니다" dark={darkMode} /> : (() => {
                    const krTotal = safe.byRegion.reduce((sum, r) => sum + r.views, 0) || 1
                    return (
                      <div className="space-y-2">
                        {safe.byRegion.map(r => {
                          const pct = (r.views / krTotal) * 100
                          return (
                            <div key={r.region} className="flex items-center gap-3">
                              <span className={'text-sm w-28 truncate font-medium ' + head}>{r.region}</span>
                              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className={'text-xs w-24 text-right ' + sub}>{num(r.views, locale)}회 ({pct.toFixed(0)}%)</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* 디바이스 */}
                  <div className={card + ' p-6'}>
                    <h2 className={'text-sm font-semibold mb-4 ' + head}>디바이스 분포 (최근 {safe.recentViews.length}건)</h2>
                    <div className="space-y-2">
                      {safe.byDevice.length === 0 ? <Empty text="데이터 없음" dark={darkMode} /> : safe.byDevice.map(d => {
                        const total = safe.byDevice.reduce((s, x) => s + x.views, 0) || 1
                        const pct = (d.views / total) * 100
                        const Icon = d.device_type === 'mobile' ? Smartphone : d.device_type === 'tablet' ? Tablet : Monitor
                        return (
                          <div key={d.device_type} className="flex items-center gap-3">
                            <Icon className={'h-4 w-4 shrink-0 ' + sub} />
                            <span className={'text-sm w-20 capitalize ' + head}>{d.device_type}</span>
                            <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                              <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className={'text-xs w-20 text-right ' + sub}>{d.views}건 ({pct.toFixed(0)}%)</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* 최근 방문 */}
                  <div className={card + ' p-6'}>
                    <h2 className={'text-sm font-semibold mb-4 ' + head}>최근 방문 기록</h2>
                    <div className="space-y-1 max-h-80 overflow-y-auto">
                      {safe.recentViews.slice(0, 20).map(v => (
                        <div key={v.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-gray-50 dark:border-gray-700 last:border-0">
                          <span className={'font-mono truncate flex-1 ' + head}>{v.path}</span>
                          <span className={'shrink-0 ' + sub}>{v.country ?? '-'}{v.region ? ` / ${v.region}` : ''}</span>
                          <span className={'shrink-0 w-24 text-right ' + sub}>{fmtTime(v.created_at, locale)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ---- Sub components ----

function KpiCard({ icon, label, value, color, dark }: { icon: React.ReactNode; label: string; value: number; color: string; dark?: boolean }) {
  const colorMap: Record<string, string> = {
    cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
  }
  return (
    <div className={(dark ? 'rounded-xl border border-gray-700 bg-gray-800' : 'rounded-xl border border-gray-200 bg-white') + ' p-5'}>
      <div className="flex items-center gap-2">
        <div className={'flex h-9 w-9 items-center justify-center rounded-lg ' + colorMap[color]}>{icon}</div>
        <p className={'text-xs ' + (dark ? 'text-gray-400' : 'text-gray-500')}>{label}</p>
      </div>
      <p className={'mt-2 text-2xl font-bold ' + (dark ? 'text-gray-100' : 'text-gray-900')}>{value.toLocaleString()}</p>
    </div>
  )
}

function Empty({ text, dark }: { text: string; dark?: boolean }) {
  return <p className={'text-sm text-center py-8 ' + (dark ? 'text-gray-500' : 'text-gray-400')}>{text}</p>
}

function num(n: number, locale: string) {
  return n.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')
}

function fmtDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })
}

function fmtTime(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}