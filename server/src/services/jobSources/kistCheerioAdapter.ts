// server/src/services/jobSources/kistCheerioAdapter.ts
// 한국과학기술연구원(KIST) 채용공고 어댑터 — 공공저작물 (정부출연연구기관)
// 페이지: https://www.kist.re.kr/ko/notice/employment-announcement.do
// 구조: table.board-table.recruit tbody tr
//       cols: [No, 상태, 제목(a), 작성자, 등록일, 마감일, 조회, 첨부]
// href 패턴: ?mode=view&articleNo={id}&article.offset=0&articleLimit=10

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL = 'https://www.kist.re.kr/ko/notice/employment-announcement.do';
const BASE_URL = 'https://www.kist.re.kr';

export const kistCheerioAdapter: JobSourceAdapter = {
  code: 'kist-cheerio',
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

    // 진행중/마감 상태 모두 수집 — 마감 지난 공고는 crawler에서 deadline 기반 비활성화됨
    $('table.board-table.recruit tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find('td').map((__, td) => $(td).text().trim().replace(/\s+/g, ' ')).get();
      if (cells.length < 4) return;

      // 헤더행 스킵
      if (/^번호$|^No$/.test(cells[0] || '')) return;

      // 상태 + 제목은 같은 td에 묶여있을 수 있음 — a 태그 직접 찾기
      const titleLink = $tr.find('a').first();
      const title = titleLink.text().trim().replace(/\s*new\s*$/i, '').replace(/^zip\s*/i, '');
      const href = titleLink.attr('href');
      if (!title || !href) return;

      const canonical_url = href.startsWith('http')
        ? href
        : new URL(href, BASE_URL).toString();

      const idMatch = href.match(/articleNo=(\d+)/);
      const external_id = idMatch?.[1]
        ? `kist:${idMatch[1]}`
        : `kist:${href.slice(0, 200)}`;

      // 마감일 — 보통 5번째 td (0-indexed 4 or 5)
      // cols: [0]=No, [1]=상태+제목 묶음, [2]=작성자, [3]=등록일, [4]=마감일, [5]=조회, [6]=첨부
      const deadlineText = cells[5] || cells[4] || '';
      const posted_at = parseDate(cells[3] || '');
      const deadline = parseDate(deadlineText);

      items.push({
        external_id,
        canonical_url,
        title: title.slice(0, 300),
        organization: '한국과학기술연구원 (KIST)',
        category: inferCategory(title),
        fields: extractFields(title),
        deadline,
        posted_at,
        summary: sanitizePII(title).slice(0, 500),
        description_html: sanitizePII(`${title} | 등록: ${cells[3] || ''} | 마감: ${deadlineText}`).slice(0, 5000),
      });
    });

    return items;
  },
};

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  // "26.07.13" 또는 "2026-07-13" 등 모두 처리
  const m = s.match(/(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  let y = Number(m[1]);
  if (y < 100) y += y < 50 ? 2000 : 1900;
  const d = new Date(y, Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

const FIELD_KEYWORDS: Record<string, string[]> = {
  'AI': ['ai', '인공지능', '머신러닝', '딥러닝'],
  '바이오': ['바이오', '생명', '뇌', '의학', '유전'],
  '화학': ['화학'],
  '물리': ['물리'],
  '신소재': ['소재', '재료', '배터리'],
  '에너지': ['에너지', '태양광', '수소'],
  'ICT': ['ict', '정보통신', '소프트웨어', '반도체'],
  '행정': ['행정', '사무', '인사', '회계'],
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
  if (/교수|professor|전임|부교수/.test(lower)) return 'professor';
  if (/연구원|연구직|위촉|전문원|연수/.test(lower)) return 'researcher';
  return 'staff';
}