require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000
});

(async () => {
  try {
    // Check users table columns
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
    console.log('=== users table columns ===');
    cols.rows.forEach(r => console.log(r.column_name, r.data_type));

    // Check users data
    const users = await pool.query("SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 20");
    console.log('\n=== recent users ===');
    users.rows.forEach(u => console.log(u.id, u.email.substring(0, 30), u.created_at));
    console.log('total users:', users.rows.length);

    await pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    await pool.end();
  }
})();