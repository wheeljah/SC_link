require('dotenv').config({ path: __dirname + '/.env' });
const { Client } = require('pg');

async function resetPassword() {
  const bcrypt = require('bcryptjs');
  const axios = require('axios');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  try {
    // Update testuser password
    const hash = bcrypt.hashSync('test1234', 10);
    await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hash, 'testuser@example.com']);
    console.log('Password updated for testuser@example.com');

    // Login
    const loginRes = await axios.post('http://localhost:4000/api/v1/auth/login', {
      email: 'testuser@example.com',
      password: 'test1234'
    }, { timeout: 10000 });

    const token = loginRes.data.token;
    console.log('Token:', token ? token.substring(0, 20) + '...' : 'NO TOKEN');
    if (!token) { console.log(JSON.stringify(loginRes.data)); return; }

    // Download test
    console.log('\n--- Download test: 10.1038/s41576-019-0205-4 ---');
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
            if (event === 'progress') {
              console.log(`[progress] ${p.step} - ${p.message} (${p.progress}%)`);
            }
            if (event === 'complete') {
              completed = p;
              console.log(`[complete] ✅ ${p.filePath} (${(p.fileSize/1024/1024).toFixed(1)} MB)`);
            }
            if (event === 'error') {
              console.log(`[error] ❌ ${p.message}`);
            }
          } catch (e) {}
        }
      }
    });

    dlRes.data.on('end', () => {
      if (completed) console.log('\n✅ SUCCESS - PDF downloaded!');
      else console.log('\n⚠️ No complete event received');
    });
    dlRes.data.on('error', e => console.log('Stream error:', e.message));

  } catch (e) {
    console.error('Error:', e.message);
    if (e.response) console.log('HTTP:', e.response.status, JSON.stringify(e.response.data));
  } finally {
    await client.end();
  }
}

resetPassword();
