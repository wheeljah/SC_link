require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000
});

(async () => {
  try {
    // Add region columns
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS region VARCHAR(20)`);
    console.log('OK: region column added or already exists');

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS region_ip VARCHAR(20)`);
    console.log('OK: region_ip column added or already exists');

    // Verify
    const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    console.log('\n=== current users columns ===');
    cols.rows.forEach(r => console.log(r.column_name));

    // Check current state
    const users = await pool.query("SELECT id, email, region, region_ip FROM users ORDER BY id");
    console.log('\n=== users with region data ===');
    users.rows.forEach(u => console.log(u.id, u.email.substring(0, 25), '| region:', u.region || '-', '| region_ip:', u.region_ip || '-'));

    const cnt = await pool.query("SELECT COUNT(*) as total, COUNT(region) as with_region, COUNT(region_ip) as with_region_ip FROM users");
    console.log('\nstats:', JSON.stringify(cnt.rows[0]));

    await pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    await pool.end();
  }
})();