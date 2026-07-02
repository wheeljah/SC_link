// server/src/services/jobSources/pusanCheerioAdapter.ts
// 부산대학교 교수초빙/직원채용 어댑터 — 공공저작물 (국공립대학), robots.txt 없음
// 페이지: https://www.pusan.ac.kr/kor/CMS/Board/Board.do?mCode=MN103
// 구조: .board-list-wrap tbody tr > td.subject p.stitle a / td.date
//     날짜 형식: "2026-07-02" (하이픈)
//     href 패턴: ?mCode=MN103&mode=view&mgr_seq=10&board_seq={seq}

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL =
  'https://www.pusan.ac.kr/kor/CMS/Board/Board.do?mCode=MN103&mode=list';
const BASE_URL = 'https://www.pusan.ac.kr';

export const pusanCheerioAdapter: JobSourceAdapter = {
  code: 'pusan-cheerio',
  region: 'kr',

  async fetchList(): Promise<RawJobItem[]> {
    const { data: html } = await axios.get<string>(LIST_URL, {
      timeout: 20000,
      responseType: 'text',
      headers: {
        'User-Agent': 'ScholarLinkBot/1.0 (+https://wheeljah.github.io/SC_link)',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
    });

    const $ = cheerio.load(html);
    const items: RawJobItem[] = [];

    $('.board-list-wrap tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const titleLink = $tr.find('td.subject p.stitle > a');
      const title = titleLink.text().trim();
      const href = titleLink.attr('href');
      if (!title || !href) return;

      const canonical_url = href.startsWith('http')
        ? href
        : new URL(href, BASE_URL).toString();

      const seq = href.match(/board_seq=(\d+)/)?.[1] || href.slice(0, 200);
      const dateText = $tr.find('td.date').text().trim();
      const posted_at = parseDate(dateText);

      const fields = extractFields(title);
      const category = inferCategory(title);

      items.push({
        external_id: `pusan:${seq}`,
        canonical_url,
        title: title.slice(0, 300),
        organization: '부산대학교',
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
  // "2026-07-02" 형식
  const m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
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