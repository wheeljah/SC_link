// Test the new sci-hub.run provider
const axios = require('axios');

const API_BASE = 'https://fast.wbleb.com';
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Origin': 'https://sci-hub.run',
  'Referer': 'https://sci-hub.run/',
  'Content-Type': 'application/json',
  'sec-fetch-site': 'cross-site',
  'sec-fetch-mode': 'cors',
};

async function testProvider() {
  const testDOIs = [
    '10.1038/s41576-019-0205-4', // Nature AAV - known to work
    '10.1038/nature12373',       // Nature - known to work
    '10.1007/s13668-023-00492-x', // DOI 2 - expected NOT found
    '10.1038/nbt.3122',           // Nature Biotech
  ];

  let successCount = 0;

  for (const doi of testDOIs) {
    console.log(`\n--- Testing: ${doi} ---`);
    try {
      // Step 1: API call
      const apiRes = await axios.get(`${API_BASE}/api/v1/paper/${encodeURIComponent(doi)}`, {
        timeout: 60000,
        headers,
      });

      const data = apiRes.data;
      console.log(`API response:`, JSON.stringify(data));

      if (!data.success) {
        console.log(`❌ Not in database`);
        continue;
      }

      // Step 2: Construct PDF URL
      const pdfPath = data.url;
      const pdfUrl = pdfPath.startsWith('http')
        ? pdfPath
        : `${API_BASE}${pdfPath}`;

      console.log(`PDF URL: ${pdfUrl}`);

      // Step 3: Verify PDF is accessible
      const head = await axios.head(pdfUrl, { timeout: 15000, headers: { 'User-Agent': headers['User-Agent'] } });
      const ct = head.headers['content-type'];
      const cl = head.headers['content-length'];

      if (ct && ct.includes('pdf') && head.status === 200) {
        console.log(`✅ PDF accessible: ${head.status} | ${ct} | ${cl} bytes | cached=${data.cached}`);
        successCount++;
      } else {
        console.log(`⚠️ PDF check: ${head.status} | ${ct}`);
      }
    } catch (e) {
      if (axios.isAxiosError(e)) {
        if (e.response?.status === 404) {
          console.log(`❌ Not found (404)`);
        } else {
          console.log(`❌ API error: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
        }
      } else {
        console.log(`❌ Error: ${e.message}`);
      }
    }
  }

  console.log(`\n\n=== Summary ===`);
  console.log(`Tested: ${testDOIs.length} DOIs`);
  console.log(`Found: ${successCount} PDFs`);
  console.log(`Provider status: ${successCount > 0 ? 'WORKING ✅' : 'NOT WORKING ❌'}`);
}

testProvider().catch(e => console.error(e.message));
