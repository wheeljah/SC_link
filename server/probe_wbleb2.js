const axios = require('axios');

async function probeWbleb() {
  const base = 'https://fast.wbleb.com';
  const doi = '10.1007/s13668-023-00492-x';
  
  // Root endpoint
  console.log('=== Root ===');
  const r = await axios.get(base + '/', { 
    timeout: 10000, 
    headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://sci-hub.run/' } 
  });
  console.log(JSON.stringify(r.data, null, 2));
  
  // Try /docs or /openapi
  for (const ep of ['/docs', '/openapi', '/api', '/api/docs', '/redoc', '/health']) {
    try {
      const res = await axios.get(base + ep, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`\n${ep}:`, res.status, String(res.data).substring(0, 200));
    } catch (e) {
      if (e.response) console.log(`${ep}: ${e.response.status}`);
    }
  }
  
  // Try POST with different body formats
  console.log('\n\n=== POST API probes ===');
  const postTests = [
    [base + '/api/v1/paper', { doi }],
    [base + '/api/v1/paper', { identifier: doi }],
    [base + '/api/paper', { doi }],
    [base + '/api/v1/papers', { doi }],
    [base + '/api/papers', { doi }],
    [base + '/api/v1/search', { query: doi }],
    [base + '/api/search', { query: doi }],
    [base + '/api/v1/resolve', { doi }],
    [base + '/api/resolve', { doi }],
    [base + '/api/v1/fetch', { doi }],
    [base + '/api/fetch', { doi }],
    [base + '/api/v1/download', { doi }],
    [base + '/api/download', { doi }],
    [base + '/api/v1/file', { doi }],
    [base + '/api/file', { doi }],
    [base + '/api/v1/md5', { doi }],
    [base + '/api/md5', { doi }],
    [base + '/api/v1/info', { doi }],
    [base + '/api/info', { doi }],
    [base + '/api/v1/paper_info', { doi }],
    [base + '/api/paper_info', { doi }],
    [base + '/api/v1/paper_info', { identifier: doi }],
    [base + '/api/v1/paper_info', { request: doi }],
    [base + '/api/paper_info', { request: doi }],
    [base + '/api/v1/paperData', { doi }],
    [base + '/api/paperData', { doi }],
  ];
  
  for (const [url, body] of postTests) {
    try {
      const res = await axios.post(url, body, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://sci-hub.run/',
          'Content-Type': 'application/json',
          'Origin': 'https://sci-hub.run'
        }
      });
      const ct = res.headers['content-type'] || '';
      const isJson = ct.includes('json');
      const marker = isJson && res.status === 200 ? '✅' : res.status === 200 ? '⚠️' : '❌';
      console.log(`${marker} POST ${res.status} ${url} [${ct.substring(0, 30)}]`);
      if (isJson) console.log(`   Data:`, JSON.stringify(res.data).substring(0, 300));
    } catch (e) {
      if (e.response) {
        const ct = e.response.headers['content-type'] || '';
        const data = e.response.data;
        const isJson = ct.includes('json');
        const marker = e.response.status === 404 && isJson && data?.detail === 'Paper not found' ? '📄' : e.response.status === 404 ? '❌' : '⚠️';
        console.log(`${marker} POST ${e.response.status} ${url} → ${isJson ? JSON.stringify(data) : String(data).substring(0, 100)}`);
      } else {
        console.log(`ERR ${e.message.substring(0, 50)} ${url}`);
      }
    }
  }
  
  // Try with different content types
  console.log('\n\n=== Different Content-Type probes ===');
  const formUrlEncoded = new URLSearchParams({ doi }).toString();
  const formTests = [
    [base + '/api/v1/paper', formUrlEncoded, 'application/x-www-form-urlencoded'],
    [base + '/api/v1/paper', { doi: doi }, 'application/json'],
  ];
  
  for (const [url, data, ct] of formTests) {
    try {
      const res = await axios.post(url, data, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://sci-hub.run/',
          'Content-Type': ct,
          'Origin': 'https://sci-hub.run'
        }
      });
      console.log(`POST ${ct} ${res.status}:`, JSON.stringify(res.data).substring(0, 200));
    } catch (e) {
      if (e.response) {
        console.log(`POST ${ct} ${e.response.status}:`, JSON.stringify(e.response.data).substring(0, 200));
      } else {
        console.log(`ERR: ${e.message.substring(0, 50)}`);
      }
    }
  }
  
  // Check headers on successful-looking responses
  console.log('\n\n=== Check CORS/Auth headers ===');
  const r2 = await axios.options(base + '/api/v1/paper', {
    timeout: 5000,
    headers: {
      'Origin': 'https://sci-hub.run',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type'
    }
  }).catch(e => e.response);
  if (r2) {
    console.log('CORS headers:', JSON.stringify(r2.headers));
  }
}

probeWbleb().catch(e => console.error(e.message));
