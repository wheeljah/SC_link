require('dotenv').config();
const { Pool } = require('pg');
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scholarlink';
const pool = new Pool({
  connectionString: dbUrl,
  connectionTimeoutMillis: 10000
});

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('DB connected OK');

    const servers = await pool.query('SELECT id, name, url, type, status, avg_latency, is_active, success_rate FROM download_servers ORDER BY id');
    console.log('\n=== Servers ===');
    servers.rows.forEach(s => {
      const marker = s.is_active ? '✓ ACTIVE' : '✗ inactive';
      console.log(`[${s.id}] ${s.name} | ${s.type} | ${s.status} | ${marker} | latency=${s.avg_latency}ms`);
    });

    // Check columns
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'paper_requests'");
    console.log('\n=== paper_requests columns ===');
    cols.rows.forEach(c => console.log(c.column_name));

    const r1 = await pool.query("SELECT id, input_value, normalized_doi, status, created_at FROM paper_requests WHERE normalized_doi = '10.1016/j.cellimm.2004.06.005' ORDER BY created_at DESC LIMIT 10");
    console.log('\n=== Requests for 10.1016/j.cellimm.2004.06.005 ===');
    if (r1.rows.length === 0) {
      console.log('No requests found');
    } else {
      r1.rows.forEach(r => console.log(`${r.created_at} | status=${r.status} | input=${r.input_value}`));
    }

    const r2 = await pool.query("SELECT id, input_value, normalized_doi, status, created_at FROM paper_requests WHERE normalized_doi = '10.1007/s13668-023-00492-x' ORDER BY created_at DESC LIMIT 10");
    console.log('\n=== Requests for 10.1007/s13668-023-00492-x ===');
    if (r2.rows.length === 0) {
      console.log('No requests found');
    } else {
      r2.rows.forEach(r => console.log(`${r.created_at} | status=${r.status} | input=${r.input_value}`));
    }

    const r3 = await pool.query("SELECT id, input_value, normalized_doi, status, created_at FROM paper_requests ORDER BY created_at DESC LIMIT 20");
    console.log('\n=== Recent 20 Requests ===');
    if (r3.rows.length === 0) {
      console.log('No requests');
    } else {
      r3.rows.forEach(r => console.log(`${r.created_at} | ${r.normalized_doi} | status=${r.status}`));
    }

    await pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    await pool.end();
    process.exit(1);
  }
})();
