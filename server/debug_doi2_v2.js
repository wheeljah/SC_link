// DOI 2攻坚: Network interception + 동적 요소 분석
const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');

const doi = '10.1007/s13668-023-00492-x';

async function analyzeSciHubShNetwork() {
  console.log(`🔍 Network interception analysis for Sci-Hub.sh\n`);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const pdfRequests = [];
  const allRequests = [];

  // Capture all network requests
  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    const type = req.resourceType();
    allRequests.push({ type, url: url.substring(0, 150) });
    if (url.includes('.pdf') || url.includes('/pdf') || url.includes('pdf?')) {
      pdfRequests.push({ type, url });
    }
    req.continue();
  });

  try {
    const pageUrl = `https://sci-hub.sh/${doi}`;
    console.log(`→ Navigating to ${pageUrl}`);
    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for any PDF-related content
    await new Promise(resolve => setTimeout(resolve, 8000));

    const title = await page.title();
    console.log(`\n📄 Title: "${title}"`);

    // Collect frames snapshot immediately
    const framesSnapshot = await page.frames().map(f => {
      try {
        return { url: f.url().substring(0, 150), name: f.name() };
      } catch {
        return null;
      }
    }).filter(Boolean);
    console.log(`\n📺 Frames (snapshot): ${framesSnapshot.length}`);
    framesSnapshot.forEach(f => console.log(`  - "${f.url}" (name="${f.name}")`));

    // DOM analysis
    const domAnalysis = await page.evaluate(() => {
      const results = {
        iframes: [], embeds: [], pdfLinks: [], buttons: [], dataAttrs: [],
        hiddenInputs: [], forms: [],
      };

      document.querySelectorAll('iframe').forEach(e => {
        results.iframes.push({ src: e.src || '', id: e.id || '', hidden: e.hidden, display: getComputedStyle(e).display });
      });
      document.querySelectorAll('embed').forEach(e => {
        results.embeds.push({ src: e.src || '', type: e.type || '' });
      });
      document.querySelectorAll('a[href]').forEach(e => {
        const href = e.href || '';
        if (href.includes('.pdf') || href.includes('pdf') || href.includes('download')) {
          results.pdfLinks.push({ href, text: e.textContent.trim().substring(0, 80) });
        }
      });
      document.querySelectorAll('button, a').forEach(e => {
        const onclick = e.getAttribute('onclick') || '';
        const dataUrl = e.getAttribute('data-url') || '';
        const dataSrc = e.getAttribute('data-src') || '';
        const dataPdf = e.getAttribute('data-pdf') || '';
        const href = e.href || '';
        const text = e.textContent.trim().substring(0, 60);
        if (onclick || dataUrl || dataSrc || dataPdf || href.includes('pdf') || href.includes('download')) {
          results.buttons.push({ tag: e.tagName, text, onclick: onclick.substring(0, 200), dataUrl, dataSrc, dataPdf, href });
        }
      });
      document.querySelectorAll('[data-pdf], [data-src*="pdf"], [data-url*="pdf"], [data-loc]').forEach(e => {
        results.dataAttrs.push({
          tag: e.tagName, id: e.id, class: e.className,
          'data-pdf': e.getAttribute('data-pdf'),
          'data-src': e.getAttribute('data-src'),
          'data-url': e.getAttribute('data-url'),
          'data-loc': e.getAttribute('data-loc'),
        });
      });
      document.querySelectorAll('input[type="hidden"]').forEach(e => {
        results.hiddenInputs.push({ name: e.name, value: e.value ? e.value.substring(0, 100) : '' });
      });
      document.querySelectorAll('form').forEach(e => {
        results.forms.push({ action: e.action || '', method: e.method || '', id: e.id || '' });
      });

      return results;
    });

    console.log('\n=== DOM Analysis ===');
    console.log(`Iframes: ${domAnalysis.iframes.length}`);
    domAnalysis.iframes.forEach(e => console.log(`  src="${e.src.substring(0, 120)}" hidden=${e.hidden} display=${e.display}`));
    console.log(`Embeds: ${domAnalysis.embeds.length}`);
    domAnalysis.embeds.forEach(e => console.log(`  src="${e.src.substring(0, 120)}" type="${e.type}"`));
    console.log(`PDF links: ${domAnalysis.pdfLinks.length}`);
    domAnalysis.pdfLinks.slice(0, 5).forEach(e => console.log(`  "${e.text}" → ${e.href.substring(0, 120)}`));
    console.log(`Buttons/links with data: ${domAnalysis.buttons.length}`);
    domAnalysis.buttons.slice(0, 10).forEach(e => console.log(`  [${e.tag}] "${e.text}" onclick="${e.onclick}" dataUrl="${e.dataUrl}" dataPdf="${e.dataPdf}" href="${e.href.substring(0, 80)}"`));
    console.log(`Data attrs: ${domAnalysis.dataAttrs.length}`);
    domAnalysis.dataAttrs.forEach(e => console.log(`  ${e.tag}#${e.id} data-pdf="${e['data-pdf']}" data-src="${e['data-src']}" data-url="${e['data-url']}" data-loc="${e['data-loc']}"`));
    console.log(`Hidden inputs: ${domAnalysis.hiddenInputs.length}`);
    domAnalysis.hiddenInputs.forEach(e => console.log(`  ${e.name}="${e.value}"`));
    console.log(`Forms: ${domAnalysis.forms.length}`);
    domAnalysis.forms.forEach(e => console.log(`  form#${e.id} action="${e.action}" method="${e.method}"`));

    console.log('\n=== Network Requests ===');
    console.log(`PDF-related requests: ${pdfRequests.length}`);
    pdfRequests.forEach(r => console.log(`  [${r.type}] ${r.url}`));
    
    const relevantRequests = allRequests.filter(r => 
      r.type === 'document' || r.type === 'script' || r.type === 'xhr' || r.type === 'fetch'
    ).slice(-20);
    console.log(`\nLast 20 doc/script/xhr/fetch requests:`);
    relevantRequests.forEach(r => console.log(`  [${r.type}] ${r.url}`));

    // Screenshot
    await page.screenshot({ path: 'D:/SC_link/server/uploads/doi2_scishub.png', fullPage: false });
    console.log('\n📸 Screenshot: D:/SC_link/server/uploads/doi2_scishub.png');

  } catch (e) {
    console.log(`Error: ${e.message}`);
    await page.screenshot({ path: 'D:/SC_link/server/uploads/doi2_error.png' }).catch(() => {});
  }

  await browser.close();
}

