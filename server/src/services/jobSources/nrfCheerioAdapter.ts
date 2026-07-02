// server/src/services/jobSources/nrfCheerioAdapter.ts
// 한국연구재단 채용공고 어댑터 — 공공누리 제1유형, 공공데이터법 §3④ 적용
// 페이지: https://www.nrf.re.kr/cms/board/general/list?menu_no=54

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL = 'https://www.nrf.re.kr/cms/board/general/list?menu_no=54';

export const nrfCheerioAdapter: JobSourceAdapter = {
  code: 'nrf-cheerio',
  region: 'kr',

  async fetchList(): Promise<RawJobItem[]> {
    const { data: html } = await axios.get<string>(LIST_URL, {
      timeout: 20000,
      responseType: 'text',
      headers: { 'User-Agent': 'ScholarLinkBot/1.0 (+https://wheeljah.github.io/SC_link)' },
    });

    const $ = cheerio.load(html);
    const items: RawJobItem[] = [];

    // NRF 게시판은 <tbody> 안의 <tr> 구조. 실제 셀렉터는 페이지 변경 가능 → 인내심 있게 시도
    $('table tbody tr, .board-list tbody tr, .list tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const $a = $tr.find('a').first();
      const title = $a.text().trim() || $tr.find('td').eq(1).text().trim();
      const href = $a.attr('href');
      if (!title || !href) return;

      // 절대 URL 변환
      const canonical_url = href.startsWith('http') ? href : new URL(href, LIST_URL).toString();

      // row 셀에서 posted_at / deadline 추출 시도
      const tds = $tr.find('td').map((_, td) => $(td).text().trim()).get();
      const dateLike = tds.find(t => /\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(t));
      const posted_at = dateLike ? new Date(dateLike.replace(/[./]/g, '-')) : null;
      const deadline = extractDeadline(title);

      const external_id = (href.match(/(\d+)/)?.[1] || canonical_url).slice(0, 200);

      const fields = extractFields(title);
      const category = inferCategory(title);

      items.push({
        external_id,
        canonical_url,
        title: title.slice(0, 300),
        organization: '한국연구재단',
        category,
        fields,
        deadline,
        posted_at,
        summary: sanitizePII(title).slice(0, 500),
        description_html: sanitizePII(title).slice(0, 5000),
      });
    });

    // 폴백: <a class="title"> 패턴도 시도
    if (items.length === 0) {
      $('a').each((_, a) => {
        const $a = $(a);
        const text = $a.text().trim();
        if (text.length < 10 || text.length > 200) return;
        if (!/채용|모집|공고|연구|박사|대학/.test(text)) return;
        const href = $a.attr('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
        const canonical_url = href.startsWith('http') ? href : new URL(href, LIST_URL).toString();
        items.push({
          external_id: href.slice(0, 200),
          canonical_url,
          title: text.slice(0, 300),
          organization: '한국연구재단',
          fields: extractFields(text),
          summary: sanitizePII(text).slice(0, 500),
        });
      });
    }

    return items;
  },
};

// ── 동일 헬퍼 (kistiRssAdapter와 공유하려면 추후 lib 분리) ────────────────

const DEADLINE_PATTERNS = [
  /(?:마감|접수종료|마감일)[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/,
  /(?:접수기간)[^\d]{0,40}(\d{4}[-./]\d{1,2}[-./]\d{1,2})\s*[~\-]\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/,
];

function extractDeadline(text: string): Date | null {
  for (const re of DEADLINE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const norm = (m[2] || m[1]).replace(/[./]/g, '-');
      const d = new Date(norm);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
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
  if (/교수|professor/.test(lower)) return 'professor';
  if (/연구원|research/.test(lower)) return 'researcher';
  return 'staff';
}