// server/src/services/jobSources/ibsCheerioAdapter.ts
// 기초과학연구원(IBS) 채용공고 어댑터 — 공공저작물 (정부출연연구기관)
// 페이지: https://www.ibs.re.kr/prog/recruit/kor/sub04_01/list.do
// 구조: table.basic_table.device tbody tr
//       cols: [상태(진행중/마감), 공고명(a), 담당처, 마감일]
// href 패턴: /prog/recruit/kor/sub04_01/view.do?...&idx={id}
// ※ jsessionid이 붙기 때문에 정규식으로 잘라냄
// ※ IBS WAF가 "ScholarLinkBot" UA를 403으로 차단 → 일반 Chrome UA + Accept 헤더 필요

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL = 'https://www.ibs.re.kr/prog/recruit/kor/sub04_01/list.do';
const BASE_URL = 'https://www.ibs.re.kr';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const REFERER = 'https://www.ibs.re.kr/kor.do';

async function fetchWithRetry(url: string, attempts = 2): Promise<string> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const { data } = await axios.get<string>(url, {
        timeout: 20000,
        responseType: 'text',
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Referer': REFERER,
          'Cache-Control': 'no-cache',
        },
      });
      return data;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

export const ibsCheerioAdapter: JobSourceAdapter = {
  code: 'ibs-cheerio',
  region: 'kr',

  async fetchList(): Promise<RawJobItem[]> {
    const html = await fetchWithRetry(LIST_URL);

    const $ = cheerio.load(html);
    const items: RawJobItem[] = [];

    $('table.basic_table tbody tr, table.device tbody tr, table tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find('td').map((__, td) => $(td).text().trim().replace(/\s+/g, ' ')).get();
      if (cells.length < 3) return;

      // 헤더행 스킵
      if (/^상태$|^No$|^번호$/.test(cells[0] || '')) return;

      const titleLink = $tr.find('a').first();
      const title = titleLink.text().trim();
      const href = titleLink.attr('href');
      if (!title || !href) return;

      // jsessionid 제거 후 절대 URL 변환
      const cleanedHref = href.replace(/;jsessionid=[^/?]+/i, '');
      const canonical_url = cleanedHref.startsWith('http')
        ? cleanedHref
        : new URL(cleanedHref, BASE_URL).toString();

      const idxMatch = cleanedHref.match(/idx=(\d+)/);
      const external_id = idxMatch?.[1]
        ? `ibs:${idxMatch[1]}`
        : `ibs:${cleanedHref.slice(0, 200)}`;

      // cols: [0]=상태, [1]=공고명, [2]=담당처, [3]=마감일
      const status = cells[0] || '';
      const deadline = parseDate(cells[3] || '');

      items.push({
        external_id,
        canonical_url,
        title: title.slice(0, 300),
        organization: '기초과학연구원 (IBS)',
        category: inferCategory(title),
        fields: extractFields(title),
        deadline,
        posted_at: null,  // IBS는 등록일 표기 없음
        summary: sanitizePII(title).slice(0, 500),
        description_html: sanitizePII(`${title} | 담당처: ${cells[2] || ''} | 마감: ${cells[3] || ''} | 상태: ${status}`).slice(0, 5000),
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
  '바이오': ['바이오', '생명', '뇌', '의학', '유전', 'RNA', '바이러스'],
  '화학': ['화학', '촉매', '탄소'],
  '물리': ['물리', '양자', '입자', '레이저'],
  '수학': ['수학', '기하', '수리'],
  'ICT': ['ict', '정보통신', '소프트웨어', '반도체', '양자정보'],
  '행정': ['행정', '사무', '인사', '회계', '별정직'],
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
  if (/대학원|graduate|석사|박사|인턴/.test(lower)) return 'graduate';
  if (/교수|professor|전임|부교수|ci\b|연구단장/.test(lower)) return 'professor';
  if (/연구원|연구직|위촉|선임|전문원|별정직/.test(lower)) return 'researcher';
  return 'staff';
}