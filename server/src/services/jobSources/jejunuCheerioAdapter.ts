// server/src/services/jobSources/jejunuCheerioAdapter.ts
// 제주대학교 교직원채용 어댑터 — 공공저작물 (국립대학), robots.txt 허용
// 페이지: https://www.jejunu.ac.kr/ara/noticesurvey/recruit.htm
// 구조: 표준 CMS 패턴 (추정) — tbody tr / td.subject a / td.date / ?act=view&seq=N
//     날짜 형식: "YYYY-MM-DD" (추정)
// ⚠️ selector는 추정치 — 실측 검증 필요

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL = 'https://www.jejunu.ac.kr/ara/noticesurvey/recruit.htm';
const BASE_URL = 'https://www.jejunu.ac.kr';

export const jejunuCheerioAdapter: JobSourceAdapter = {
  code: 'jejunu-cheerio',
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

    // 폴백 selector 2종: (1) 표준 CMS 패턴, (2) 단순 tr 패턴
    const rowSelectors = [
      '.board-list tbody tr',
      'table tbody tr',
    ];

    for (const sel of rowSelectors) {
      $(sel).each((_, tr) => {
        if (items.length > 0) return; // 첫 selector 성공 시 중단
        const $tr = $(tr);
        const titleLink =
          $tr.find('td.subject a, td.title a, a.subject, .subject a').first();
        if (titleLink.length === 0) return;
        const title = titleLink.text().trim();
        const href = titleLink.attr('href');
        if (!title || !href) return;
        if (title.length < 4) return; // 너무 짧은 제목 skip (공지/페이지 번호 등)

        const canonical_url = href.startsWith('http')
          ? href
          : new URL(href, BASE_URL).toString();

        const seq =
          href.match(/seq=(\d+)/)?.[1] ||
          href.match(/board_no=(\d+)/)?.[1] ||
          href.slice(0, 200);
        const dateText = $tr.find('td.date, .date').first().text().trim();
        const posted_at = parseDate(dateText);

        const fields = extractFields(title);
        const category = inferCategory(title);

        items.push({
          external_id: `jejunu:${seq}`,
          canonical_url,
          title: title.slice(0, 300),
          organization: '제주대학교',
          category,
          fields,
          deadline: null,
          posted_at,
          summary: sanitizePII(title).slice(0, 500),
          description_html: sanitizePII(title).slice(0, 5000),
        });
      });
      if (items.length > 0) break;
    }

    return items;
  },
};

// ── 헬퍼 ────────────────────────────────────────────────────────────────

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
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