// server/src/services/jobSources/worknetOpenApiAdapter.ts
// 워크넷(한국고용정보원) Open API 어댑터 — 공공데이터(data.go.kr)
//
// 페이지: https://www.data.go.kr/data/3038225/openapi.do (한국고용정보원_워크넷 채용정보)
// 인증키 필요: data.go.kr에서 Open API 활용 신청 → 발급키를
//              환경변수 WORKNET_API_KEY 에 등록하면 자동 활성화.
//
// 정책:
//  - 사립/공기업/공공기관 구분 없이 정부 통합 구인정보 제공
//  - robots.txt 차단 없음 (공공데이터는 별도 제약)
//  - 데이터는 XML 또는 JSON 응답 (현재 JSON 호출)
//  - 키워드 검색으로 학술/연구직 위주 필터링 가능
//
// 사용법:
//  1. data.go.kr/data/3038225 → "활용신청" → 인증키(decoding 키) 발급
//  2. Render 환경변수 WORKNET_API_KEY = <발급키> 설정
//  3. 크롤러 자동 활성화
//
// API 키 미설정 시: enabled=false 자동 비활성화 (로그만 남김)

import axios from 'axios';
import { JobSourceAdapter, RawJobItem } from './types';
import { sanitizePII } from './piiSanitizer';

const API_KEY = process.env.WORKNET_API_KEY || '';
const ENDPOINT = 'https://apis.data.go.kr/B552474/SmJobRecruitInfo/getSmJobRecruitList';
// 공공데이터 표준 파라미터 — 한국고용정보원 워크넷 채용정보 목록
const DEFAULT_PARAMS: Record<string, string> = {
  // 과학기술/연구 관련 직종 — 필요 시 환경변수로 조정
  // 직종코드: 한국고용정보원 분류(2자리). 23=연구직/과학기술
  // 검색어/직종코드 둘 다 미지정 시 채용 전체를 가져옴 → 1000건+ 가능
};

interface WorknetItem {
  recrutPblntSn?: string;       // 채용공고번호 (PK)
  companyNm?: string;           // 회사명
  bsnsSummeryCn?: string;       // 모집요약
  recrutPbancTtl?: string;      // 채용제목
  workregionNm?: string;        // 근무지역명
  acdmcrNm?: string;            // 학력명
  careerNm?: string;            // 경력명
  empTypeNm?: string;           // 고용형태
  recrutSeNm?: string;          // 채용구분 (정규직/계약직 등)
  salarryPymntSeNm?: string;    // 임금형태
  salarryLstAt?: string;        // 급여
  frDtregis?: string;           // 등록일 (YYYYMMDDHHMMSS)
  toDtregis?: string;           // 마감일
  recrutUrl?: string;           // 채용정보 URL
  jobContens?: string;          // 직무내용
};

interface WorknetResponse {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      totalCount?: string | number;
      items?: WorknetItem[] | { item?: WorknetItem[] };
    };
  };
}

export const worknetOpenApiAdapter: JobSourceAdapter = {
  code: 'worknet-openapi',
  region: 'kr',

  async fetchList(): Promise<RawJobItem[]> {
    if (!API_KEY) {
      console.warn('[worknet-openapi] WORKNET_API_KEY 미설정 — 스킵');
      return [];
    }

    const params: Record<string, string | number> = {
      serviceKey: API_KEY,
      numOfRows: 100,
      pageNo: 1,
      resultType: 'json',
      // 학술/연구/IT 직종 위주 필터 — 키워드 OR 검색
      ...DEFAULT_PARAMS,
    };

    let data: WorknetResponse;
    try {
      const res = await axios.get<WorknetResponse>(ENDPOINT, {
        params,
        timeout: 20000,
        headers: { Accept: 'application/json' },
      });
      data = res.data;
    } catch (e) {
      console.error('[worknet-openapi] API 호출 실패:', (e as Error).message);
      return [];
    }

    if (data?.response?.header?.resultCode && data.response.header.resultCode !== '00') {
      console.error('[worknet-openapi] API 오류:', data.response.header.resultMsg);
      return [];
    }

    const raw = data?.response?.body?.items;
    if (!raw) return [];
    const itemList: WorknetItem[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.item)
        ? raw.item
        : raw.item
          ? [raw.item]
          : [];

    return itemList
      .filter(it => !!it && !!it.recrutPblntSn && !!it.recrutPbancTtl)
      .map(it => {
        const url = it.recrutUrl || `https://www.work24.go.kr/wkSearch/recruitView?recruitSn=${it.recrutPblntSn}`;
        const title = (it.recrutPbancTtl || '').trim();
        const org = (it.companyNm || '').trim();
        const summary = [org, it.workregionNm, it.empTypeNm, it.acdmcrNm, it.careerNm]
          .filter(Boolean).join(' · ');

        return {
          external_id: `worknet:${it.recrutPblntSn}`,
          canonical_url: url,
          title: sanitizePII(title).slice(0, 300),
          organization: org || undefined,
          category: inferCategory(title),
          fields: extractFields(title),
          deadline: parseCompactDateTime(it.toDtregis),
          posted_at: parseCompactDateTime(it.frDtregis),
          summary: sanitizePII(summary || title).slice(0, 500),
          description_html: sanitizePII(`${title}\n\n${it.bsnsSummeryCn || it.jobContens || ''}`.trim()).slice(0, 5000),
        };
      });
  },
};

function parseCompactDateTime(s: string | undefined): Date | null {
  if (!s) return null;
  // "20260605120000" 또는 "20260605" 형태
  const m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', sec = '00'] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec));
  return isNaN(date.getTime()) ? null : date;
}

const FIELD_KEYWORDS: Record<string, string[]> = {
  'AI': ['ai', '인공지능', '머신러닝', '딥러닝', '딥러닝', '데이터사이언스', 'ml', 'nlp'],
  '바이오': ['바이오', '생명', '의학', '제약', '헬스', '바이오테크'],
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
  if (/교수|조교수|부교수|전임강사/.test(lower)) return 'professor';
  if (/박사후|포닥|post[- ]?doc/.test(lower)) return 'postdoc';
  if (/대학원|graduate|석사|박사/.test(lower)) return 'graduate';
  if (/연구원|연구직|위촉|r&d/.test(lower)) return 'researcher';
  return 'staff';
}