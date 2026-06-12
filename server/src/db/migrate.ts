import { pool } from './pool';

const SQL = `
-- 확장 모듈
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 사용자 (이메일 전용 인증)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(100),
  email_verified BOOLEAN DEFAULT FALSE,
  tier VARCHAR(50) DEFAULT 'free',
  download_count INTEGER DEFAULT 0,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 이메일 인증 토큰
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 비밀번호 재설정 토큰
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- JWT 블랙리스트 (로그아웃)
CREATE TABLE IF NOT EXISTS token_blacklist (
  id SERIAL PRIMARY KEY,
  token_jti VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 다운로드 서버 목록
CREATE TABLE IF NOT EXISTS download_servers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'checking',
  last_checked TIMESTAMP,
  last_success TIMESTAMP,
  success_rate DECIMAL(5,2) DEFAULT 0,
  avg_latency INTEGER DEFAULT 0,
  location VARCHAR(255),
  requires_login BOOLEAN DEFAULT FALSE,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- 서버별 사용자 자격증명
CREATE TABLE IF NOT EXISTS user_server_credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  server_id INTEGER REFERENCES download_servers(id) ON DELETE CASCADE,
  login_id VARCHAR(255) NOT NULL,
  password_enc TEXT NOT NULL,
  enc_iv VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, server_id)
);

-- 논문 요청/다운로드 이력
CREATE TABLE IF NOT EXISTS paper_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  input_type VARCHAR(50) NOT NULL,
  input_value VARCHAR(1000) NOT NULL,
  normalized_doi VARCHAR(255),
  title VARCHAR(500),
  authors TEXT,
  journal VARCHAR(255),
  year INTEGER,
  server_id INTEGER REFERENCES download_servers(id),
  status VARCHAR(50) DEFAULT 'pending',
  file_path VARCHAR(500),
  file_size BIGINT,
  downloaded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 서플리먼트 파일
CREATE TABLE IF NOT EXISTS supplements (
  id SERIAL PRIMARY KEY,
  paper_id INTEGER REFERENCES paper_requests(id) ON DELETE CASCADE,
  name VARCHAR(255),
  type VARCHAR(50),
  url VARCHAR(1000),
  file_path VARCHAR(500),
  file_size BIGINT
);

-- 커뮤니티 요청
CREATE TABLE IF NOT EXISTS community_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  doi VARCHAR(255),
  status VARCHAR(50) DEFAULT 'open',
  fulfilled_by INTEGER REFERENCES users(id),
  fulfilled_at TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 커뮤니티 응답
CREATE TABLE IF NOT EXISTS community_responses (
  id SERIAL PRIMARY KEY,
  request_id INTEGER REFERENCES community_requests(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  message TEXT,
  file_url VARCHAR(1000),
  file_size BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 광고 배너
CREATE TABLE IF NOT EXISTS ad_banners (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  position VARCHAR(20) NOT NULL CHECK (position IN ('TOP', 'BOTTOM')),
  type VARCHAR(20) DEFAULT 'TEXT' CHECK (type IN ('TEXT', 'IMAGE_TEXT', 'RICH')),
  icon VARCHAR(10),
  message TEXT NOT NULL,
  cta_text VARCHAR(100),
  cta_url VARCHAR(500),
  image_url VARCHAR(500),
  advertiser_name VARCHAR(255),
  bg_color VARCHAR(20) DEFAULT '#0f172a',
  text_color VARCHAR(20) DEFAULT '#ffffff',
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'EXPIRED')),
  priority INTEGER DEFAULT 0,
  start_at TIMESTAMP,
  end_at TIMESTAMP,
  click_count INTEGER DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 전문검색 인덱스
CREATE INDEX IF NOT EXISTS idx_paper_requests_user ON paper_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_paper_requests_doi ON paper_requests(normalized_doi);
CREATE INDEX IF NOT EXISTS idx_community_status ON community_requests(status);
CREATE INDEX IF NOT EXISTS idx_community_user ON community_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_servers_status ON download_servers(status);

-- 에러 보고
CREATE TABLE IF NOT EXISTS bug_reports (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT        NOT NULL,
  doi         VARCHAR(500),
  status      VARCHAR(20)  NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','resolved')),
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);

-- 기본 서버 데이터 (2026-06 업데이트)
INSERT INTO download_servers (name, url, type, requires_login, location, notes) VALUES
  ('Internet Archive', 'https://archive.org',              'ia',  false, 'International', 'Puppeteer 필요'),
  ('arXiv',            'https://arxiv.org',                'oa',  false, 'International', '물리/수학/컴사이언스/경제 프리프린트 — API 기반'),
  ('Zenodo',           'https://zenodo.org',               'oa',  false, 'International', 'CERN 운영 오픈 리포지터리 — 전분야'),
  ('bioRxiv',          'https://biorxiv.org',              'oa',  false, 'International', '생명과학 프리프린트 서버 — biorXiv API'),
  ('medRxiv',          'https://medrxiv.org',              'oa',  false, 'International', '의학 프리프린트 서버 — biorXiv API'),
  ('OpenAIRE',         'https://api.openaire.eu',          'oa',  false, 'EU',            'EU 지원 연구 OA 저장소 — Graph API v1, 2500만+ 전문'),
  ('OA.mg',            'https://api.oa.mg',                'oa',  false, 'International', '2.4억 논문 인덱스 — Unpaywall 유사 API, key 불필요'),
  ('DOAJ',             'https://doaj.org',                 'oa',  false, 'International', '순수 OA 저널 색인 — rate limit 없음, key 불필요'),
  ('IA Scholar',       'https://scholar.archive.org',      'oa',  false, 'International', 'Internet Archive 보존 2500만+ 전문 — fatcat API, 폐간 논문 강점'),
  ('HAL',              'https://api.archives-ouvertes.fr', 'oa',  false, 'France',        '프랑스 국립 OA 저장소 — 유럽 연구 전문, key 불필요'),
  ('Crossref TDM',     'https://api.crossref.org',         'oa',  false, 'International', '출판사 등록 text-mining 전문 링크 — key 불필요')
ON CONFLICT DO NOTHING;

-- 광고 배너
INSERT INTO ad_banners (title, position, type, icon, message, cta_text, cta_url, advertiser_name, bg_color, text_color, priority) VALUES
  (
    'BidVibe 상단 배너', 'TOP', 'TEXT', NULL,
    '수수료 없는 연구자-공급사 매칭 플랫폼',
    '지금 등록 →', 'https://ai-traffic.kr', '비드바이브(BidVibe)',
    '#0f172a', '#ffffff', 10
  ),
  (
    'BidVibe 하단 배너', 'BOTTOM', 'IMAGE_TEXT', NULL,
    '요청하면 견적이 다~ 온다 -- 수수료 없는 연구자-공급사 매칭 플랫폼',
    '무료로 시작하기', 'https://ai-traffic.kr', 'BidVibe',
    '#ffffff', '#0f172a', 10
  )
ON CONFLICT DO NOTHING;
`;

