// DOI 2攻坚: Sci-Hub.sh 페이지의 동적 요소 + iframe 분석
const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');

const doi = '10.1007/s13668-023-00492-x';

async function analyzePage() {
  const url = `https://sci-hub.sh/${doi}`;
  console.log(`🔍 Deep analysis of: ${url}\n`);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for various possible indicators
    const selectors = [
      'iframe[src*="pdf"]',
      'embed[type="application/pdf"]',
      'a[href$=".pdf"]',
      '[class*="download"]',
      '[id*="pdf"]',
      '.pdf-container',
      '#viewer',
    ];
    
    for (const sel of selectors) {
      try {
        const el = await page.waitForSelector(sel, { timeout: 5000 });
        if (el) console.log(`✅ Found: ${sel}`);
      } catch {}
    }

    // Wait for any iframe to load (waitForTimeout is deprecated in Puppeteer v22+)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get all iframes
    const frames = await page.frames();
    console.log(`\n📺 Frames: ${frames.length}`);
    for (const f of frames) {
      try {
        const url = f.url();
        console.log(`  - url="${url}" name="${f.name()}"`);
      } catch {}
    }

    // Check main frame content
    const mainHtml = await page.evaluate(() => document.body.innerHTML.substring(0, 2000));
    console.log(`\n📄 Body HTML (first 2000 chars):`);
    console.log(mainHtml);

    // Check for specific Sci-Hub structures
    const sciHubAnalysis = await page.evaluate(() => {
      const results = { iframes: [], embeds: [], links: [], buttons: [], sources: [] };
      
      document.querySelectorAll('iframe').forEach(e => {
        results.iframes.push({ src: e.src, id: e.id, style: e.style.cssText.substring(0, 100) });
      });
      document.querySelectorAll('embed').forEach(e => {
        results.embeds.push({ src: e.src, type: e.type });
      });
      document.querySelectorAll('a[href]').forEach(e => {
        const href = e.href;
        if (href.includes('.pdf') || href.includes('pdf') || href.includes('download')) {
          results.links.push({ href, text: e.textContent.trim().substring(0, 50) });
        }
      });
      document.querySelectorAll('button').forEach(e => {
        const onclick = e.getAttribute('onclick') || '';
        const dataUrl = e.getAttribute('data-url') || '';
        const dataSrc = e.getAttribute('data-src') || '';
        if (onclick || dataUrl || dataSrc) {
          results.buttons.push({ 
            text: e.textContent.trim().substring(0, 30),
            onclick: onclick.substring(0, 100),
            dataUrl,
            dataSrc,
          });
        }
      });
      document.querySelectorAll('[data-loc], [data-src], [data-url], [data-pdf]').forEach(e => {
        results.sources.push({
          tag: e.tagName,
          dataLoc: e.getAttribute('data-loc'),
          dataSrc: e.getAttribute('data-src'),
          dataUrl: e.getAttribute('data-url'),
          dataPdf: e.getAttribute('data-pdf'),
        });
      });
      
      return results;
    });

    console.log('\n=== Sci-Hub structure ===');
    console.log(`Iframes (${sciHubAnalysis.iframes.length}):`, sciHubAnalysis.iframes);
    console.log(`Embeds (${sciHubAnalysis.embeds.length}):`, sciHubAnalysis.embeds);
    console.log(`PDF links (${sciHubAnalysis.links.length}):`, sciHubAnalysis.links.slice(0, 5));
    console.log(`Buttons with data (${sciHubAnalysis.buttons.length}):`, sciHubAnalysis.buttons.slice(0, 5));
    console.log(`Data attrs (${sciHubAnalysis.sources.length}):`, sciHubAnalysis.sources.slice(0, 5));

    // Check if there's a hidden iframe
    const allIframes = await page.$$('iframe');
    console.log(`\nTotal iframes in DOM: ${allIframes.length}`);
    for (const iframe of allIframes) {
      const props = await iframe.evaluate(el => ({
        src: el.src,
        id: el.id,
        style: el.style.cssText,
        hidden: el.hidden,
        width: el.width,
        height: el.height,
        srcdoc: el.srcdoc ? '(has srcdoc)' : 'none',
      }));
      console.log(`  iframe: ${JSON.stringify(props)}`);
    }

    // Check shadow DOM or closed frames
    console.log('\n=== Frame details ===');
    for (const f of frames) {
      try {
        const frameUrl = f.url();
        const frameTitle = await f.title().catch(() => '(error)');
        console.log(`Frame: "${frameUrl.substring(0, 80)}" | title="${frameTitle}" | name="${f.name()}"`);
        
        if (frameUrl.includes('pdf') || frameUrl.includes('viewer') || frameUrl.includes('pdfjs')) {
          console.log(`  🎉 PDF FRAME FOUND: ${frameUrl}`);
        }
      } catch {}
    }

    // Screenshot
    await page.screenshot({ path: 'D:/SC_link/server/uploads/doi2_page.png', fullPage: false });
    console.log('\n📸 Screenshot: D:/SC_link/server/uploads/doi2_page.png');

  } catch (e) {
    console.log(`Error: ${e.message}`);
    await page.screenshot({ path: 'D:/SC_link/server/uploads/doi2_error.png' }).catch(() => {});
  }

  await browser.close();
}

// Also try LibGen.li with browser
async function tryLibGenLi() {
  console.log('\n\n=== LibGen.li with browser ===');
  const url = `http://libgen.li/?s=${encodeURIComponent(doi)}`;
  
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
    
    const html = await page.content();
    const $ = cheerio.load(html);
    const pdfLinks = $('a[href$=".pdf"]').map((i, el) => $(el).attr('href')).get();
    const getLinks = $('a[href*="/get/"]').map((i, el) => $(el).attr('href')).get();
    const dlLinks = $('a[href*="download"]').map((i, el) => $(el).attr('href')).get();
    
    console.log(`Page loaded: ${html.length} chars`);
    console.log(`PDF links: ${pdfLinks.slice(0, 3).join(', ') || 'none'}`);
    console.log(`/get links: ${getLinks.slice(0, 3).join(', ') || 'none'}`);
    console.log(`download links: ${dlLinks.slice(0, 3).join(', ') || 'none'}`);
    
    await page.screenshot({ path: 'D:/SC_link/server/uploads/libgenli_page.png', fullPage: false });
    console.log('📸 Screenshot saved');
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  
  await browser.close();
}

async function main() {
  await analyzePage();
  await tryLibGenLi();
  console.log('\n✅ Done');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
