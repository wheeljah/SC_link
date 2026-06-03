const axios = require('axios');

async function testAPI() {
  const base = 'https://fast.wbleb.com';
  const doi = '10.1007/s13668-023-00492-x';
  
  console.log('=== Testing FastAPI with proper CORS headers ===\n');
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://sci-hub.run',
    'Referer': 'https://sci-hub.run/',
    'Content-Type': 'application/json',
  };
  
  // Test DOI search API
  const endpoints = [
    '/api/v1/paper/' + encodeURIComponent(doi),
    '/api/v1/paper/' + doi,
    '/api/v1/paper/' + encodeURIComponent('10.1007/' + doi.split('/')[1]),
    '/api/v1/paper/' + encodeURIComponent(doi.split('/')[1]),
  ];
  
  for (const ep of endpoints) {
    try {
      const res = await axios.get(base + ep, { timeout: 30000, headers });
      console.log(`✅ GET ${ep}`);
      console.log('   Data:', JSON.stringify(res.data, null, 2).substring(0, 500));
    } catch (e) {
      if (e.response) {
        console.log(`❌ GET ${ep}: ${e.response.status}`);
        console.log('   Response:', JSON.stringify(e.response.data));
      } else {
        console.log(`ERR ${ep}: ${e.message.substring(0, 100)}`);
      }
    }
  }
  
  // Try with different header combos
  console.log('\n\n=== Testing with additional headers ===');
  const extraHeaders = {
    ...headers,
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'sec-fetch-site': 'cross-site',
    'sec-fetch-mode': 'cors',
  };
  
  try {
    const res = await axios.get(base + '/api/v1/paper/' + encodeURIComponent(doi), { 
      timeout: 30000, 
      headers: extraHeaders 
    });
    console.log('✅ With extra headers:', JSON.stringify(res.data).substring(0, 300));
  } catch (e) {
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Response headers:', JSON.stringify(e.response.headers, null, 2));
      console.log('Response:', JSON.stringify(e.response.data).substring(0, 300));
    } else if (e.request) {
      console.log('No response received');
      console.log('Error code:', e.code);
      if (e.code === 'ECONNREFUSED') {
        console.log('Connection refused - blocked by Cloudflare CORS');
      }
    } else {
      console.log('Error:', e.message.substring(0, 200));
    }
  }
  
  // Try with a cookie from the main domain
  // First, get the main page to see if it sets any cookies
  console.log('\n\n=== Check if cookies help ===');
  try {
    const jar = require('axios').CookieJar ? new (require('axios').CookieJar)() : null;
    const mainRes = await axios.get('https://sci-hub.run/', { timeout: 10000, headers: { 'User-Agent': headers['User-Agent'] } });
    const cookies = mainRes.headers['set-cookie'] || [];
    console.log('Cookies from sci-hub.run:', cookies);
    
    if (cookies.length > 0) {
      const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
      const res2 = await axios.get(base + '/api/v1/paper/' + encodeURIComponent(doi), {
        timeout: 30000,
        headers: { ...headers, 'Cookie': cookieStr }
      });
      console.log('With cookies:', JSON.stringify(res2.data).substring(0, 300));
    }
  } catch (e) {
    if (e.response) console.log(e.response.status, JSON.stringify(e.response.data).substring(0, 200));
    else console.log('Error:', e.message.substring(0, 200));
  }
}

testAPI().catch(e => console.error(e.message));
