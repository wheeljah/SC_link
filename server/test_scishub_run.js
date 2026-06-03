const axios = require('axios');

async function testSciHubRun() {
  const base = 'https://fast.wbleb.com';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://sci-hub.run',
    'Referer': 'https://sci-hub.run/',
    'Content-Type': 'application/json',
  };

  // Test 1: Can we actually download the PDF?
  console.log('=== Test 1: Download PDF ===');
  const pdfUrl = base + '/papers/f1/fa/kucsko2013.pdf';
  try {
    const res = await axios.get(pdfUrl, {
      timeout: 30000,
      headers: { ...headers, 'Accept': 'application/pdf' },
      responseType: 'stream',
    });
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Content-Length:', res.headers['content-length']);
    console.log('File accessible: YES ✅');
  } catch (e) {
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Content-Type:', e.response.headers['content-type']);
      console.log('Error:', e.response.data?.toString ? e.response.data.toString().substring(0, 200) : e.response.data);
    } else {
      console.log('Error:', e.message);
    }
  }

  // Test 2: DOI 2 on sci-hub.run API
  console.log('\n\n=== Test 2: DOI 2 on sci-hub.run API ===');
  const doi2 = '10.1007/s13668-023-00492-x';
  try {
    const res = await axios.get(base + '/api/v1/paper/' + encodeURIComponent(doi2), {
      timeout: 30000,
      headers,
    });
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Response:', JSON.stringify(e.response.data));
    } else {
      console.log('Error:', e.message);
    }
  }

  // Test 3: DOI 3 (Springer Metabolome)
  console.log('\n\n=== Test 3: Springer Metabolome ===');
  const doi3 = '10.1007/s11306-025-02345-w';
  try {
    const res = await axios.get(base + '/api/v1/paper/' + encodeURIComponent(doi3), {
      timeout: 30000,
      headers,
    });
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Response:', JSON.stringify(e.response.data));
    } else {
      console.log('Error:', e.message);
    }
  }

  // Test 4: DOI 4 (Nature AAV)
  console.log('\n\n=== Test 4: Nature AAV ===');
  const doi4 = '10.1038/s41576-019-0205-4';
  try {
    const res = await axios.get(base + '/api/v1/paper/' + encodeURIComponent(doi4), {
      timeout: 30000,
      headers,
    });
    console.log('Response:', JSON.stringify(res.data, null, 2));
  } catch (e) {
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Response:', JSON.stringify(e.response.data));
    } else {
      console.log('Error:', e.message);
    }
  }

  // Test 5: DOI 1 (from earlier sessions - the working one)
  console.log('\n\n=== Test 5: DOI 1 (previously working) ===');
  // We need to find a DOI that we know worked before
  const doi1 = '10.1038/nature12373'; // We know this one works
  try {
    const res = await axios.get(base + '/api/v1/paper/' + encodeURIComponent(doi1), {
      timeout: 30000,
      headers,
    });
    console.log('Response:', JSON.stringify(res.data, null, 2));
    // Try to download
    const pdfPath = res.data.url;
    console.log('\nTrying to download:', base + pdfPath);
    const r2 = await axios.head(base + pdfPath, { timeout: 15000 });
    console.log('PDF HEAD:', r2.status, r2.headers['content-type'], r2.headers['content-length']);
  } catch (e) {
    if (e.response) {
      console.log('Status:', e.response.status, JSON.stringify(e.response.data));
    } else {
      console.log('Error:', e.message);
    }
  }

  // Test 6: Multiple DOIs to understand coverage
  console.log('\n\n=== Test 6: Coverage test with various DOIs ===');
  const testDOIs = [
    '10.1038/nbt.3122', // Nature Biotech
    '10.1038/nmeth.4395', // Nature Methods
    '10.1016/j.cell.2020.03.045', // Cell
    '10.1126/science.aax2346', // Science
    '10.1016/j.immuni.2020.04.003', // Immunity
    '10.1073/pnas.1916627117', // PNAS
    '10.1101/2020.03.15.993551', // bioRxiv
  ];
  let success = 0, notFound = 0;
  for (const d of testDOIs) {
    try {
      const res = await axios.get(base + '/api/v1/paper/' + encodeURIComponent(d), {
        timeout: 15000,
        headers,
      });
      if (res.data.success) {
        console.log(`✅ ${d} → ${res.data.url} (cached=${res.data.cached})`);
        success++;
      } else {
        console.log(`❌ ${d} → ${res.data.message || res.data.detail || 'failed'}`);
        notFound++;
      }
    } catch (e) {
      if (e.response?.status === 404) {
        console.log(`❌ ${d} → not found`);
        notFound++;
      } else {
        console.log(`⚠️  ${d} → ${e.message.substring(0, 50)}`);
      }
    }
  }
  console.log(`\nCoverage: ${success} found, ${notFound} not found`);
}

testSciHubRun().catch(e => console.error(e.message));
