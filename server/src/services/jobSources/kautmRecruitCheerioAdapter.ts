// server/src/services/jobSources/kautmRecruitCheerioAdapter.ts
// 한국대학기술이전협회(kautm.net) 채용공고 미러 어댑터
// — 사립대학 산학협력단·TLO 채용을 단일 소스로 통합 수집
//
// 페이지: https://kautm.net/bbs/index.php?so_table=tlo_news&category=recruit
// 플랫폼: 그누보드4 (so_table/num 파라미터 패턴)
// 특징:
//   - 정부 인증 산학협력단체가 운영하는 통합 게시판
//   - 한양대·성균관대·이화여대·경희대·인하대 등 사립대 산학협력단 공고 자동 업로드
//   - robots.txt 제한 없음 (공개 채용 정보)
//   - 신선도: 보통 (수동 업로드, 1~3일 지연 가능)
//
// 참고: 사이트 외부 직접 접근 시 SSL 이슈 발생 가능 — Render에서 자동 재시도
//       실패 시 fetchList가 빈 배열 반환 + crawl_logs에 에러 기록

import axios from 'axios';
import * as cheerio from 'cheerio';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const LIST_URL = 'https://kautm.net/bbs/index.php?so_table=tlo_news&category=recruit';
const BASE_URL = 'https://kautm.net';

export const kautmRecruitAdapter: JobSourceAdapter = {
  code: 'kautm-recruit',
  region: 'kr',

  async fetchList(): Promise<RawJobItem[]> {
    let html: string;
    try {
      const res = await axios.get<string>(LIST_URL, {
        timeout: 25000,
        responseType: 'text',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        },
      });
      html = res.data;
    } catch (e) {
      const msg = (e as Error).message || String(e);
      console.warn('[kautm-recruit] fetch failed:', msg.slice(0, 200));
      return [];
    }

    const $ = cheerio.load(html);
    const items: RawJobItem[] = [];

    // 그누보드 패턴 — board list 안의 상세 링크들
    // <a href="?so_table=tlo_news&mode=VIEW&num=NNNN&category=recruit">제목</a>
    $('a[href*="so_table=tlo_news"][href*="mode=VIEW"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const title = $(el).text().trim();
      if (!title || title.length < 5) return;

      // num=NNNN 추출
      const m = href.match(/num=(\d+)/);
      if (!m) return;
      const num = m[1];

      // 절대 URL 변환
      let canonicalUrl: string;
      try {
        canonicalUrl = new URL(href, LIST_URL).href;
      } catch {
        canonicalUrl = `${BASE_URL}/bbs/?so_table=tlo_news&mode=VIEW&num=${num}&category=recruit`;
      }

      items.push({
        external_id: `kautm:${num}`,
        canonical_url: canonicalUrl,
        title: sanitizePII(title).slice(0, 300),
        category: inferCategory(title),
        summary: extractSnippet($, el),
      });
    });

    return items;
  },
};

/** 게시물 주변 텍스트에서 작성일/기관 단서 추출 */
function extractSnippet($: cheerio.CheerioAPI, linkEl: unknown): string {
  // 링크가 속한 행(tr)에서 작성자·날짜 추출 시도 (있을 때만)
  const $link = $(linkEl as any);
  const tr = $link.closest('tr');
  if (tr.length === 0) return '';
  const cells = tr.find('td').map((_, td) => $(td).text().trim()).get();
  return sanitizePII(cells.join(' · ')).slice(0, 200);
}

function inferCategory(text: string): RawJobItem['category'] {
  const lower = text.toLowerCase();
  if (/교수|조교수|부교수|전임강사|특임교수|초빙/.test(lower)) return 'professor';
  if (/박사후|포닥|post[- ]?doc|postdoctoral/.test(lower)) return 'postdoc';
  if (/대학원|graduate|석사|박사|ra\b/.test(lower)) return 'graduate';
  if (/연구원|연구직|위촉|r&d|rnd/.test(lower)) return 'researcher';
  return 'staff';
}