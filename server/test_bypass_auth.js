require('dotenv').config({ path: __dirname + '/.env' });
const { Client } = require('pg');
const axios = require('axios');
const jwt = require('jsonwebtoken');

async function test() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  try {
    // Check user
    const r = await pg.query("SELECT id, email, email_verified, password_hash FROM users WHERE email = 'wheeljah@gmail.com'");
    console.log('User:', JSON.stringify(r.rows[0], null, 2));

    if (!r.rows[0]) {
      console.log('User not found!');
      return;
    }

    const user = r.rows[0];
    console.log('User ID:', user.id);
    console.log('Email verified:', user.email_verified);

    // Create JWT manually
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    console.log('\nJWT created:', token.substring(0, 30) + '...');

    // Download test
    console.log('\n[2] Download: 10.1038/s41576-019-0205-4');
    
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
              console.log(`  [${p.progress}%] ${p.message}`);
            }
            if (event === 'complete') {
              completed = p;
              console.log(`\n✅ COMPLETE! ${p.filePath} (${(p.fileSize/1024/1024).toFixed(1)} MB)`);
            }
            if (event === 'error') {
              console.log(`\n❌ ERROR: ${p.message}`);
            }
          } catch (e) {}
        }
      }
    });

    dlRes.data.on('end', () => {
      if (completed) console.log('\n=== SUCCESS ===');
      else console.log('\n⚠️ No complete event');
    });
    dlRes.data.on('error', e => console.log('Stream error:', e.message));

  } catch (e) {
    console.error('Error:', e.message);
    if (e.response) console.log('HTTP:', e.response.status, JSON.stringify(e.response.data));
  } finally {
    await pg.end();
  }
}

test();
