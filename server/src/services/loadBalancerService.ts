import { pool } from '../db/pool';

export interface ServerInfo {
  id: number;
  name: string;
  url: string;
  type: string;
  status: string;
  avg_latency: number;
}

// 모니터링 없이 모든 활성 서버를 반환 — 다운로드 시 순차 시도
export async function getAvailableServers(type?: string): Promise<ServerInfo[]> {
  const typeFilter = type ? 'AND type = $1' : '';
  const typeParams = type ? [type] : [];

  const { rows } = await pool.query<ServerInfo>(
    `SELECT id, name, url, type, status, avg_latency
     FROM download_servers
     WHERE is_active = true
       ${typeFilter}
     ORDER BY type, name`,
    typeParams
  );
  return rows;
}

export function pickServer(servers: ServerInfo[]): ServerInfo {
  if (servers.length === 0) throw new Error('사용 가능한 서버가 없습니다.');
  // 랜덤 선택 (모든 서버 동등 취급)
  return servers[Math.floor(Math.random() * servers.length)];
}
