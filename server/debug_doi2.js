// DOI 2攻坚: LibGen, Anna's Archive, 다른 Sci-Hub 도메인 테스트
const axios = require('axios');
const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const doi = '10.1007/s13668-023-00492-x';

async function tryLibGenIs() {
  console.log('\n=== [1] LibGen.is ===');
  const url = `http://libgen.is/scimag/?req=${encodeURIComponent(doi)}&lg_topic=libgen&open=0&view=simple&res=25&phrase=1&column=def`;
  try {
    const res = await cloudscraper.get(url, { timeout: 20000 });
    const $ = cheerio.load(res);
    const links = $('a[href*=".pdf"]').map((i, el) => $(el).attr('href')).get();
    const getLinks = $('a[href*="/get"]').map((i, el) => $(el).attr('href')).get();
    console.log(`  PDF links: ${links.slice(0, 3).join(', ') || 'none'}`);
    console.log(`  /get links: ${getLinks.slice(0, 3).join(', ') || 'none'}`);
    
    // Try JSON API
    const jsonUrl = `http://libgen.is/json.php?req=${encodeURIComponent(doi)}&limit=1`;
    try {
      const jsonRes = await cloudscraper.get(jsonUrl, { timeout: 20000 });
      const parsed = JSON.parse(jsonRes);
      console.log(`  JSON result: ${JSON.stringify(parsed).substring(0, 200)}`);
    } catch (e) {
      console.log(`  JSON API error: ${e.message.substring(0, 100)}`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message.substring(0, 100)}`);
  }
}

async function tryAnnasArchiveAlt() {
  console.log('\n=== [2] Anna\'s Archive alternatives ===');
  
  // Try different domain variations
  const domains = [
    'https://annas-archive.org',
    'https://annasarchive.org',
    'https://s3.archive.org',  // direct S3
  ];
  
  for (const base of domains) {
    try {
      const url = `${base}/search?q=${encodeURIComponent(doi)}&content_type=pdf`;
      const res = await cloudscraper.get(url, { timeout: 20000 });
      const $ = cheerio.load(res);
      const md5Link = $('a[href*="/md5/"]').first().attr('href');
      const pdfLink = $('a[href$=".pdf"]').first().attr('href');
      console.log(`  ${base}: ✅ page | md5=${md5Link || 'none'} | pdf=${pdfLink || 'none'}`);
      
      if (md5Link) {
        const md5Page = await cloudscraper.get(`${base}${md5Link}`, { timeout: 20000 });
        const $$ = cheerio.load(md5Page);
        const dlLink = $$('a[href*="/download/"]').first().attr('href') || 
                       $$('a[href$=".pdf"]').first().attr('href');
        console.log(`    Download link: ${dlLink || 'none'}`);
      }
    } catch (e) {
      console.log(`  ${base}: ❌ ${e.message.includes('ENOTFOUND') ? 'DNS fail' : e.message.substring(0, 80)}`);
    }
  }
}

async function trySciHubDomains() {
  console.log('\n=== [3] Sci-Hub domains (cloudscraper + Puppeteer) ===');
  
  const domains = [
    'https://sci-hub.se',
    'https://sci-hub.ren',
    'https://sci-hub.wf',
    'https://sci-hub.sh',
  ];
  
  for (const base of domains) {
    const url = `${base}/${doi}`;
    
    // Test cloudscraper
    try {
      const res = await cloudscraper.get(url, { timeout: 20000 });
      const $ = cheerio.load(res);
      const pdfLink = $('a[href$=".pdf"]').first().attr('href') || 
                      $('iframe').attr('src') ||
                      $('embed[type="application/pdf"]').attr('src');
      const title = $('title').text();
      
      if (pdfLink) {
        console.log(`  ${base}: ✅ cloudscraper OK | title="${title.substring(0, 50)}" | pdf=${pdfLink}`);
      } else {
        console.log(`  ${base}: ⚠️  cloudscraper OK but no PDF | title="${title.substring(0, 50)}"`);
      }
    } catch (e) {
      console.log(`  ${base}: ❌ cloudscraper blocked (${e.message.includes('403') ? '403' : 'other'})`);
    }
    
    // Test Puppeteer quickly
    try {
      const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process'],
      });
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      const html = await page.content();
      await browser.close();
      
      const $2 = cheerio.load(html);
      const pdfLink = $2('a[href$=".pdf"]').first().attr('href') || $2('iframe').attr('src');
      const title = $2('title').text();
      
      if (pdfLink) {
        console.log(`    Puppeteer: ✅ | title="${title.substring(0, 50)}" | pdf=${pdfLink}`);
      } else if (title.includes('Cloudflare') || title.includes('DDoS')) {
        console.log(`    Puppeteer: ❌ Cloudflare challenge`);
      } else {
        console.log(`    Puppeteer: ⚠️ no PDF | title="${title.substring(0, 50)}"`);
      }
    } catch (e) {
      console.log(`    Puppeteer: ❌ ${e.message.includes('detached') ? 'frame detached (Cloudflare)' : e.message.substring(0, 80)}`);
    }
  }
}

async function tryScholarcyOrOther() {
  console.log('\n=== [4] Direct DOI resolve ===');
  try {
    // Try to resolve via publisher
    const res = await axios.get(`https://link.springer.com/content/pdf/10.1007/s13668-023-00492-x.pdf`, {
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
    });
    console.log(`  Springer direct: ${res.status}`);
  } catch (e) {
    console.log(`  Springer direct: ❌ ${e.message.substring(0, 80)}`);
  }
}

async function main() {
  await tryLibGenIs();
  await tryAnnasArchiveAlt();
  await trySciHubDomains();
  await tryScholarcyOrOther();
  console.log('\n✅ Done');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
