// server/src/services/jobSources/unistCheerioAdapter.ts
// UNIST 채용공고 어댑터 — 공공저작물 (국립대학), robots.txt 허용
// 페이지: http://www.unist.ac.kr/unist/etc/notification/employment.do
// 구조: tbody > tr (컨테이너 클래스가 약함, tr 내 td.b-td-left 유무로 row 검증)
//     날짜 형식: "2026.07.01" (점)
//     data-article-no 속성 우선 사용

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL =
  'https://www.unist.ac.kr/unist/etc/notification/employment.do?mode=list&article.offset=0';
const BASE_URL = 'https://www.unist.ac.kr';

export const unistCheerioAdapter: JobSourceAdapter = {
  code: 'unist-cheerio',
  region: 'kr',

  async fetchList(): Promise<RawJobItem[]> {
    // UNIST 서버가 Render IP에서 연결을 자주 끊음 → retry 1회 + 좀 더 일반적인 UA
    let html: string | null = null;
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const r = await axios.get<string>(LIST_URL, {
          timeout: 25000,
          responseType: 'text',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml',
          },
        });
        html = r.data;
        break;
      } catch (e) {
        lastErr = e as Error;
        if (attempt === 2) throw lastErr;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    if (!html) throw lastErr || new Error('UNIST fetch failed');

    const $ = cheerio.load(html);
    const items: RawJobItem[] = [];

    $('tbody > tr').each((_, tr) => {
      const $tr = $(tr);
      // row 검증: 제목 셀이 있는지 확인 (실제 채용 공고 row만)
      const titleLink = $tr.find('td.b-td-left .b-title-box > a').first();
      if (titleLink.length === 0) return;

      const title = titleLink.text().trim();
      const href = titleLink.attr('href');
      if (!title || !href) return;

      // data-article-no 속성 우선 사용
      const articleNo =
        titleLink.attr('data-article-no') ||
        href.match(/articleNo=(\d+)/)?.[1] ||
        href.slice(0, 200);

      const canonical_url = href.startsWith('http')
        ? href
        : new URL(href, BASE_URL).toString();

      // 날짜는 row의 마지막에서 두 번째 td (class 없음, 형식 "2026.07.01")
      const tds = $tr.find('td');
      const dateText =
        tds.length >= 2 ? tds.eq(tds.length - 2).text().trim() : '';
      const posted_at = parseDate(dateText);

      const fields = extractFields(title);
      const category = inferCategory(title);

      items.push({
        external_id: `unist:${articleNo}`,
        canonical_url,
        title: title.slice(0, 300),
        organization: 'UNIST',
        category,
        fields,
        deadline: null,
        posted_at,
        summary: sanitizePII(title).slice(0, 500),
        description_html: sanitizePII(title).slice(0, 5000),
      });
    });

    return items;
  },
};

// ── 헬퍼 ────────────────────────────────────────────────────────────────

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  // "2026.07.01" 형식
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

const FIELD_KEYWORDS: Record<string, string[]> = {
  'AI': ['ai', '인공지능', '머신러닝', '딥러닝'],
  '바이오': ['바이오', '생명', '유전', '의학'],
  '화학': ['화학'],
  '물리': ['물리'],
  '신소재': ['소재', '재료'],
  '에너지': ['에너지', '태양광', '배터리'],
  'ICT': ['ict', '정보통신', '소프트웨어', '컴퓨터'],
  '공학': ['공학', 'engineering'],
  '인문사회': ['인문', '사회', '교육', '법학', '경영'],
};

function extractFields(text: string): string[] {
  const lower = text.toLowerCase();
  const fields: string[] = [];
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) fields.push(field);
  }
  return fields.slice(0, 5);
}

function inferCategory(text: string): RawJobItem['category'] {
  const lower = text.toLowerCase();
  if (/박사후|post[- ]?doc/.test(lower)) return 'postdoc';
  if (/대학원|graduate|석사|박사/.test(lower)) return 'graduate';
  if (/교수|professor|전임|부교수|조교수|초빙/.test(lower)) return 'professor';
  if (/연구원|연구직|위촉/.test(lower)) return 'researcher';
  return 'staff';
}