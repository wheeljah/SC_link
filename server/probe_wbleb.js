const axios = require('axios');

async function probeWblebAPI() {
  console.log('=== Probing fast.wbleb.com API ===\n');
  
  const doi = '10.1007/s13668-023-00492-x';
  const base = 'https://fast.wbleb.com';
  
  // Try common API patterns based on the strings we found
  const testEndpoints = [
    // Paper info endpoints
    [base + '/paper/' + doi, 'GET'],
    [base + '/api/paper/' + doi, 'GET'],
    [base + '/api/v1/paper/' + doi, 'GET'],
    [base + '/paper/info/' + doi, 'GET'],
    [base + '/api/info/' + doi, 'GET'],
    [base + '/paperData/' + doi, 'GET'],
    [base + '/api/paperData/' + doi, 'GET'],
    [base + '/info/' + doi, 'GET'],
    
    // DOI-based search
    [base + '/doi/' + doi, 'GET'],
    [base + '/api/doi/' + doi, 'GET'],
    [base + '/search/' + doi, 'GET'],
    [base + '/api/search?doi=' + doi, 'GET'],
    
    // Download
    [base + '/download/' + doi, 'GET'],
    [base + '/pdf/' + doi, 'GET'],
    [base + '/file/' + doi, 'GET'],
    [base + '/api/download/' + doi, 'GET'],
    [base + '/api/pdf/' + doi, 'GET'],
    
    // From page chunk strings
    [base + '/api/paper_info', 'POST'],
    [base + '/api/paper_data', 'POST'],
    [base + '/api/paper', 'POST'],
    [base + '/api/file', 'POST'],
    [base + '/api/size', 'POST'],
    [base + '/api/md5', 'POST'],
    [base + '/api/checksum', 'POST'],
    [base + '/paper/login', 'POST'],
  ];
  
  const results = [];
  
  for (const [url, method] of testEndpoints) {
    try {
      const opts = { 
        timeout: 10000, 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://sci-hub.run/'
        },
        validateStatus: s => s < 500
      };
      
      let res;
      if (method === 'POST') {
        res = await axios.post(url, { doi }, opts);
      } else {
        res = await axios.get(url, opts);
      }
      
      const ct = res.headers['content-type'] || '';
      const cl = res.headers['content-length'] || '?';
      const isJson = ct.includes('json');
      
      results.push({
        url, method, status: res.status,
        ct: ct.substring(0, 50),
        cl,
        isJson,
        preview: isJson ? JSON.stringify(res.data).substring(0, 200) : String(res.data).substring(0, 100)
      });
    } catch (e) {
      if (e.response) {
        results.push({ url, method, status: e.response.status, error: e.response.statusText });
      } else {
        results.push({ url, method, status: 0, error: e.code || e.message.substring(0, 50) });
      }
    }
  }
  
  // Show results sorted by status
  results.sort((a, b) => {
    if (a.status === 0 && b.status === 0) return 0;
    if (a.status === 0) return 1;
    if (b.status === 0) return -1;
    return a.status - b.status;
  });
  
  results.forEach(r => {
    if (r.error) {
      console.log(`${r.method} ${r.status === 0 ? 'ERR' : r.status} ${r.url.substring(0, 80)} → ${r.error}`);
    } else {
      const marker = (r.status >= 200 && r.status < 300 && r.isJson) ? '✅' : r.status === 200 ? '⚠️' : '❌';
      console.log(`${marker} ${r.method} ${r.status} ${r.url.substring(0, 80)} [${r.ct}]`);
      if (r.isJson && r.preview) console.log(`   Data: ${r.preview}`);
    }
  });
  
  // Try the root domain to see what it is
  console.log('\n\n=== fast.wbleb.com root ===');
  try {
    const r = await axios.get('https://fast.wbleb.com/', { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log('Status:', r.status);
    console.log('Content-Type:', r.headers['content-type']);
    console.log('Content:', String(r.data).substring(0, 300));
  } catch (e) {
    console.log('Error:', e.message);
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Headers:', JSON.stringify(e.response.headers));
    }
  }
}

probeWblebAPI().catch(e => console.error(e.message));