async function tryLibGenLI() {
  console.log('\n\n=== Testing LibGen.li ===');
  const url = `http://libgen.li/search?search=${encodeURIComponent(doi)}`;
  console.log(`→ ${url}`);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const title = await page.title();
    console.log(`Title: "${title}"`);

    const html = await page.content();
    const $ = cheerio.load(html);
    
    const rows = $('table.catalog tr td a').map((i, el) => $(el).attr('href')).get();
    const pdfLinks = $('a[href*=".pdf"]').map((i, el) => $(el).attr('href')).get();
    const getLinks = $('a[href*="/get/"]').map((i, el) => $(el).attr('href')).get();
    
    console.log(`Table rows (a tags): ${rows.length}`);
    console.log(`PDF links: ${pdfLinks.length}`);
    console.log(`/get/ links: ${getLinks.length}`);
    
    if (rows.length > 0) {
      console.log('First few links:', rows.slice(0, 5));
    }

    await page.screenshot({ path: 'D:/SC_link/server/uploads/libgenli_search.png', fullPage: false });
    console.log('📸 Screenshot: D:/SC_link/server/uploads/libgenli_search.png');
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }

  await browser.close();
}

async function tryAnnaArchive() {
  console.log('\n\n=== Testing Anna\'s Archive (annasarchive.org) ===');
  const searchUrl = `https://annasarchive.org/search?q=${encodeURIComponent(doi)}&content_type=pdf`;
  console.log(`→ ${searchUrl}`);

  try {
    const res = await axios.get(searchUrl, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0 ScholarLink/1.0' } });
    const $ = cheerio.load(res.data);
    
    const md5Links = $('a[href*="/md5/"]').map((i, el) => $(el).attr('href')).get();
    console.log(`md5 links: ${md5Links.length}`);
    
    if (md5Links.length > 0) {
      console.log('First result:', md5Links[0]);
      // Navigate to first result
      const md5Url = `https://annasarchive.org${md5Links[0]}`;
      const res2 = await axios.get(md5Url, { timeout: 20000 });
      const $$ = cheerio.load(res2.data);
      
      const dlLinks = $$('a[href*="/download/"]').map((i, el) => $(el).attr('href')).get();
      const pdfLinks = $$('a[href*=".pdf"]').map((i, el) => $(el).attr('href')).get();
      
      console.log(`Download links: ${dlLinks.length}`);
      console.log(`PDF links on md5 page: ${pdfLinks.length}`);
      
      if (dlLinks.length > 0) {
        const fullDl = dlLinks[0].startsWith('http') ? dlLinks[0] : `https://annasarchive.org${dlLinks[0]}`;
        console.log(`→ First download URL: ${fullDl}`);
        
        // Test if accessible
        try {
          const head = await axios.head(fullDl, { timeout: 10000 });
          console.log(`  Status: ${head.status}, Content-Type: ${head.headers['content-type']}`);
        } catch (e) {
          console.log(`  HEAD check failed: ${e.message}`);
        }
      }
    } else {
      // Try without content_type filter
      const resAll = await axios.get(`https://annasarchive.org/search?q=${encodeURIComponent(doi)}`, { timeout: 20000 });
      const $all = cheerio.load(resAll.data);
      const allMd5 = $all('a[href*="/md5/"]').map((i, el) => $all(el).attr('href')).get();
      console.log(`md5 links (no filter): ${allMd5.length}`);
      if (allMd5.length > 0) console.log('First:', allMd5[0]);
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

async function tryCrossrefUnpaywall() {
  console.log('\n\n=== Testing Crossref / Unpaywall (Open Access API) ===');
  
  // Unpaywall - free OA location finder
  try {
    const res = await axios.get(`https://api.unpaywall.org/v2/${doi}?email=scholarlink@example.com`, { timeout: 15000 });
    const data = res.data;
    console.log('Unpaywall response:');
    console.log(`  Is OA: ${data.is_oa}`);
    console.log(`  OAI location: ${data.best_oa_location?.url || 'none'}`);
    console.log(`  OAI location type: ${data.best_oa_location?.url_for_pdf || 'none'}`);
    console.log(`  Best PDF URL: ${data.best_oa_location?.url_for_pdf || 'none'}`);
    console.log(`  Publisher: ${data.publisher || 'none'}`);
    console.log(`  Journal: ${data.journal_issn_l || 'none'}`);
    
    if (data.best_oa_location?.url_for_pdf) {
      const pdfUrl = data.best_oa_location.url_for_pdf;
      console.log(`\n🎉 OA PDF URL found: ${pdfUrl}`);
      try {
        const head = await axios.head(pdfUrl, { timeout: 10000 });
        console.log(`  Status: ${head.status}, Content-Type: ${head.headers['content-type']}`);
      } catch (e) {
        console.log(`  HEAD check: ${e.message}`);
      }
    }
  } catch (e) {
    console.log(`Unpaywall error: ${e.message}`);
  }
}

async function main() {
  await analyzeSciHubShNetwork();
  await tryLibGenLI();
  await tryAnnaArchive();
  await tryCrossrefUnpaywall();
  console.log('\n✅ Done');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
