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
  const typeFilter = type ? 'AND type = $1' : '';
  const typeParams = type ? [type] : [];

  // 1순위: ONLINE/SLOW 서버
  const { rows: healthy } = await pool.query<ServerInfo>(
    `SELECT id, name, url, type, status, avg_latency
     FROM download_servers
     WHERE is_active = true
       AND status IN ('ONLINE', 'SLOW')
       ${typeFilter}
     ORDER BY CASE status WHEN 'ONLINE' THEN 0 ELSE 1 END, avg_latency ASC`,
    typeParams
  );
  if (healthy.length > 0) return healthy;

  // 2순위: 헬스체크 결과와 무관하게 전체 활성 서버 반환
  // (네트워크 환경에 따라 헬스체크가 실패해도 실제 논문 요청은 성공할 수 있음)
  console.log('[loadBalancer] No ONLINE/SLOW servers — falling back to ALL active servers');
  const { rows: all } = await pool.query<ServerInfo>(
    `SELECT id, name, url, type, status, avg_latency
     FROM download_servers
     WHERE is_active = true
       ${typeFilter}
     ORDER BY type, name`,
    typeParams
  );
  return all;
}

export function pickServer(servers: ServerInfo[]): ServerInfo {
  if (servers.length === 0) throw new Error('사용 가능한 서버가 없습니다.');

  // ONLINE 서버 우선, 없으면 전체에서 랜덤
  const preferred = servers.filter(s => s.status === 'ONLINE' || s.status === 'SLOW');
  const pool2 = preferred.length > 0 ? preferred : servers;

  const weighted = pool2.map(s => ({
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
