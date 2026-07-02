// server/src/services/jobSources/knuRndCheerioAdapter.ts
// 경북대학교 산학협력단 채용공고 어댑터 — 공공저작물 (국립대 산학협력단)
// 페이지: https://iac.knu.ac.kr/Employment?menuId=MENU_0000000334
// 구조: table (no class) tbody tr — cols: [No, 제목(a), 담당자, 첨부, 작성일]
// href 패턴: ?mode=detl&nttId=NTT_{id}&page=1

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL = 'https://iac.knu.ac.kr/Employment?menuId=MENU_0000000334';
const BASE_URL = 'https://iac.knu.ac.kr';

export const knuRndCheerioAdapter: JobSourceAdapter = {
  code: 'knu-rnd-cheerio',
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

    // 사이트 상단 '채용안내' 메뉴의 board table — 클래스가 없을 수 있어 넓게 잡음
    $('table tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find('td').map((__, td) => $(td).text().trim().replace(/\s+/g, ' ')).get();
      if (cells.length < 3) return;

      // 헤더행(셀에 '번호','제목','작성일' 같은 텍스트) 스킵
      if (/^번호$|^\s*제목\s*$/.test(cells[0] || '') || /^제목$/.test(cells[1] || '')) return;

      const titleLink = $tr.find('a').first();
      const title = titleLink.text().trim();
      const href = titleLink.attr('href');
      if (!title || !href) return;

      // 상세 페이지가 아닌 javascript/anchor 링크 스킵
      if (href.startsWith('#') || href.startsWith('javascript:')) return;

      const canonical_url = href.startsWith('http')
        ? href
        : new URL(href, BASE_URL).toString();

      const nttMatch = href.match(/nttId=([A-Z0-9_]+)/i);
      const external_id = nttMatch?.[1]
        ? `knu-rnd:${nttMatch[1]}`
        : `knu-rnd:${href.slice(0, 200)}`;

      // 작성일은 보통 마지막 td (YYYY-MM-DD 또는 YYYY.MM.DD)
      const dateText = cells[cells.length - 1] || '';
      const posted_at = parseDate(dateText);

      items.push({
        external_id,
        canonical_url,
        title: title.slice(0, 300),
        organization: '경북대학교 산학협력단',
        category: inferCategory(title),
        fields: extractFields(title),
        deadline: null,
        posted_at,
        summary: sanitizePII(title).slice(0, 500),
        description_html: sanitizePII(`${title} | 담당자: ${cells[2] || ''}`).slice(0, 5000),
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
  '신소재': ['소재', '재료', '분석'],
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
  if (/교수|전임|부교수|조교수|초빙|산학협력중점/.test(lower)) return 'professor';
  if (/박사후|post[- ]?doc/.test(lower)) return 'postdoc';
  if (/연구원|연구직|위촉|전임연구/.test(lower)) return 'researcher';
  if (/대학원|graduate/.test(lower)) return 'graduate';
  return 'staff';
}