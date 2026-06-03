const axios = require('axios');
const fs = require('fs');

// Download the JS chunk that handles DOI pages
async function analyzeJsChunks() {
  const doi = '10.1007/s13668-023-00492-x';
  const doiUrl = 'https://sci-hub.run/' + doi;
  
  console.log('=== Reverse Engineering sci-hub.run JS ===\n');
  
  // Get the DOI page to find the JS chunks
  const pageRes = await axios.get(doiUrl, {
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  
  // Extract JS file URLs
  const jsFiles = pageRes.data.match(/\/_next\/static\/chunks\/[^"]+\.js/g) || [];
  console.log('JS chunks found:', jsFiles.length);
  console.log('Chunks:', jsFiles);
  
  // Find the DOI-specific chunk
  const doiChunk = jsFiles.find(f => f.includes('[...doi]') || f.includes('%5B...doi%5D'));
  console.log('DOI chunk:', doiChunk);
  
  // Download and analyze the DOI chunk
  if (doiChunk) {
    const chunkUrl = 'https://sci-hub.run' + doiChunk;
    console.log('\nDownloading:', chunkUrl);
    const chunkRes = await axios.get(chunkUrl, { timeout: 20000 });
    const chunkContent = chunkRes.data;
    console.log('Chunk size:', chunkContent.length);
    
    // Save it
    fs.writeFileSync('D:/SC_link/server/uploads/scishub_run_chunk.js', chunkContent);
    console.log('Saved to uploads/scishub_run_chunk.js');
    
    // Search for API patterns
    const patterns = [
      /['"](https?:\/\/[^'"]*(?:api|pdf|download)[^'"]*)['"]/gi,
      /fetch\s*\(\s*['"]([^'"]+)['"]/gi,
      /axios\.[a-z]+\(\s*['"]([^'"]+)['"]/gi,
      /(?:api|download|pdf|fetch|get)\s*:\s*['"]([^'"]+)['"]/gi,
      /window\.__\w+\s*=\s*['"]([^'"]+)['"]/gi,
    ];
    
    patterns.forEach((p, idx) => {
      const matches = chunkContent.match(p) || [];
      console.log(`\nPattern ${idx + 1}:`, matches.slice(0, 10));
    });
    
    // Search for backend hostname patterns
    const hostPatterns = [
      /https?:\/\/[a-z0-9.-]+\.(?:com|io|xyz|org|net|cc|top|site|app|live|online|fun|club|pro)/gi,
      /https?:\/\/[a-z0-9.-]+\/[^'"`\s]+(?:pdf|api|download)/gi,
      /api[Uu]rl\s*[=:]\s*['"]([^'"]+)['"]/gi,
      /base[Uu]rl\s*[=:]\s*['"]([^'"]+)['"]/gi,
      /endpoint\s*[=:]\s*['"]([^'"]+)['"]/gi,
    ];
    
    hostPatterns.forEach((p, idx) => {
      const matches = [...new Set(chunkContent.match(p) || [])];
      console.log(`\nHost/API pattern ${idx + 1}:`, matches.slice(0, 5));
    });
    
    // Look for backend domain (often hardcoded)
    const backendDomains = chunkContent.match(/['"]https?:\/\/[a-z0-9.-]+['"]/g) || [];
    const unique = [...new Set(backendDomains)];
    console.log('\nAll domains referenced:', unique);
    
    // Check for __NEXT_DATA__ which might contain config
    const nextData = pageRes.data.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
    if (nextData) {
      console.log('\n__NEXT_DATA__ found!');
      try {
        const parsed = JSON.parse(nextData[1]);
        console.log(JSON.stringify(parsed, null, 2).substring(0, 1000));
      } catch (e) {
        console.log('Failed to parse:', nextData[1].substring(0, 500));
      }
    }
    
    // Look for the backend in the chunk - it might be using a different domain for API
    // Common patterns in Next.js apps
    const configPatterns = [
      /process\.env\.([A-Z_]+)/g,
      /NEXT_PUBLIC_([A-Z_]+)/g,
    ];
    
    configPatterns.forEach(p => {
      const envVars = chunkContent.match(p) || [];
      console.log(`\nEnv vars (${p}):`, [...new Set(envVars)]);
    });
    
    // Search for the actual PDF fetching code
    // It likely uses something like: /api/proxy?url=... or /api/pdf?doi=...
    const pdfPatterns = [
      /['"]\/[^'"\s]*pdf[^'"\s]*['"]/gi,
      /['"][^'"]*download[^'"]*['"]/gi,
      /(?:proxy|file|document|source)[^)]*\(['"][^'"]+['"]/gi,
    ];
    
    pdfPatterns.forEach((p, idx) => {
      const matches = [...new Set(chunkContent.match(p) || [])];
      console.log(`\nPDF pattern ${idx + 1}:`, matches.slice(0, 10));
    });
    
  } else {
    console.log('No DOI chunk found, searching all chunks...');
    for (const jsFile of jsFiles.slice(0, 5)) {
      try {
        const res = await axios.get('https://sci-hub.run' + jsFile, { timeout: 10000 });
        const content = res.data;
        const apiPatterns = content.match(/https?:\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s'"`;)]*/gi) || [];
        if (apiPatterns.length > 0) {
          console.log(`\n${jsFile}:`, [...new Set(apiPatterns)]);
        }
      } catch (e) {}
    }
  }
  
  // Also check if there's a network intercept that reveals the API
  // Let's use puppeteer with network monitoring
  console.log('\n\n=== Puppeteer Network Interception ===');
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process'],
  });
  const page = await browser.newPage();
  
  const allRequests = [];
  const pdfRequests = [];
  
  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    allRequests.push({ url: url.substring(0, 200), type: req.resourceType() });
    if (url.includes('.pdf') || url.includes('pdf') || url.includes('download') || url.includes('api')) {
      pdfRequests.push(url);
    }
    req.continue();
  });
  
  try {
    await page.goto(doiUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 8000));
    
    const title = await page.title();
    console.log('Page title:', title);
    
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
    console.log('Body text:', bodyText);
    
    // Check what the page actually rendered
    const pdfElements = await page.$$eval('*', () => {
      const results = [];
      document.querySelectorAll('[href*="pdf"], [src*="pdf"], [data-*]').forEach(el => {
        const attrs = {};
        for (const attr of el.attributes) {
          if (attr.value && (attr.value.includes('pdf') || attr.value.includes('download'))) {
            attrs[attr.name] = attr.value;
          }
        }
        if (Object.keys(attrs).length > 0) results.push({ tag: el.tagName, ...attrs });
      });
      return results;
    });
    
    console.log('Elements with PDF attrs:', JSON.stringify(pdfElements, null, 2));
    
    console.log('\nAll requests:', allRequests.slice(0, 30));
    console.log('\nPDF/API requests:', pdfRequests);
    
    await page.screenshot({ path: 'D:/SC_link/server/uploads/scishub_run_doi2_v2.png', fullPage: false });
    console.log('\nScreenshot: D:/SC_link/server/uploads/scishub_run_doi2_v2.png');
    
  } catch (e) {
    console.log('Puppeteer error:', e.message);
  }
  
  await browser.close();
}

analyzeJsChunks().catch(e => console.error(e.message));
