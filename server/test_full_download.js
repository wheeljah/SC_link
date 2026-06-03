require('dotenv').config({ path: '.env' });
const { pool } = require('./src/db/pool');
const bcrypt = require('bcryptjs');
const axios = require('axios');

async function test() {
  const client = await pool.connect();
  try {
    const hash = bcrypt.hashSync('test1234', 10);
    const email = 'mavistest@mavis.com';

    await client.query(`
      INSERT INTO users (email, password_hash, nickname, email_verified)
      VALUES ($1, $2, 'MavisTest', true)
      ON CONFLICT (email) DO UPDATE SET email_verified = true, password_hash = EXCLUDED.password_hash
    `, [email, hash]);

    console.log('User ready:', email);

    const loginRes = await axios.post('http://localhost:4000/api/v1/auth/login', {
      email: email,
      password: 'test1234'
    });

    const token = loginRes.data.token;
    console.log('Token:', token ? 'OK' : 'NO TOKEN');
    if (!token) { console.log(JSON.stringify(loginRes.data)); return; }

    console.log('\nDownload test: 10.1038/s41576-019-0205-4');
    const dlRes = await axios.post(
      'http://localhost:4000/api/v1/papers/download',
      { input: '10.1038/s41576-019-0205-4' },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        responseType: 'stream',
        timeout: 180000
      }
    );

    console.log('Status:', dlRes.status);
    let buf = '';
    let completed = null;

    dlRes.data.on('data', chunk => {
      buf += chunk.toString();
      const parts = buf.split('\n\n');
      buf = parts.pop() || '';
      for (const part of parts) {
        const lines = part.split('\n');
        let event = 'message', data = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7);
          if (line.startsWith('data: ')) data = line.slice(6);
        }
        if (data) {
          try {
            const p = JSON.parse(data);
            if (event === 'progress') console.log('[progress]', p.step, p.message, p.progress + '%');
            if (event === 'complete') { completed = p; console.log('[complete] ✅', p.filePath, (p.fileSize/1024/1024).toFixed(1) + 'MB'); }
            if (event === 'error') console.log('[error] ❌', p.message);
          } catch (e) { console.log('Parse error:', e.message); }
        }
      }
    });

    dlRes.data.on('end', () => {
      if (completed) console.log('\n✅ SUCCESS!');
      else console.log('\n❌ Failed - no complete event');
    });
    dlRes.data.on('error', e => console.log('Stream error:', e.message));

  } catch (e) {
    console.error('Error:', e.message);
    if (e.response) console.log('HTTP:', e.response.status, JSON.stringify(e.response.data));
  } finally {
    client.release();
    await pool.end();
  }
}
test();
