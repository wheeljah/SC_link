// server/src/services/jobSources/snuRndCheerioAdapter.ts
// 서울대학교 산학협력단 채용공고 어댑터 — 공공저작물 (산학협력단도 국공립),
// robots.txt: https://snurnd.snu.ac.kr/robots.txt → 없음(404) 또는 Allow
// 페이지: https://snurnd.snu.ac.kr/board/recruit
// 구조: table.lc01 tbody tr — cols: [No, 제목(a), 작성자, 작성일(YYYY.MM.DD)]
// href 패턴: /?q=board/recruit/view/{id}

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL = 'https://snurnd.snu.ac.kr/board/recruit';
const BASE_URL = 'https://snurnd.snu.ac.kr';

export const snuRndCheerioAdapter: JobSourceAdapter = {
  code: 'snu-rnd-cheerio',
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

    $('table.lc01 tbody tr, table tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find('td').map((__, td) => $(td).text().trim().replace(/\s+/g, ' ')).get();
      if (cells.length < 3) return;

      const titleLink = $tr.find('a').first();
      const title = titleLink.text().trim();
      const href = titleLink.attr('href');
      if (!title || !href) return;

      // 공지(작성자만 있고 제목에 [공지] 없는 행) 스킵
      const canonical_url = href.startsWith('http')
        ? href
        : new URL(href.startsWith('?') ? '/' + href : href, BASE_URL).toString();

      // id 추출 — href에 /view/{id} 가 있으면 사용
      const viewMatch = href.match(/view\/(\d+)/);
      const external_id = viewMatch?.[1]
        ? `snu-rnd:${viewMatch[1]}`
        : `snu-rnd:${href.slice(0, 200)}`;

      // 작성일은 보통 마지막 td. "2026.06.30" 형태
      const dateText = cells[cells.length - 1] || '';
      const posted_at = parseDate(dateText);

      items.push({
        external_id,
        canonical_url,
        title: title.replace(/\s*new$/i, '').slice(0, 300),
        organization: '서울대학교 산학협력단',
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
  const m = s.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

const FIELD_KEYWORDS: Record<string, string[]> = {
  'AI': ['ai', '인공지능', '머신러닝', '딥러닝'],
  '바이오': ['바이오', '생명', '유전', '의학'],
  'ICT': ['ict', '정보통신', '소프트웨어', '컴퓨터', '전산'],
  '행정': ['행정', '사무', '인사', '회계', '총무', '경영'],
  '법무': ['법무', '변호사', '변리사', '법률'],
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
  if (/교수|전임|부교수|조교수|초빙/.test(lower)) return 'professor';
  if (/박사후|post[- ]?doc/.test(lower)) return 'postdoc';
  if (/연구원|연구직|위촉/.test(lower)) return 'researcher';
  if (/대학원|graduate/.test(lower)) return 'graduate';
  return 'staff';
}