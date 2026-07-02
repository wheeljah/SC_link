// server/src/services/jobSources/yonseiRndCheerioAdapter.ts
// 연세대학교 산학협력단 채용공고 어댑터 — 사립대학이지만 robots.txt에서 채용 게시판은 허용
// (www.yonsei.ac.kr/robots.txt에 /sc/212/, /research/service/recruit.do 등 Disallow 없음)
// 본문은 요약 + 원본 링크만 저장 (저작권법 §35-5 공정이용)
//
// 페이지: https://research.yonsei.ac.kr/research/service/recruit.do
// 구조: table.board-table tbody tr
//       cols: [No, 제목(a), 작성자, 첨부, 작성일(YY.MM.DD)]

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL = 'https://research.yonsei.ac.kr/research/service/recruit.do';
const BASE_URL = 'https://research.yonsei.ac.kr';

export const yonseiRndCheerioAdapter: JobSourceAdapter = {
  code: 'yonsei-rnd-cheerio',
  region: 'kr',

  async fetchList(): Promise<RawJobItem[]> {
    const { data: html } = await axios.get<string>(LIST_URL, {
      timeout: 20000,
      responseType: 'text',
      headers: {
        'User-Agent': 'ScholarLinkBot/1.0 (+https://wheeljah.github.io/SC_link) — research index',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
    });

    const $ = cheerio.load(html);
    const items: RawJobItem[] = [];

    $('table.board-table tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find('td').map((__, td) => $(td).text().trim().replace(/\s+/g, ' ')).get();
      if (cells.length < 3) return;

      const titleLink = $tr.find('a').first();
      const title = titleLink.text().trim();
      const href = titleLink.attr('href');
      if (!title || !href) return;

      const canonical_url = href.startsWith('http')
        ? href
        : new URL(href, BASE_URL).toString();

      const articleMatch = href.match(/articleNo=(\d+)/);
      const external_id = articleMatch?.[1]
        ? `yonsei-rnd:${articleMatch[1]}`
        : `yonsei-rnd:${href.slice(0, 200)}`;

      // 작성일은 보통 마지막 td (YY.MM.DD 또는 YYYY.MM.DD)
      const dateText = cells[cells.length - 1] || '';
      const posted_at = parseDate(dateText);

      items.push({
        external_id,
        canonical_url,
        // 본문은 요약(제목)만 — 공정이용 (저작권법 §35-5)
        title: title.slice(0, 300),
        organization: '연세대학교 산학협력단',
        category: inferCategory(title),
        fields: extractFields(title),
        deadline: null,
        posted_at,
        summary: sanitizePII(title).slice(0, 500),
        description_html: sanitizePII(`${title} | 작성자: ${cells[2] || ''}`).slice(0, 5000),
      });
    });

    return items;
  },
};

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  // "26.05.26" 또는 "2026.05.26" 모두 처리
  const m = s.match(/(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  let y = Number(m[1]);
  if (y < 100) y += y < 50 ? 2000 : 1900;
  const d = new Date(y, Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

const FIELD_KEYWORDS: Record<string, string[]> = {
  'AI': ['ai', '인공지능', '머신러닝', '딥러닝'],
  '바이오': ['바이오', '생명', '의학', '제약'],
  'ICT': ['ict', '정보통신', '소프트웨어', '전산'],
  '행정': ['행정', '사무', '인사', '회계', '총무', '경영'],
  '지식재산': ['지식재산', '특허', '기술이전', '사업화', 'TLO'],
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
  if (/교수|전임|부교수|조교수|초빙|비전임교원|특임교수/.test(lower)) return 'professor';
  if (/박사후|포닥|post[- ]?doc/.test(lower)) return 'postdoc';
  if (/연구원|연구직|위촉|전임연구|사업전담/.test(lower)) return 'researcher';
  if (/대학원|graduate|석사|박사/.test(lower)) return 'graduate';
  return 'staff';
}