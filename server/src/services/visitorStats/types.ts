// server/src/services/visitorStats/types.ts
// visitor-stats 공통 타입 정의

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown';

export interface PageViewInsert {
  path: string;
  referrer: string | null;
  user_agent: string | null;
  ip_hash: string;
  session_id: string;
  country: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  device_type: DeviceType;
}

export interface GeoInfo {
  country: string | null;
  country_name: string | null;
  region: string | null;
  city: string | null;
  ip: string;
  user_agent: string;
}

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
    device_type: DeviceType | null;
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

export interface VisitorStatsOptions {
  /** 조회 기간 (일). 기본 30, 최대 365 */
  daysBack?: number;
  /** 결과 상한 (페이지 수 / 국가 수 / 최근 기록 수) */
  topPathsLimit?: number;
  recentLimit?: number;
  /** 중복 방지 윈도우 (분). 같은 세션 + 같은 path. 기본 30분 */
  dedupWindowMinutes?: number;
}