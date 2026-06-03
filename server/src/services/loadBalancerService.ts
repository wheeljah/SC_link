import { pool } from '../db/pool';

export interface ServerInfo {
  id: number;
  name: string;
  url: string;
  type: string;
  status: string;
  avg_latency: number;
}

export async function getAvailableServers(type?: string): Promise<ServerInfo[]> {
  const { rows } = await pool.query<ServerInfo>(
    `SELECT id, name, url, type, status, avg_latency
     FROM download_servers
     WHERE is_active = true
       AND status IN ('ONLINE', 'SLOW')
       ${type ? "AND type = $1" : ""}
     ORDER BY CASE status WHEN 'ONLINE' THEN 0 ELSE 1 END, avg_latency ASC`,
    type ? [type] : []
  );
  return rows;
}

export function pickServer(servers: ServerInfo[]): ServerInfo {
  if (servers.length === 0) throw new Error('사용 가능한 서버가 없습니다.');

  const weighted = servers.map(s => ({
    ...s,
    weight: s.status === 'SLOW' ? 0.3 : 1.0,
  }));
  const total = weighted.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;

  for (const s of weighted) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return weighted[0];
}