// ── 런타임 업데이트 ─────────────────────────────────────────────────────────
// INSERT의 ON CONFLICT DO NOTHING으로 처리 안 되는 기존 레코드 수정 사항
const RUNTIME_UPDATES: { sql: string; params: (string | boolean)[] }[] = [
  // sci-hub 서버 전체 삭제
  {
    sql: `DELETE FROM download_servers WHERE type = 'scihub'`,
    params: [],
  },
  // libgen / zlibrary / archive 서버 전체 삭제
  {
    sql: `DELETE FROM download_servers WHERE type IN ('libgen','zlibrary','archive')`,
    params: [],
  },
  // 배너 문구 최신화
  {
    sql: `UPDATE ad_banners SET message = $1
          WHERE position = 'TOP' AND advertiser_name = '비드바이브(BidVibe)'`,
    params: ['엑셀로 공급사 그만 찾고, 비드바이세(BidVibe)'],
  },
  {
    sql: `UPDATE ad_banners SET message = $1
          WHERE position = 'BOTTOM' AND advertiser_name = 'BidVibe'`,
    params: ['엑셀로 공급사 그만 찾고, 비드바이브(BidVibe)'],
  },
];

export async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(SQL);
    for (const { sql, params } of RUNTIME_UPDATES) {
      await client.query(sql, params);
    }
  } finally {
    client.release();
  }
}
