// server/src/services/jobSources/kistiRssAdapter.ts
// KISTI RSS 어댑터 — 공공누리, RSS 표준
// 기본: research-task (R&D 과제·채용 통합 피드)

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const FEED_URL = 'https://www.kisti.re.kr/rss/research-task';

export const kistiRssAdapter: JobSourceAdapter = {
  code: 'kisti-rss',
  region: 'kr',

  async fetchList(): Promise<RawJobItem[]> {
    const { data: xml } = await axios.get<string>(FEED_URL, {
      timeout: 15000,
      responseType: 'text',
      headers: { 'User-Agent': 'ScholarLinkBot/1.0 (+https://wheeljah.github.io/SC_link)' },
    });

    const $ = cheerio.load(xml, { xmlMode: true });
    const items: RawJobItem[] = [];

    $('item').each((_, el) => {
      const $el = $(el);
      const link = $el.find('link').text().trim();
      const title = $el.find('title').text().trim();
      const description = $el.find('description').text().trim();
      const pubDateRaw = $el.find('pubDate').text().trim();

      if (!link || !title) return;

      // 마감일 추출 시도 (description 또는 title에서 "까지", "마감", "접수기간" 패턴)
      const deadline = extractDeadline(description + ' ' + title);
      const posted_at = pubDateRaw ? new Date(pubDateRaw) : null;

      // external_id: link의 마지막 path segment (KISTI는 ID를 URL에 포함)
      const external_id = link.split('/').filter(Boolean).pop()?.slice(0, 200) || link;

      const fields = extractFields(title + ' ' + description);
      const category = inferCategory(title + ' ' + description);

      items.push({
        external_id,
        canonical_url: link,
        title: title.slice(0, 300),
        organization: 'KISTI',
        category,
        fields,
        deadline,
        posted_at,
        summary: sanitizePII(description).slice(0, 500),
        description_html: sanitizePII(description).slice(0, 5000),
      });
    });

    return items;
  },
};

// ── 헬퍼 ────────────────────────────────────────────────────────────────

const DEADLINE_PATTERNS = [
  /(?:마감|접수종료|마감일)[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/,
  /(?:접수기간)[^\d]{0,40}(\d{4}[-./]\d{1,2}[-./]\d{1,2})\s*[~\-]\s*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/,
  /(?:until|by|due)[:\s]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/i,
];

function extractDeadline(text: string): Date | null {
  for (const re of DEADLINE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const d = parseDate(m[2] || m[1]);
      if (d) return d;
    }
  }
  return null;
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const norm = s.replace(/[./]/g, '-');
  const d = new Date(norm);
  return isNaN(d.getTime()) ? null : d;
}

const FIELD_KEYWORDS: Record<string, string[]> = {
  'AI': ['ai', '인공지능', '머신러닝', '딥러닝', 'machine learning', 'deep learning'],
  '바이오': ['바이오', '생명', '유전', '생명과학', 'bio', 'life science', '생물'],
  '화학': ['화학', 'chemistry'],
  '물리': ['물리', 'physics'],
  '신소재': ['소재', '재료', 'material'],
  '에너지': ['에너지', '태양광', '배터리', 'energy', 'battery'],
  '의학': ['의학', '임상', 'medical', 'clinical'],
  '환경': ['환경', 'climate', '기후'],
  'ICT': ['ict', '정보통신', '소프트웨어', 'software'],
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
  if (/박사후|post[- ]?doc|postdoctoral/.test(lower)) return 'postdoc';
  if (/대학원|graduate|석사|박사/.test(lower)) return 'graduate';
  if (/교수|professor|faculty/.test(lower)) return 'professor';
  if (/연구원|research/.test(lower)) return 'researcher';
  return 'staff';
}