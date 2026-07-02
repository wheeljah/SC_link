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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- 개인정보 동의 시각 (PIPA §22 증빙). NULL이면 동의 안 받음.
  consent_terms_at TIMESTAMP,
  consent_privacy_at TIMESTAMP,
  consent_marketing_at TIMESTAMP
);

-- 기존 테이블 마이그레이션 (이미 users 테이블이 있는 경우 대비)
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_terms_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_privacy_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_marketing_at TIMESTAMP;

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

-- 인용 네트워크 캐시 (OpenAlex 기반)
CREATE TABLE IF NOT EXISTS citation_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(500) UNIQUE NOT NULL,
  seed_doi VARCHAR(255) NOT NULL,
  depth SMALLINT NOT NULL CHECK (depth BETWEEN 1 AND 2),
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('both', 'cites', 'cited_by')),
  max_nodes SMALLINT NOT NULL,
  graph_data JSONB NOT NULL,
  node_count INTEGER NOT NULL,
  edge_count INTEGER NOT NULL,
  build_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_citation_cache_seed ON citation_cache(seed_doi);
CREATE INDEX IF NOT EXISTS idx_citation_cache_expires ON citation_cache(expires_at);

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
  ('Crossref TDM',     'https://api.crossref.org',         'oa',  false, 'International', '출판사 등록 text-mining 전문 링크 — key 불필요'),
  ('OSF Preprints',    'https://api.osf.io',               'oa',  false, 'International', 'PsyArXiv·SocArXiv 등 프리프린트 통합 — key 불필요'),
  ('DataCite',         'https://api.datacite.org',         'oa',  false, 'International', '데이터셋·학위논문·기관 리포지터리 DOI — key 불필요'),
  ('Figshare',         'https://api.figshare.com',         'oa',  false, 'International', '그림·포스터·학위논문·프리프린트 등 공개 자료 — key 불필요'),
  ('INSPIRE-HEP',       'https://inspirehep.net',           'oa',  false, 'International', '고에너지물리·천체물리 — arXiv ID 경유 PDF 취득, 150만+ 레코드'),
  ('NASA NTRS',         'https://ntrs.nasa.gov',            'oa',  false, 'USA',           'NASA 기술보고서 서버 — 항공우주·우주탐사 전문, 공개 보고서 직접 다운로드'),
  ('OAPEN',             'https://library.oapen.org',        'oa',  false, 'International', 'Open Access Publishing in European Networks — 50,000+ OA 학술 도서, DSpace REST API'),
  ('DOAB',              'https://doabooks.org',             'oa',  false, 'International', '오픈액세스 도서 디렉터리 — OA 도서 메타데이터·PDF 링크 색인, 80,000+ 타이틀'),
  ('IA Books',          'https://archive.org',              'oa',  false, 'International', 'Internet Archive 텍스트 아카이브 — 공개 도메인·OA 도서 전문, DOI 검색'),
  ('ChemRxiv',          'https://chemrxiv.org',             'oa',  false, 'International', '화학·재료 프리프린트 — Cambridge Open Engage API, key 불필요'),
  ('Preprints.org',     'https://www.preprints.org',        'oa',  false, 'International', 'MDPI 프리프린트 — DOI 패턴 직접 PDF, key 불필요'),
  ('Springer Nature',   'https://link.springer.com',         'oa',  false, 'International', '260만+ OA 논문·도서를 SpringerLink에서 직접 취득 — Crossref DOI 경유 PDF, 구독 논문은 자동 스킵'),
  ('PLOS',             'https://journals.plos.org',          'oa',  false, 'International', 'Public Library of Science — PLOS ONE/Biology/Medicine 등 완전 OA, DOI 직접 PDF URL'),
  ('Science/AAAS',     'https://www.science.org',            'oa',  false, 'International', 'Science, Science Signaling 등 AAAS 시리즈 — OA 아티클 PDF 직접 다운로드, 구독 아티클은 자동 스킵'),
  ('Cell Press',       'https://www.cell.com',               'oa',  false, 'International', 'Cell, Neuron, Immunity 등 Cell Press 시리즈 — OA 버전 PDF, 구독 아티클은 자동 스킵')
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
  // 행정구역 컬럼 추가
  { sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS region VARCHAR(20)`, params: [] },
  { sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS region_ip VARCHAR(20)`, params: [] },
  // 커뮤니티 답변 이메일 알림 수신 동의 (기본 TRUE — 기존 사용자 호환)
  { sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_community_response BOOLEAN DEFAULT TRUE`, params: [] },
  // 국가 코드 (ISO 3166-1 alpha-2) — 외국인 가입 허용 (2026-06-28 추가)
  { sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT NULL`, params: [] },
  { sql: `CREATE INDEX IF NOT EXISTS idx_users_country ON users(country_code)`, params: [] },

  // ─────────────────────────────────────────────────────────────────────
  // 🎓 커리어 (대학원·연구원 모집공고) — 2026-07-02 추가
  // ─────────────────────────────────────────────────────────────────────

  // 소스 정의 (어떤 사이트를 어디서 어떻게 가져오는지)
  { sql: `CREATE TABLE IF NOT EXISTS job_sources (
    id              SERIAL PRIMARY KEY,
    code            VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    base_url        TEXT NOT NULL,
    crawl_method    VARCHAR(20) NOT NULL,
    cron_expr       VARCHAR(50) DEFAULT '0 */12 * * *',
    enabled         BOOLEAN DEFAULT TRUE,
    robots_txt_url  TEXT,
    last_crawled_at TIMESTAMP,
    last_status     VARCHAR(20),
    last_error      TEXT,
    rate_limit_ms   INTEGER DEFAULT 3000,
    region          VARCHAR(10) DEFAULT 'kr',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, params: [] },
  { sql: `CREATE INDEX IF NOT EXISTS idx_job_sources_enabled ON job_sources(enabled)`, params: [] },

  // 정규화된 공고 (source별 unique 제약)
  { sql: `CREATE TABLE IF NOT EXISTS job_postings (
    id                SERIAL PRIMARY KEY,
    source_id         INTEGER REFERENCES job_sources(id) ON DELETE CASCADE,
    external_id       VARCHAR(255) NOT NULL,
    canonical_url     TEXT NOT NULL,
    title             TEXT NOT NULL,
    organization      VARCHAR(255),
    category          VARCHAR(30),
    fields            TEXT[],
    deadline          TIMESTAMP,
    posted_at         TIMESTAMP,
    summary           TEXT,
    description_html  TEXT,
    description_hash  VARCHAR(64),
    language          VARCHAR(10) DEFAULT 'ko',
    region            VARCHAR(10) DEFAULT 'kr',
    is_active         BOOLEAN DEFAULT TRUE,
    is_removed        BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_id, external_id)
  )`, params: [] },
  { sql: `CREATE INDEX IF NOT EXISTS idx_job_postings_deadline ON job_postings(deadline) WHERE is_active = TRUE`, params: [] },
  { sql: `CREATE INDEX IF NOT EXISTS idx_job_postings_category ON job_postings(category)`, params: [] },
  { sql: `CREATE INDEX IF NOT EXISTS idx_job_postings_active   ON job_postings(is_active) WHERE is_active = TRUE`, params: [] },
  { sql: `CREATE INDEX IF NOT EXISTS idx_job_postings_fields   ON job_postings USING GIN (fields)`, params: [] },
  { sql: `CREATE INDEX IF NOT EXISTS idx_job_postings_search   ON job_postings USING GIN (to_tsvector('simple', title || ' ' || COALESCE(organization, '')))`, params: [] },
  { sql: `CREATE INDEX IF NOT EXISTS idx_job_postings_region   ON job_postings(region)`, params: [] },

  // 사용자 키워드 구독
  { sql: `CREATE TABLE IF NOT EXISTS job_subscriptions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    keywords      TEXT[] NOT NULL,
    categories    TEXT[],
    notify_email  BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, params: [] },
  { sql: `CREATE INDEX IF NOT EXISTS idx_job_subs_user ON job_subscriptions(user_id)`, params: [] },

  // 스크랩
  { sql: `CREATE TABLE IF NOT EXISTS job_bookmarks (
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    job_id     INTEGER REFERENCES job_postings(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, job_id)
  )`, params: [] },

  // 삭제 요청 (DMCA / 권리자 대응)
  { sql: `CREATE TABLE IF NOT EXISTS job_removal_requests (
    id              SERIAL PRIMARY KEY,
    source_id       INTEGER REFERENCES job_sources(id),
    external_id     VARCHAR(255),
    requester_email VARCHAR(255) NOT NULL,
    reason          TEXT,
    status          VARCHAR(20) DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at    TIMESTAMP
  )`, params: [] },

  // 크롤러 실행 로그
  { sql: `CREATE TABLE IF NOT EXISTS job_crawl_logs (
    id            SERIAL PRIMARY KEY,
    source_id     INTEGER REFERENCES job_sources(id) ON DELETE CASCADE,
    started_at    TIMESTAMP NOT NULL,
    finished_at   TIMESTAMP,
    items_new     INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    status        VARCHAR(20),
    error         TEXT
  )`, params: [] },
  { sql: `CREATE INDEX IF NOT EXISTS idx_job_crawl_logs_source ON job_crawl_logs(source_id, started_at DESC)`, params: [] },

  // 해외 공고 출시 알림 구독자 (비로그인 가능)
  { sql: `CREATE TABLE IF NOT EXISTS foreign_interest_signup (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    fields          TEXT[],
    source          VARCHAR(50) DEFAULT 'web',
    notified_at     TIMESTAMP,
    unsubscribed_at TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`, params: [] },
  { sql: `CREATE INDEX IF NOT EXISTS idx_foreign_interest_notified ON foreign_interest_signup(notified_at)`, params: [] },

  // 초기 시드 — KISTI RSS + KAIST Cheerio + 5개 국립대 채용 + 산학협력단 + 국책연구기관 (2026-07-02 추가)
  // cron 분산: KAIST=04:00·16:00, 서울대=05:00·17:00, 부산대=06:00·18:00,
  //            경북대=07:00·19:00, UNIST=08:00·20:00, 제주대=09:00·21:00 (KST)
  //            W3 신규: 서울대RND=10·22, 경북대RND=11·23, KIST=12·00, IBS=13·01 (KST)
  { sql: `INSERT INTO job_sources (code, name, base_url, crawl_method, cron_expr, robots_txt_url, rate_limit_ms, region, enabled)
   VALUES
     ('kisti-rss',        'KISTI RSS',              'https://www.kisti.re.kr',                            'rss',     '0 3,15 * * *',  'https://www.kisti.re.kr/robots.txt',     3000, 'kr', TRUE),
     ('kaist-cheerio',    'KAIST 채용/초빙',         'https://www.kaist.ac.kr/kr/html/footer/0814.html',  'cheerio', '0 4,16 * * *',  'https://www.kaist.ac.kr/robots.txt',    4000, 'kr', TRUE),
     ('snu-cheerio',      '서울대 채용공지',         'https://www.snu.ac.kr/snunow/notice/job-openings',  'cheerio', '0 5,17 * * *',  NULL,                                  4000, 'kr', TRUE),
     ('pusan-cheerio',    '부산대 채용',             'https://www.pusan.ac.kr/kor/CMS/Board/Board.do?mCode=MN103', 'cheerio', '0 6,18 * * *', NULL,                       4000, 'kr', TRUE),
     ('knu-cheerio',      '경북대 채용',             'https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/list.action?bbs_cde=8&menu_idx=220', 'cheerio', '0 7,19 * * *', NULL,    4000, 'kr', TRUE),
     ('unist-cheerio',    'UNIST 채용공고',         'http://www.unist.ac.kr/unist/etc/notification/employment.do', 'cheerio', '0 8,20 * * *', 'http://www.unist.ac.kr/robots.txt',     4000, 'kr', TRUE),
     ('jejunu-cheerio',   '제주대 채용',             'https://www.jejunu.ac.kr/ara/noticesurvey/recruit.htm', 'cheerio', '0 9,21 * * *', 'https://www.jejunu.ac.kr/robots.txt',    4000, 'kr', TRUE),
     ('snu-rnd-cheerio',  '서울대 산학협력단 채용',  'https://snurnd.snu.ac.kr/board/recruit',            'cheerio', '0 10,22 * * *', NULL,                                  4000, 'kr', TRUE),
     ('knu-rnd-cheerio',  '경북대 산학협력단 채용',  'https://iac.knu.ac.kr/Employment?menuId=MENU_0000000334', 'cheerio', '0 11,23 * * *', NULL,                       4000, 'kr', TRUE),
     ('kist-cheerio',     'KIST 채용공고',           'https://www.kist.re.kr/ko/notice/employment-announcement.do', 'cheerio', '0 12,0 * * *', 'https://www.kist.re.kr/robots.txt', 4000, 'kr', TRUE),
     ('ibs-cheerio',      'IBS 채용공고',           'https://www.ibs.re.kr/prog/recruit/kor/sub04_01/list.do', 'cheerio', '0 13,1 * * *', 'https://www.ibs.re.kr/robots.txt',  4000, 'kr', TRUE),
     ('yonsei-rnd-cheerio',     '연세대 산학협력단 채용',     'https://research.yonsei.ac.kr/research/service/recruit.do', 'cheerio', '0 14,2 * * *', NULL,                                  4000, 'kr', TRUE),
     ('yonsei-faculty-cheerio', '연세대 전임교원 초빙',     'https://faculty.yonsei.ac.kr/recruit/index.php?lang=ko', 'cheerio', '0 15,3 * * *', NULL,                                  4000, 'kr', TRUE),
     ('worknet-openapi',        '워크넷 Open API (data.go.kr)', 'https://apis.data.go.kr/B552474/SmJobRecruitInfo/getSmJobRecruitList', 'openapi', '0 16,4 * * *', NULL,                              3000, 'kr', FALSE)
   ON CONFLICT (code) DO NOTHING`, params: [] },

  // 🎓 커리어 — NRF 영구 제외 (2026-07-02: robots.txt Disallow: /)
  // CREATE TABLE job_sources + INSERT 시드 뒤에 와야 안전 (이전 버전은 silent fail)
  { sql: `UPDATE job_sources SET enabled = FALSE, last_error = 'excluded: robots.txt Disallow: /' WHERE code = 'nrf-cheerio'`, params: [] },
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
