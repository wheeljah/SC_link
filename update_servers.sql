-- 기존 서버 비활성화
UPDATE download_servers SET is_active = false;

-- 최신 작동 확인된 서버로 교체 (2026-06 기준)
INSERT INTO download_servers (name, url, type, requires_login, location, is_active, status) VALUES
  -- Sci-Hub (연결 테스트 200 확인)
  ('Sci-Hub.run',  'https://sci-hub.run',  'scihub', false, 'International', true, 'checking'),
  ('Sci-Hub.ru',   'https://sci-hub.ru',   'scihub', false, 'Russia',        true, 'checking'),
  ('Sci-Hub.ren',  'https://sci-hub.ren',  'scihub', false, 'International', true, 'checking'),
  ('Sci-Hub.st',   'https://sci-hub.st',   'scihub', false, 'International', true, 'checking'),
  -- LibGen (연결 테스트 200 확인)
  ('LibGen.li',    'https://libgen.li',    'libgen', false, 'International', true, 'checking'),
  ('LibGen.lc',    'https://libgen.lc',    'libgen', false, 'International', true, 'checking'),
  ('LibGen.is',    'https://libgen.is',    'libgen', false, 'Russia',        true, 'checking'),
  -- Z-Library (singlelogin = 공식 로그인 게이트웨이)
  ('Z-Library',    'https://singlelogin.re', 'zlibrary', true, 'International', true, 'checking'),
  -- Anna''s Archive (연결 테스트 200 확인)
  ('Anna''s Archive', 'https://annas-archive.gs', 'archive', false, 'International', true, 'checking')
ON CONFLICT DO NOTHING;

SELECT id, name, url, status, is_active FROM download_servers ORDER BY type, name;
