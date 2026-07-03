-- =============================================
-- visitor-stats 모듈 — Supabase 초기 스키마
-- =============================================
-- 사용법: Supabase SQL Editor에서 실행
-- 모든 객체를 visitor_stats_ 접두사로 캡슐화 (다른 테이블과 충돌 방지)

-- 1) page_views 테이블
create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  referrer text,
  user_agent text,
  ip_hash text not null,
  session_id text not null,
  country text,                  -- ISO 3166-1 alpha-2 (예: 'KR', 'US')
  country_name text,
  region text,                   -- 시/도 (한국 한정, 예: 'Seoul')
  city text,
  device_type text,              -- mobile / tablet / desktop / bot / unknown
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on page_views (created_at desc);
create index if not exists page_views_path_idx on page_views (path);
create index if not exists page_views_session_idx on page_views (session_id, created_at desc);
create index if not exists page_views_country_idx on page_views (country);
create index if not exists page_views_region_idx on page_views (region);

-- 2) RLS
alter table page_views enable row level security;

drop policy if exists "page_views_insert_all" on page_views;
create policy "page_views_insert_all" on page_views
  for insert
  with check (true);

-- select는 service_role bypass (anon/authenticated는 차단됨)

-- 3) 통계 RPC 함수
create or replace function get_visitor_stats(
  days_back int default 30,
  top_paths_limit int default 20,
  recent_limit int default 30
)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  select json_build_object(
    'totalViews', (select count(*) from page_views where created_at >= now() - (days_back || ' days')::interval),
    'uniqueSessions', (select count(distinct session_id) from page_views where created_at >= now() - (days_back || ' days')::interval),
    'todayViews', (select count(*) from page_views where created_at >= date_trunc('day', now())),
    'todayUnique', (select count(distinct session_id) from page_views where created_at >= date_trunc('day', now())),
    'topPaths', (
      select coalesce(json_agg(row_to_json(p)), '[]'::json)
      from (
        select path, count(*) as views, count(distinct session_id) as unique_visitors
        from page_views
        where created_at >= now() - (days_back || ' days')::interval
        group by path
        order by views desc
        limit top_paths_limit
      ) p
    ),
    'dailyTrend', (
      select coalesce(json_agg(row_to_json(d)), '[]'::json)
      from (
        select
          date_trunc('day', created_at) as day,
          count(*) as views,
          count(distinct session_id) as unique_visitors
        from page_views
        where created_at >= now() - (days_back || ' days')::interval
        group by date_trunc('day', created_at)
        order by day asc
      ) d
    ),
    'recentViews', (
      select coalesce(json_agg(row_to_json(r)), '[]'::json)
      from (
        select id, path, session_id, country, country_name, region, city, device_type, created_at
        from page_views
        order by created_at desc
        limit recent_limit
      ) r
    ),
    'byCountry', (
      select coalesce(json_agg(row_to_json(c)), '[]'::json)
      from (
        select
          coalesce(country, 'XX') as country_code,
          max(country_name) as country_name,
          count(*) as views,
          count(distinct session_id) as unique_visitors
        from page_views
        where created_at >= now() - (days_back || ' days')::interval
        group by coalesce(country, 'XX')
        order by views desc
      ) c
    ),
    'byRegion', (
      select coalesce(json_agg(row_to_json(rg)), '[]'::json)
      from (
        select
          coalesce(region, 'Unknown') as region,
          count(*) as views,
          count(distinct session_id) as unique_visitors
        from page_views
        where created_at >= now() - (days_back || ' days')::interval
          and country = 'KR'
        group by coalesce(region, 'Unknown')
        order by views desc
      ) rg
    ),
    'byDevice', (
      select coalesce(json_agg(row_to_json(dv)), '[]'::json)
      from (
        select
          coalesce(device_type, 'unknown') as device_type,
          count(*) as views
        from page_views
        where created_at >= now() - (days_back || ' days')::interval
        group by coalesce(device_type, 'unknown')
        order by views desc
      ) dv
    )
  ) into result;
  return result;
end;
$$;