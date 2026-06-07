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

async function checkServer(server: ServerRow): Promise<{ status: ServerStatus; latency: number }> {
  const start = Date.now();
  try {
    const res = await axios.get(server.url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 ScholarLink/1.0' },
      maxRedirects: 3,
      validateStatus: () => true,
    });
    const latency = Date.now() - start;

    if (res.status === 403 || res.status === 429) return { status: 'BLOCKED', latency };
    if (res.status >= 200 && res.status < 400) {
      if (latency > 10000) return { status: 'SLOW', latency };
      return { status: 'ONLINE', latency };
    }
    return { status: 'OFFLINE', latency };
  } catch (err: unknown) {
    const latency = Date.now() - start;
    if (axios.isAxiosError(err) && err.response?.status === 403) {
      return { status: 'BLOCKED', latency };
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
      `SELECT id, name, url, type FROM download_servers WHERE is_active = true AND type IN ('libgen','archive','library')`
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
