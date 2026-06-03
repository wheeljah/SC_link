const axios = require('axios');
const cheerio = require('cheerio');

async function analyzeSciHubRun() {
  const doi = '10.1007/s13668-023-00492-x';
  const url = 'https://sci-hub.run';
  const doiUrl = url + '/' + doi;
  
  console.log('=== sci-hub.run Deep Analysis ===\n');
  
  // 1. Main page analysis
  const mainRes = await axios.get(url, { 
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' }
  });
  const $main = cheerio.load(mainRes.data);
  console.log('Main page:');
  console.log('  Length:', mainRes.data.length);
  console.log('  Title:', $main('title').text().trim());
  
  // Check for JS frameworks
  const scripts = $main('script[src]').map((i, el) => $main(el).attr('src')).get();
  const inlineScripts = $main('script:not([src])').map((i, el) => $main(el).text().substring(0, 200)).get();
  console.log('  External scripts:', scripts);
  console.log('  Inline scripts count:', inlineScripts.length);
  if (inlineScripts.length) console.log('  First inline script:', inlineScripts[0].substring(0, 200));
  
  // Check meta tags
  const metas = $main('meta').map((i, el) => `${$main(el).attr('name') || $main(el).attr('property')}: ${$main(el).attr('content')}`).get().filter(Boolean);
  console.log('  Meta tags:', metas.slice(0, 5));
  
  // 2. DOI page deep analysis
  console.log('\n\nDOI page analysis:');
  const doiRes = await axios.get(doiUrl, { 
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' }
  });
  const $ = cheerio.load(doiRes.data);
  console.log('  Length:', doiRes.data.length);
  console.log('  Title:', $('title').text().trim());
  
  // Check if it's an SPA (React/Vue/etc)
  const hasReact = doiRes.data.includes('react') || doiRes.data.includes('_react') || doiRes.data.includes('/static/js/');
  const hasVue = doiRes.data.includes('vue') || doiRes.data.includes('__vue');
  const hasAngular = doiRes.data.includes('ng-app') || doiRes.data.includes('ng-version');
  const hasSvelte = doiRes.data.includes('svelte');
  console.log('  React:', hasReact ? 'YES' : 'no');
  console.log('  Vue:', hasVue ? 'YES' : 'no');
  console.log('  Angular:', hasAngular ? 'YES' : 'no');
  console.log('  Svelte:', hasSvelte ? 'YES' : 'no');
  
  // JS frameworks used
  const jsFiles = $('script[src]').map((i, el) => $(el).attr('src')).get();
  console.log('  JS files:', jsFiles.slice(0, 10));
  
  // Check for data attributes or state
  const dataElements = $('[data-v-], [data-react], [data-svelte]').length;
  console.log('  Vue/Svelte/React data elements:', dataElements);
  
  // Check body content
  const bodyText = $('body').text().trim().substring(0, 500);
  console.log('  Body text:', bodyText.substring(0, 300));
  
  // Check for any links/buttons
  const links = $('a[href]').map((i, el) => ({ href: $(el).attr('href'), text: $(el).text().trim() })).get();
  const buttons = $('button').map((i, el) => $(el).text().trim()).get();
  console.log('  Links:', links.slice(0, 10));
  console.log('  Buttons:', buttons.slice(0, 5));
  
  // Check if it's a CDN-hosted SPA (backend API)
  // sci-hub.run might be a frontend that calls an API
  // Look for API URLs in the code
  const apiPatterns = doiRes.data.match(/https?:\/\/[a-z0-9.-]+\.(?:com|io|org|xyz|net)\/[a-zA-Z0-9/_-]+/gi) || [];
  const uniqueApis = [...new Set(apiPatterns)];
  console.log('  Possible API endpoints:', uniqueApis.slice(0, 5));
  
  // Check for fetch/axios patterns
  const fetchCalls = doiRes.data.match(/fetch\(['"`][^'"`]+['"`]/g) || [];
  const axiosCalls = doiRes.data.match(/axios\.[a-z]+\(['"`][^'"`]+['"`]/g) || [];
  console.log('  fetch() calls:', fetchCalls.slice(0, 3));
  console.log('  axios calls:', axiosCalls.slice(0, 3));
  
  // Check hidden inputs
  const hiddenInputs = $('input[type="hidden"]').map((i, el) => ({ name: $(el).attr('name'), value: $(el).attr('value') })).get();
  console.log('  Hidden inputs:', JSON.stringify(hiddenInputs));
  
  // Check if there's a specific Sci-Hub API endpoint
  // Sometimes these SPAs call a backend like /api/download or similar
  const apiEndpoints = doiRes.data.match(/['"(](\/(?:api|download|fetch|pdf|get)[\w/.-]+)['")]/gi) || [];
  console.log('  API endpoints in code:', apiEndpoints.slice(0, 5));
  
  // Try common API patterns
  console.log('\n  Testing common API patterns...');
  const testEndpoints = [
    '/api/pdf/' + doi,
    '/api/download/' + doi,
    '/pdf/' + doi,
    '/download/' + doi,
    '/fetch/' + doi,
    '/get/' + doi,
    '/paper/' + doi,
    '/api/paper/' + doi,
    '/api/v1/paper/' + doi,
  ];
  
  for (const ep of testEndpoints) {
    try {
      const r = await axios.head(url + ep, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`  GET ${ep}: ${r.status} CT=${r.headers['content-type']}`);
    } catch (e) {
      if (e.response) {
        console.log(`  HEAD ${ep}: ${e.response.status}`);
      }
    }
  }
  
  // Screenshot via Puppeteer to see what the page looks like
  console.log('\n  Taking screenshot...');
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process'],
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');
  
  try {
    await page.goto(doiUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 5000));
    
    const title = await page.title();
    console.log('  Browser title:', title);
    
    // Get network requests that might be PDF
    const pdfRequests = [];
    await page.on('request', req => {
      const u = req.url();
      if (u.includes('.pdf') || u.includes('pdf')) pdfRequests.push(u);
    });
    
    // Wait a bit more for any delayed requests
    await new Promise(r => setTimeout(r, 3000));
    
    // Check page content after JS execution
    const afterJsText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('  After JS text:', afterJsText.substring(0, 300));
    
    const pdfLinks = await page.$$eval('a[href]', els => els.filter(e => (e.href || '').includes('.pdf')).map(e => e.href));
    const iframes = await page.$$eval('iframe[src]', els => els.map(e => e.src));
    const embeds = await page.$$eval('embed[src]', els => els.map(e => e.src));
    
    console.log('  PDF links (after JS):', pdfLinks.slice(0, 5));
    console.log('  Iframes (after JS):', iframes.slice(0, 5));
    console.log('  Embeds (after JS):', embeds.slice(0, 5));
    
    await page.screenshot({ path: 'D:/SC_link/server/uploads/scishub_run_doi2.png', fullPage: false });
    console.log('  Screenshot: D:/SC_link/server/uploads/scishub_run_doi2.png');
    
    console.log('  PDF network requests:', pdfRequests);
    
  } catch (e) {
    console.log('  Puppeteer error:', e.message);
  }
  
  await browser.close();
}

analyzeSciHubRun().catch(e => console.error(e.message));
