import axios from 'axios';
import cron from 'node-cron';
import { pool } from '../db/pool';

type ServerStatus = 'ONLINE' | 'SLOW' | 'OFFLINE' | 'BLOCKED' | 'CHECKING' | 'HIDDEN';

interface ServerRow {
  id: number;
  name: string;
  url: string;
  type: string;
}

// 실제 브라우저처럼 보이는 UA — 봇 차단 방지
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 챌린지/보호 페이지 키워드 — HTTP 200이어도 BLOCKED 처리
const PROTECTION_KEYWORDS = [
  'DDoS-Guard', 'ddos-guard', 'ddos_guard',
  'Just a moment', 'Enable JavaScript and cookies',
  '_cf_chl', 'cf-browser-verification', 'cf_chl_opt',
  'Checking your browser',
  'Please wait while we check your browser',
];

async function checkServer(server: ServerRow): Promise<{ status: ServerStatus; latency: number }> {
  // sci-hub.run: 프론트는 CF로 차단될 수 있으므로 FastAPI 백엔드를 직접 확인
  const checkUrl = server.url.includes('sci-hub.run')
    ? 'https://fast.wbleb.com/'
    : server.url;

  const start = Date.now();

  const doRequest = async () =>
    axios.get(checkUrl, {
      timeout: 25000,
      headers: { 'User-Agent': BROWSER_UA },
      maxRedirects: 5,
      validateStatus: () => true,
    });

  try {
    const res = await doRequest();
    const latency = Date.now() - start;

    // 보호/챌린지 페이지 감지 (HTTP 200이어도 실제로는 차단됨)
    if (res.status === 200 && typeof res.data === 'string') {
      const blocked = PROTECTION_KEYWORDS.some(k => (res.data as string).includes(k));
      if (blocked) return { status: 'BLOCKED', latency };
    }

    if (res.status === 403 || res.status === 429) return { status: 'BLOCKED', latency };
    if (res.status === 503)                        return { status: 'SLOW', latency };
    if (res.status >= 200 && res.status < 400) {
      return { status: latency > 10000 ? 'SLOW' : 'ONLINE', latency };
    }
    return { status: 'OFFLINE', latency };
  } catch (err: unknown) {
    const latency = Date.now() - start;
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 403 || status === 429) return { status: 'BLOCKED', latency };
      if (status === 503)                   return { status: 'SLOW', latency };

      // 네트워크 오류(DNS/연결 거절) → 짧은 대기 후 1회 재시도
      if (!err.response && latency < 8000) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const res2 = await doRequest();
          const latency2 = Date.now() - start;
          if (res2.status === 403 || res2.status === 429) return { status: 'BLOCKED', latency: latency2 };
          if (res2.status === 503)                        return { status: 'SLOW', latency: latency2 };
          if (res2.status >= 200 && res2.status < 400) {
            return { status: latency2 > 10000 ? 'SLOW' : 'ONLINE', latency: latency2 };
          }
        } catch { /* fall through */ }
      }
    }
    return { status: 'OFFLINE', latency };
  }
}

async function updateServerStatus(serverId: number, status: ServerStatus, latency: number): Promise<void> {
  await pool.query(
    `UPDATE download_servers
     SET status = $1,
         last_checked = NOW(),
         last_success = CASE WHEN $1 IN ('ONLINE','SLOW') THEN NOW() ELSE last_success END,
         avg_latency = $2,
         success_rate = CASE WHEN $1 IN ('ONLINE','SLOW')
           THEN LEAST(100, COALESCE(success_rate,0) * 0.9 + 10)
           ELSE GREATEST(0, COALESCE(success_rate,0) * 0.9)
         END
     WHERE id = $3`,
    [status, latency, serverId]
  );
}

export async function checkAllServers(): Promise<void> {
  const { rows } = await pool.query<ServerRow>(
    `SELECT id, name, url, type FROM download_servers WHERE is_active = true`
  );
  await Promise.allSettled(
    rows.map(async (s) => {
      const result = await checkServer(s);
      await updateServerStatus(s.id, result.status, result.latency);
    })
  );
}

export function startMonitoringCron(): void {
  // Sci-Hub: 5분, LibGen/Archive: 10분, Z-Library: 15분
  cron.schedule('*/5 * * * *', async () => {
    const { rows } = await pool.query<ServerRow>(
      `SELECT id, name, url, type FROM download_servers WHERE is_active = true AND type = 'scihub'`
    );
    await Promise.allSettled(rows.map(async (s) => {
      const r = await checkServer(s);
      await updateServerStatus(s.id, r.status, r.latency);
    }));
  });

  cron.schedule('*/10 * * * *', async () => {
    const { rows } = await pool.query<ServerRow>(
      `SELECT id, name, url, type FROM download_servers WHERE is_active = true AND type IN ('libgen','archive','library','ia')`
    );
    await Promise.allSettled(rows.map(async (s) => {
      const r = await checkServer(s);
      await updateServerStatus(s.id, r.status, r.latency);
    }));
  });

  cron.schedule('*/15 * * * *', async () => {
    const { rows } = await pool.query<ServerRow>(
      `SELECT id, name, url, type FROM download_servers WHERE is_active = true AND type = 'zlibrary'`
    );
    await Promise.allSettled(rows.map(async (s) => {
      const r = await checkServer(s);
      await updateServerStatus(s.id, r.status, r.latency);
    }));
  });

  console.log('📡 서버 모니터링 크론 시작됨');
}
