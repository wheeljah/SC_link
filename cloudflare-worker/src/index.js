/**
 * ScholarLink — Cloudflare Worker Proxy
 *
 * 역할: Render 서버 IP가 shadow library(sci-hub/libgen/anna's archive)에서
 *       차단될 경우, CF 엣지 IP를 통해 우회 요청을 중계합니다.
 *
 * 배포: https://dash.cloudflare.com → Workers & Pages → Create Worker
 *       이 파일 내용을 붙여넣고 배포 후 URL을 Render 환경변수에 설정
 *       CF_PROXY_URL=https://{worker-name}.{account}.workers.dev
 */

// 허용할 도메인 목록 (shadow library 미러 + sci-hub.run API 백엔드)
const ALLOWED_HOSTS = new Set([
  'sci-hub.kr',
  'sci-hub.st',
  'sci-hub.sh',
  'sci-hub.run',
  'fast.wbleb.com',   // sci-hub.run API backend
  'libgen.rs',
  'libgen.st',
  'library.lol',
  'annas-archive.gl',
  'annas-archive.pk',
  'twin.sci-hub.kr',
  'twin.sci-hub.st',
  'twin.sci-hub.sh',
]);

// sci-hub PDF CDN 패턴 (다운로드 URL에 자주 등장하는 서브도메인)
const ALLOWED_PATTERNS = [
  /^[a-z0-9-]+\.sci-hub\.[a-z]+$/,
  /^[a-z0-9-]+\.libgen\.[a-z]+$/,
];

function isAllowed(hostname) {
  if (ALLOWED_HOSTS.has(hostname)) return true;
  return ALLOWED_PATTERNS.some(p => p.test(hostname));
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // 헬스체크
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', ts: Date.now() }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const targetParam = url.searchParams.get('url');
    if (!targetParam) {
      return new Response('Missing ?url= parameter', { status: 400, headers: CORS_HEADERS });
    }

    let targetUrl;
    try {
      targetUrl = new URL(targetParam);
    } catch {
      return new Response('Invalid URL', { status: 400, headers: CORS_HEADERS });
    }

    // 도메인 화이트리스트 검사
    if (!isAllowed(targetUrl.hostname)) {
      return new Response(`Domain not allowed: ${targetUrl.hostname}`, {
        status: 403, headers: CORS_HEADERS,
      });
    }

    // HTTPS 강제
    targetUrl.protocol = 'https:';

    try {
      const resp = await fetch(targetUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': `${targetUrl.protocol}//${targetUrl.hostname}/`,
        },
        redirect: 'follow',
        cf: { cacheTtl: 0 },
      });

      // 응답 헤더 복사 + CORS 추가
      const respHeaders = new Headers(resp.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => respHeaders.set(k, v));
      // Render 백엔드가 리다이렉트된 최종 URL을 알 수 있도록
      respHeaders.set('X-Final-Url', resp.url || targetUrl.toString());

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: respHeaders,
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Proxy fetch failed', message: e.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }
  },
};
