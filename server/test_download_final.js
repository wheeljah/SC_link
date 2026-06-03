require('dotenv').config({ path: __dirname + '/.env' });
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const axios = require('axios');

async function test() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const email = 'biuser_' + Date.now() + '@test.com';
    const hash = bcrypt.hashSync('TestPass1', 10);

    // Create verified user directly
    await client.query(`
      INSERT INTO users (email, password_hash, nickname, email_verified)
      VALUES ($1, $2, 'BITest', true)
    `, [email, hash]);
    console.log('Created:', email);

    // Get user ID
    const userRow = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    const userId = userRow.rows[0].id;
    console.log('User ID:', userId);

    // Get JWT secret and create token manually
    const jwtSecret = process.env.JWT_SECRET;
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId, email }, jwtSecret, { expiresIn: '1h' });
    console.log('Token generated:', token.substring(0, 20) + '...');

    // Test download with SSE
    console.log('\n--- Testing download: 10.1038/s41576-019-0205-4 ---');
    
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

    console.log('Response status:', dlRes.status);
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
              console.log(`  [${p.progress}%] ${p.message}`);
            }
            if (event === 'complete') {
              completed = p;
              console.log(`\n✅ DONE! File: ${p.filePath} (${(p.fileSize/1024/1024).toFixed(1)} MB)`);
            }
            if (event === 'error') {
              console.log(`\n❌ ERROR: ${p.message}`);
            }
          } catch (e) {}
        }
      }
    });

    dlRes.data.on('end', () => {
      if (completed) {
        console.log('\n=== FULL SUCCESS ===');
      } else {
        console.log('\n⚠️ Stream ended without complete event');
      }
    });
    dlRes.data.on('error', e => console.log('Stream error:', e.message));

  } catch (e) {
    console.error('Fatal:', e.message);
    if (e.response) console.log('HTTP:', e.response.status, JSON.stringify(e.response.data));
  } finally {
    await client.end();
  }
}

test();
