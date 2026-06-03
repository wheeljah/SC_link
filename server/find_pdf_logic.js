const axios = require('axios');
const fs = require('fs');

// The biggest chunk should have the PDF download logic
async function findPdfDownloadLogic() {
  console.log('=== Finding PDF download logic in all chunks ===\n');
  
  const doi = '10.1007/s13668-023-00492-x';
  const doiUrl = 'https://sci-hub.run/' + doi;
  
  // Get page to find all chunk URLs
  const pageRes = await axios.get(doiUrl, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });
  const allChunks = pageRes.data.match(/\/_next\/static\/chunks\/[^"'\s)]+\.js/g) || [];
  const uniqueChunks = [...new Set(allChunks)];
  
  console.log('Chunks:', uniqueChunks);
  
  // Download and search each chunk for PDF download logic
  for (const chunk of uniqueChunks) {
    try {
      const res = await axios.get('https://sci-hub.run' + chunk, { timeout: 15000 });
      const content = res.data;
      
      // Look for PDF download-related patterns
      const hasPdfLogic = 
        content.includes('pdf') || 
        content.includes('download') || 
        content.includes('file') ||
        content.includes('proxy') ||
        content.includes('iframe') ||
        content.includes('/papers/') ||
        content.includes('wbleb.com');
      
      if (!hasPdfLogic) continue;
      
      // Extract all readable strings
      const strings = content.match(/['"`][^'"`]{3,200}['"`]/g) || [];
      const interesting = strings.filter(s => {
        const str = s.slice(1, -1);
        return str.includes('pdf') || str.includes('download') || str.includes('file') || 
               str.includes('proxy') || str.includes('wbleb') || str.includes('/papers') ||
               str.includes('cached') || str.includes('file_size');
      });
      
      if (interesting.length > 0) {
        console.log(`\n[${chunk}] (${content.length}b)`);
        interesting.forEach(s => console.log('  ', s));
      }
      
    } catch (e) {}
  }
  
  // Try to find what the paper response looks like
  // By checking what URL the page uses for the iframe
  console.log('\n\n=== Checking API response for a known paper ===');
  
  // Try a well-known paper that should be in Sci-Hub
  const testDoi = '10.1038/nature12373'; // Nature paper - very famous
  console.log('Testing:', testDoi);
  
  try {
    const res = await axios.get(`https://fast.wbleb.com/api/v1/paper/${encodeURIComponent(testDoi)}`, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://sci-hub.run',
        'Referer': 'https://sci-hub.run/',
        'Content-Type': 'application/json',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-mode': 'cors',
      }
    });
    console.log('Response:', JSON.stringify(res.data, null, 2).substring(0, 1000));
  } catch (e) {
    if (e.response) {
      console.log(`${testDoi}: ${e.response.status} - ${JSON.stringify(e.response.data)}`);
    } else {
      console.log(`${testDoi}: ${e.message}`);
    }
  }
  
  // Another well-known DOI
  const testDoi2 = '10.1126/science.1259859'; // Science paper
  console.log('\nTesting:', testDoi2);
  try {
    const res = await axios.get(`https://fast.wbleb.com/api/v1/paper/${encodeURIComponent(testDoi2)}`, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Origin': 'https://sci-hub.run',
        'Referer': 'https://sci-hub.run/',
        'Content-Type': 'application/json',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-mode': 'cors',
      }
    });
    console.log('Response:', JSON.stringify(res.data, null, 2).substring(0, 1000));
  } catch (e) {
    if (e.response) {
      console.log(`${testDoi2}: ${e.response.status} - ${JSON.stringify(e.response.data)}`);
    } else {
      console.log(`${testDoi2}: ${e.message}`);
    }
  }
  
  // Check the biggest chunk for the full page rendering logic
  // The page chunk (which renders the paper view) should show how the iframe URL is constructed
  console.log('\n\n=== Analyzing page component ===');
  // From the code analysis, the key is: u.url starts with "/papers/" -> iframe src = "https://fast.wbleb.com" + url
  // Otherwise iframe src = u.url directly
  // This means the backend either returns a relative path like /papers/xxx.pdf or an absolute URL
  
  // Let's also check if there's a way to get the PDF URL directly
  // The page does: fetch(t, {method:"HEAD"}) to get content-length
  // where t = u.url or "https://fast.wbleb.com" + u.url
  
  // So the PDF URL IS in u.url. Let's find the API response structure.
  // We need to find a DOI that IS in the database.
  
  // Try the DOI that worked in the debug: let's search for a common one
  const commonDOIs = [
    '10.1038/nature12373',     // Nature
    '10.1126/science.1259859', // Science
    '10.1038/s41586-020-2649-x', // Nature 2020
    '10.1016/j.cell.2020.03.045', // Cell
    '10.1073/pnas.1916627117', // PNAS
  ];
  
  for (const testD of commonDOIs) {
    try {
      const res = await axios.get(`https://fast.wbleb.com/api/v1/paper/${encodeURIComponent(testD)}`, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Origin': 'https://sci-hub.run',
          'Referer': 'https://sci-hub.run/',
          'Content-Type': 'application/json',
          'sec-fetch-site': 'cross-site',
          'sec-fetch-mode': 'cors',
        }
      });
      console.log(`✅ ${testD}:`, JSON.stringify(res.data).substring(0, 300));
      break;
    } catch (e) {
      if (e.response) {
        console.log(`${testD}: ${e.response.status} - ${JSON.stringify(e.response.data)}`);
      }
    }
  }
}

findPdfDownloadLogic().catch(e => console.error(e.message));
