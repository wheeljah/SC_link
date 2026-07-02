// server/src/services/jobSources/types.ts
// 어댑터 공통 인터페이스 — 새로운 소스 추가 시 이 인터페이스만 구현하면 됨

export interface RawJobItem {
  external_id: string;            // 소스 내 공고 ID (URL 일부 또는 GUID)
  canonical_url: string;          // 원본 URL
  title: string;
  organization?: string;
  category?: 'graduate' | 'postdoc' | 'researcher' | 'professor' | 'staff';
  fields?: string[];              // 분야 태그
  deadline?: Date | null;
  posted_at?: Date | null;
  summary?: string;               // 본문 500자 이내 (PII drop 후)
  description_html?: string;      // 원본 HTML (DB 저장용)
}

export interface JobSourceAdapter {
  code: string;                    // 'kisti-rss', 'nrf-cheerio' 등
  region: 'kr' | 'global';
  /**
   * 목록 + 상세 통합 호출. RSS는 본문이 item에 포함되므로 fetchList만으로 충분.
   * Puppeteer/HTML 어댑터는 fetchList 후 상세 페이지 추가 fetch 필요.
   */
  fetchList(opts?: { sinceDays?: number }): Promise<RawJobItem[]>;
}