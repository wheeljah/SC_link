require('dotenv').config();
const { Pool } = require('pg');
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scholarlink';
const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 10000 });

(async () => {
  try {
    // 1. 서버 상태 즉시 체크
    const axios = require('axios');
    const servers = await pool.query('SELECT id, name, url, type, status, is_active FROM download_servers ORDER BY id');
    console.log('\n=== [1/4] 현재 서버 상태 ===');
    
    const checks = servers.rows.map(async (s) => {
      const start = Date.now();
      let status = 'OFFLINE';
      try {
        const res = await axios.get(s.url, { timeout: 8000, maxRedirects: 3, validateStatus: () => true });
        const latency = Date.now() - start;
        if (res.status === 403 || res.status === 429) status = 'BLOCKED';
        else if (res.status >= 200 && res.status < 400) status = latency > 8000 ? 'SLOW' : 'ONLINE';
        else status = 'OFFLINE';
      } catch {
        status = 'OFFLINE';
      }
      return { id: s.id, name: s.name, url: s.url, type: s.type, currentStatus: s.status, newStatus: status, wasActive: s.is_active };
    });

    const results = await Promise.all(checks);
    results.forEach(r => {
      const changed = r.currentStatus !== r.newStatus ? ` [${r.currentStatus}→${r.newStatus}]` : '';
      console.log(`[${r.id}] ${r.name} | ${r.type} | ${r.newStatus}${changed} | ${r.url}`);
    });

    // 2. 안정적인 서버들 활성화
    // Sci-Hub.se, Sci-Hub.st, LibGen.lc, LibGen.rs, LibGen.fun, Library.lol 활성화
    const toActivate = [1, 2, 5, 6, 12, 13]; // id
    console.log('\n=== [2/4] 서버 활성화 ===');
    await pool.query(`UPDATE download_servers SET is_active = true WHERE id = ANY($1::int[])`, [toActivate]);
    console.log(`활성화 완료: IDs ${toActivate.join(', ')}`);

    // 3. 상태 업데이트 (is_active은 유지, status만 업데이트)
    console.log('\n=== [3/4] 상태 일괄 업데이트 ===');
    for (const r of results) {
      if (r.newStatus !== r.currentStatus) {
        const latency = r.newStatus === 'ONLINE' ? 500 : (r.newStatus === 'SLOW' ? 10000 : 5000);
        await pool.query(
          `UPDATE download_servers SET status = $1, avg_latency = $2, last_checked = NOW() WHERE id = $3`,
          [r.newStatus, latency, r.id]
        );
        console.log(`  Updated [${r.id}] ${r.name}: ${r.currentStatus} → ${r.newStatus}`);
      } else {
        console.log(`  No change [${r.id}] ${r.name}: ${r.currentStatus}`);
      }
    }

    // 4. 최종 상태 확인
    console.log('\n=== [4/4] 최종 서버 목록 ===');
    const finalServers = await pool.query('SELECT id, name, type, status, is_active, avg_latency FROM download_servers ORDER BY id');
    finalServers.rows.forEach(s => {
      const marker = s.is_active ? '✓' : '✗';
      console.log(`${marker} [${s.id}] ${s.name} | ${s.type} | ${s.status.padEnd(8)} | latency=${s.avg_latency}ms`);
    });

    await pool.end();
    console.log('\n✅ 완료');
  } catch(e) {
    console.error('Error:', e.message);
    await pool.end();
    process.exit(1);
  }
})();
