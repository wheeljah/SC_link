// server/src/services/jobSources/yonseiFacultyCheerioAdapter.ts
// 연세대학교 전임교원 초빙 어댑터 — faculty.yonsei.ac.kr (별도 도메인)
// 사립대학이지만 채용공고 본문 발췌는 공정이용 (저작권법 §35-5)
//
// 페이지: https://faculty.yonsei.ac.kr/recruit/index.php?lang=ko
// 구조: table (no class) tbody tr
//       cols: [No, 제목(a), 등록일(YYYY.MM.DD)]
// href 패턴: /recruit/index.php?mid=K01&lang=ko&uid={id}&act=view

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL = 'https://faculty.yonsei.ac.kr/recruit/index.php?lang=ko';
const BASE_URL = 'https://faculty.yonsei.ac.kr';

export const yonseiFacultyCheerioAdapter: JobSourceAdapter = {
  code: 'yonsei-faculty-cheerio',
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

    $('table tbody tr').each((_, tr) => {
      const $tr = $(tr);
      const cells = $tr.find('td').map((__, td) => $(td).text().trim().replace(/\s+/g, ' ')).get();
      if (cells.length < 3) return;

      // 헤더행 스킵
      if (/^번호$|^No$/.test(cells[0] || '')) return;

      const titleLink = $tr.find('a').first();
      const title = titleLink.text().trim();
      const href = titleLink.attr('href');
      if (!title || !href) return;

      const canonical_url = href.startsWith('http')
        ? href
        : new URL(href, BASE_URL).toString();

      const uidMatch = href.match(/uid=(\d+)/);
      const external_id = uidMatch?.[1]
        ? `yonsei-faculty:${uidMatch[1]}`
        : `yonsei-faculty:${href.slice(0, 200)}`;

      // cols: [0]=번호 [1]=상태+제목 묶음 [2]=등록일
      const posted_at = parseDate(cells[cells.length - 1] || '');

      items.push({
        external_id,
        canonical_url,
        title: title.slice(0, 300),
        organization: '연세대학교',
        category: 'professor', // 이 어댑터는 전임교원 초빙만 수집
        fields: extractFields(title),
        deadline: null,
        posted_at,
        summary: sanitizePII(title).slice(0, 500),
        description_html: sanitizePII(title).slice(0, 5000),
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
  '바이오': ['바이오', '생명', '의학', '간호'],
  'ICT': ['ict', '소프트웨어', '컴퓨터', '공학'],
  '인문사회': ['인문', '사회', '법학', '경영', '경제', '교육', '심리'],
  '신소재': ['소재', '재료', '화학'],
  '에너지': ['에너지', '전기', '반도체'],
};

function extractFields(text: string): string[] {
  const lower = text.toLowerCase();
  const fields: string[] = [];
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) fields.push(field);
  }
  return fields.slice(0, 5);
}