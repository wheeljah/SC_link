// server/src/services/jobSources/saraminOpenApiAdapter.ts
// 사람인 Open API 어댑터 — oapi.saramin.co.kr (구 api.saramin.co.kr 이관)
//
// 페이지: https://oapi.saramin.co.kr/
// 신청: https://oapi.saramin.co.kr/ (회원가입 → Open API 신청 → 승인)
//
// 사용법:
//   1. oapi.saramin.co.kr 회원가입 + Open API 신청 (무료, 1~2일 승인)
//   2. 발급된 Access-Key를 환경변수 SARAMIN_API_KEY에 등록
//   3. 어댑터 자동 활성화
//
// 정책:
//   - 키워드 검색으로 "대학", "산학협력단", "연구원" 등 학술 분야 필터링
//   - 사립/공기업/공공기관 구분 없이 자동 노출 (사람인이 통합 미러)
//   - JSON 응답 (성공 시 count/total 반환)
//   - robots.txt 차단 없음 (공식 Open API)
//
// API 키 미설정 시: enabled=false 자동 비활성화 (로그만 남김)

import axios from 'axios';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const API_KEY = process.env.SARAMIN_API_KEY || '';
const ENDPOINT = 'https://oapi.saramin.co.kr/job-search';
// 학계/연구 키워드 — 사람인은 사립대 TLO·산학협력단 공고가 자동 업로드됨
const KEYWORDS = ['대학 산학협력단', '대학 채용', '산학협력단 채용', '대학원 전임', '연구기관 채용', 'TLO 채용'];

interface SaraminJob {
  id: string;
  url: string;
  active: number;
  title: { raw?: string; keyword?: string };
  company?: { name?: string; detail?: { name?: string } };
  position?: { title?: string; location?: { name?: string } };
  employment_type?: { name?: string };
  education?: { name?: string };
  career?: { name?: string };
  salary?: { name?: string };
  posted_ts?: number; // ms epoch
  close_ts?: number;  // ms epoch
  keywords?: { label?: string }[];
  sectors?: { name?: string }[];
}

interface SaraminResponse {
  jobs?: {
    count: number;
    start: number;
    total: number;
    job: SaraminJob[];
  };
  status: string;
  message?: string;
}

export const saraminOpenApiAdapter: JobSourceAdapter = {
  code: 'saramin-openapi',
  region: 'kr',

  async fetchList(): Promise<RawJobItem[]> {
    if (!API_KEY) {
      console.warn('[saramin-openapi] SARAMIN_API_KEY 미설정 — 스킵');
      return [];
    }

    const allItems: RawJobItem[] = [];
    const seenIds = new Set<string>();

    // 키워드별로 첫 페이지만 수집 (서버 부하 + 중복 방지)
    for (const keyword of KEYWORDS) {
      try {
        const res = await axios.get<SaraminResponse>(ENDPOINT, {
          params: {
            'access-key': API_KEY,
            'keywords': keyword,
            'count': 50,
            'start': 0,
            'job_type': '1',         // 정규직+계약직
            'job_category': '4,11,12,17', // 연구·IT·교육·공공
          },
          timeout: 20000,
          headers: { Accept: 'application/json' },
        });

        const data = res.data;
        if (data?.status !== 'success') {
          console.warn('[saramin-openapi] API 오류:', data?.message || 'unknown');
          continue;
        }

        for (const job of data?.jobs?.job ?? []) {
          if (!job?.id || seenIds.has(job.id)) continue;
          seenIds.add(job.id);

          const title = (job.title?.raw || job.title?.keyword || '').trim();
          if (!title) continue;

          const org = (job.company?.detail?.name || job.company?.name || '').trim();
          const location = job.position?.location?.name || '';
          const employmentType = job.employment_type?.name || '';
          const education = job.education?.name || '';
          const career = job.career?.name || '';
          const summary = [org, location, employmentType, education, career]
            .filter(Boolean).join(' · ');

          const url = job.url || `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${job.id}`;

          allItems.push({
            external_id: `saramin:${job.id}`,
            canonical_url: url,
            title: sanitizePII(title).slice(0, 300),
            organization: org || undefined,
            category: inferCategory(title),
            fields: extractFields(title),
            deadline: job.close_ts ? new Date(job.close_ts) : null,
            posted_at: job.posted_ts ? new Date(job.posted_ts) : null,
            summary: sanitizePII(summary || title).slice(0, 500),
            description_html: '',
          });
        }
      } catch (e) {
        const msg = (e as Error).message || String(e);
        console.error(`[saramin-openapi] keyword "${keyword}" 실패:`, msg.slice(0, 200));
        // 한 키워드 실패가 전체를 막지 않음
      }
    }

    return allItems;
  },
};

const FIELD_KEYWORDS: Record<string, string[]> = {
  'AI': ['ai', '인공지능', '머신러닝', '딥러닝', 'ml', 'nlp', 'llm'],
  '바이오': ['바이오', '생명', '의학', '제약', '헬스', 'bt', '바이오테크'],
  'ICT': ['소프트웨어', '개발자', '프로그래머', 'it', 'ict', '정보통신', '백엔드', '프론트엔드', 'devops', 'sre'],
  '연구': ['연구원', '연구직', 'r&d', 'rnd', '연구개발', '박사', '석사'],
  '교육': ['교수', '강사', '교원', '교육', '강의', '학습'],
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
  if (/교수|조교수|부교수|전임강사|특임교수|초빙/.test(lower)) return 'professor';
  if (/박사후|포닥|post[- ]?doc/.test(lower)) return 'postdoc';
  if (/대학원|graduate|석사|박사/.test(lower)) return 'graduate';
  if (/연구원|연구직|위촉|r&d|rnd/.test(lower)) return 'researcher';
  return 'staff';
}