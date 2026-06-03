// downloadService 디버깅 — 각 단계를 로그로 추적
process.chdir(__dirname);
require('dotenv').config();
const axios = require('axios');
const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const puppeteer = require('puppeteer');

const dbUrl = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 10000 });
const UPLOAD_DIR = './uploads';

// ─── Helper: check PDF accessibility ───
async function checkPdfAccessible(pdfUrl) {
  try {
    const head = await axios.head(pdfUrl, { timeout: 15000, maxRedirects: 5 });
    const ct = String(head.headers['content-type'] || '');
    console.log(`    [HEAD] ${head.status} | ${ct} | ${head.headers['content-length']}b | ${pdfUrl.substring(0,80)}`);
    return (ct.includes('pdf') || !!head.headers['content-length']) && head.status === 200;
  } catch (e) {
    console.log(`    [HEAD] ERROR ${e.response?.status || e.code}: ${pdfUrl.substring(0,80)}`);
    if (e.response?.status === 403 || e.response?.status === 401) return false;
    return true;
  }
}

// ─── Step-by-step for DOI 1 ───
async function testDoi1() {
  const doi = '10.1016/j.cellimm.2004.06.005';
  console.log(`\n${'#'.repeat(70)}`);
  console.log(`# DOI 1: ${doi}`);
  console.log(`${'#'.repeat(70)}`);

  const servers = await pool.query(
    `SELECT id, name, url, type FROM download_servers WHERE is_active=true AND status IN ('ONLINE','SLOW') ORDER BY avg_latency ASC`
  );

  for (const server of servers.rows) {
    console.log(`\n▶ Server: ${server.name} (${server.type}) ${server.url}`);
    
    if (server.type !== 'scihub') continue;

    // Step 1: cloudscraper page fetch
    console.log('  [1] cloudscraper.get(page)...');
    let pageHtml;
    try {
      pageHtml = await cloudscraper.get(`${server.url}/${doi}`, { timeout: 15000 });
      console.log(`      ✅ Got HTML: ${pageHtml.length} chars`);
    } catch (e) {
      console.log(`      ❌ cloudscraper error: ${e.message.substring(0, 100)}`);
      continue;
    }

    // Step 2: Parse HTML for PDF URL
    const $ = cheerio.load(pageHtml);
    const pdfHref = $('a[href$=".pdf"]').first().attr('href') ||
                    $('a[href*=".pdf?"]').first().attr('href') ||
                    $('embed[type="application/pdf"]').attr('src') ||
                    $('iframe').filter('[src*="pdf"], [src*="viewer"]').attr('src');
    
    if (!pdfHref) {
      console.log(`      ❌ No PDF URL in HTML`);
      continue;
    }

    const fullUrl = pdfHref.startsWith('http') ? pdfHref : `${server.url}${pdfHref}`;
    console.log(`  [2] Found PDF URL: ${fullUrl}`);

    // Step 3: HEAD check
    console.log('  [3] HEAD check...');
    const accessible = await checkPdfAccessible(fullUrl);
    if (!accessible) {
      console.log('      ❌ HEAD check failed — PDF not directly accessible');
      console.log('  [4] Trying Puppeteer...');
      
      // Try Puppeteer with the known URL
      const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process'],
      });
      const page = await browser.newPage();
      try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(fullUrl, { timeout: 30000 });
        await page.waitForTimeout(2000);
        const ct = await page.evaluate(() => document.contentType || '');
        console.log(`      Puppeteer page.contentType: "${ct}"`);
        
        if (ct.includes('pdf') || fullUrl.endsWith('.pdf')) {
          const filename = `test_${Date.now()}_${doi.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
          const filePath = path.join(UPLOAD_DIR, filename);
          const pdfBuffer = await page.pdf({ printBackground: true });
          fs.writeFileSync(filePath, pdfBuffer);
          const stat = fs.statSync(filePath);
          console.log(`      ✅ Puppeteer PDF saved: ${stat.size} bytes → ${filename}`);
        }
      } catch (e) {
        console.log(`      ❌ Puppeteer error: ${e.message.substring(0, 150)}`);
      } finally {
        await page.close();
        await browser.close();
      }
    } else {
      // Step 4: Direct download
      console.log('  [4] Downloading directly...');
      try {
        const pdfRes = await axios.get(fullUrl, { responseType: 'stream', timeout: 60000 });
        const filename = `test_${Date.now()}_${doi.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const filePath = path.join(UPLOAD_DIR, filename);
        const writer = fs.createWriteStream(filePath);
        pdfRes.data.pipe(writer);
        await new Promise((res, rej) => { writer.on('finish', res); writer.on('error', rej); });
        const stat = fs.statSync(filePath);
        console.log(`      ✅ Downloaded: ${stat.size} bytes`);
      } catch (e) {
        console.log(`      ❌ Download error: ${e.message.substring(0, 100)}`);
      }
    }
  }
}

// ─── Step-by-step for DOI 2 ───
async function testDoi2() {
  const doi = '10.1007/s13668-023-00492-x';
  console.log(`\n${'#'.repeat(70)}`);
  console.log(`# DOI 2: ${doi}`);
  console.log(`${'#'.repeat(70)}`);

  // Try LibGen JSON API
  console.log('\n▶ Testing LibGen JSON API...');
  try {
    const res = await axios.get(`https://libgen.lc/json.php`, {
      params: { req: doi, limit: 1, columns: 'id,title,author,md5' },
      timeout: 15000,
    });
    console.log(`  Response type: ${typeof res.data}`);
    console.log(`  Data: ${JSON.stringify(res.data).substring(0, 200)}`);
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 100)} | status: ${e.response?.status}`);
  }

  // Try LibGen search
  console.log('\n▶ Testing LibGen search...');
  try {
    const res = await cloudscraper.get(`https://libgen.lc/?s=${encodeURIComponent(doi)}`, { timeout: 15000 });
    const $ = cheerio.load(res);
    const links = $('a[href*=".pdf"]').slice(0, 3).map((i, el) => $(el).attr('href')).get();
    console.log(`  Found PDF links: ${links.join(', ')}`);
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 100)}`);
  }

  // Try Anna's Archive with alternative domain
  console.log('\n▶ Testing Anna\'s Archive...');
  const annasUrls = [
    'https://annas-archive.org',
    'https://annasarchive.org',
  ];
  for (const base of annasUrls) {
    try {
      const res = await cloudscraper.get(`${base}/search?q=${encodeURIComponent(doi)}&content_type=pdf`, { timeout: 15000 });
      const $ = cheerio.load(res);
      const result = $('a[href*="/md5/"]').first().attr('href');
      console.log(`  ${base}: ✅ page loaded | md5 link: ${result || 'none'}`);
    } catch (e) {
      console.log(`  ${base}: ❌ ${e.message.substring(0, 80)}`);
    }
  }

  // Try Internet Archive
  console.log('\n▶ Testing Internet Archive...');
  try {
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process'],
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(`https://archive.org/search?query=${encodeURIComponent(doi)}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('a.result-heading', { timeout: 10000 }).catch(() => {});
    const firstLink = await page.$eval('a.result-heading', el => el.href).catch(() => null);
    console.log(`  First result: ${firstLink || 'none'}`);
    await browser.close();
  } catch (e) {
    console.log(`  ❌ ${e.message.substring(0, 100)}`);
  }
}

async function main() {
  try {
    await testDoi1();
    await testDoi2();
    await pool.end();
    console.log('\n✅ Debug complete');
  } catch (e) {
    console.error('Fatal:', e.message);
    await pool.end();
    process.exit(1);
  }
}

main();
