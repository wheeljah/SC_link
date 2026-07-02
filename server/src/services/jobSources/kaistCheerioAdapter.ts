// server/src/services/jobSources/kaistCheerioAdapter.ts
// KAIST 채용/초빙 어댑터 — 공공저작물 (국공립대학), robots.txt Allow: /
// 페이지: https://www.kaist.ac.kr/kr/html/footer/0814.html

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL = 'https://www.kaist.ac.kr/kr/html/footer/0814.html';

export const kaistCheerioAdapter: JobSourceAdapter = {
  code: 'kaist-cheerio',
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

    // KAIST 게시판: 테이블 행. 각 행: 글번호·제목·작성자·첨부·상태·공고시작·공고종료
    $('table tbody tr, .board-list tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find('td').map((_, td) => $(td).text().trim()).get();
      if (cells.length < 3) return;

      const postNo = cells[0];
      if (!postNo || /^\s*$/.test(postNo)) return;

      const titleLink = $tr.find('a').first();
      const title = titleLink.text().trim() || cells[1];
      const href = titleLink.attr('href');
      if (!title || !href) return;

      const canonical_url = href.startsWith('http') ? href : new URL(href, LIST_URL).toString();
      const external_id = (href.match(/(\d+)/)?.[1] || canonical_url).slice(0, 200);

      // KAIST 컬럼: [0]=글번호 [1]=제목 [2]=작성자 [3]=첨부 [4]=상태 [5]=시작일 [6]=종료일
      const status = cells[4] || '';
      const startDate = cells[5];
      const endDate = cells[6];
      const deadline = parseDate(endDate);

      const fields = extractFields(title);
      const category = inferCategory(title);

      items.push({
        external_id,
        canonical_url,
        title: title.slice(0, 300),
        organization: 'KAIST',
        category,
        fields,
        deadline,
        posted_at: parseDate(startDate),
        summary: sanitizePII(title).slice(0, 500),
        description_html: sanitizePII(`${title} | 상태: ${status}`).slice(0, 5000),
      });
    });

    // 폴백: <a> 태그 직접 (테이블 구조가 다를 경우 대비)
    if (items.length === 0) {
      $('a').each((_, a) => {
        const $a = $(a);
        const text = $a.text().trim();
        if (text.length < 8 || text.length > 200) return;
        if (!/채용|모집|초빙|박사후|연구|위촉|교수/.test(text)) return;
        const href = $a.attr('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        const canonical_url = href.startsWith('http') ? href : new URL(href, LIST_URL).toString();
        items.push({
          external_id: href.slice(0, 200),
          canonical_url,
          title: text.slice(0, 300),
          organization: 'KAIST',
          fields: extractFields(text),
          summary: sanitizePII(text).slice(0, 500),
        });
      });
    }

    return items;
  },
};

// ── 헬퍼 (다른 어댑터와 동일 로직) ────────────────────────────────────────

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const norm = s.replace(/[./]/g, '-').trim();
  const d = new Date(norm);
  return isNaN(d.getTime()) ? null : d;
}

const FIELD_KEYWORDS: Record<string, string[]> = {
  'AI': ['ai', '인공지능', '머신러닝', '딥러닝'],
  '바이오': ['바이오', '생명', '유전'],
  '화학': ['화학'],
  '물리': ['물리'],
  '신소재': ['소재', '재료'],
  '에너지': ['에너지', '태양광', '배터리'],
  '의학': ['의학', '임상'],
  '환경': ['환경', '기후'],
  'ICT': ['ict', '정보통신', '소프트웨어'],
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
  if (/교수|professor|전임/.test(lower)) return 'professor';
  if (/연구원|연구직|위촉/.test(lower)) return 'researcher';
  return 'staff';
}