// Sci-Hub.sh의 DOI 2 페이지를 Puppeteer로 상세 분석
const puppeteer = require('puppeteer');

async function analyzeSciHubSh() {
  const doi = '10.1007/s13668-023-00492-x';
  const url = `https://sci-hub.sh/${doi}`;
  
  console.log(`🔍 Analyzing: ${url}\n`);
  
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process'],
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const title = await page.title();
    console.log(`Title: "${title}"`);
    
    // Get full HTML for analysis
    const html = await page.content();
    console.log(`\nHTML length: ${html.length} chars`);
    
    // Check for Cloudflare
    if (html.includes('Cloudflare') || html.includes('Just a moment')) {
      console.log('⚠️  Cloudflare challenge detected!');
    }
    
    // Find all PDF-related elements
    const analysis = await page.evaluate(() => {
      const results = {};
      
      // iframes
      results.iframes = Array.from(document.querySelectorAll('iframe')).map(e => ({
        src: e.src,
        id: e.id,
        class: e.className,
      }));
      
      // embeds
      results.embeds = Array.from(document.querySelectorAll('embed')).map(e => ({
        src: e.src,
        type: e.type,
      }));
      
      // links ending in .pdf
      results.pdfLinks = Array.from(document.querySelectorAll('a[href$=".pdf"]')).map(e => ({
        href: e.href,
        text: e.textContent.trim(),
      }));
      
      // links containing .pdf
      results.pdfInHref = Array.from(document.querySelectorAll('a[href*=".pdf"]')).map(e => ({
        href: e.href,
        text: e.textContent.trim(),
      }));
      
      // buttons with onclick
      results.buttons = Array.from(document.querySelectorAll('button, a')).map(e => ({
        tag: e.tagName,
        text: e.textContent.trim().substring(0, 50),
        onclick: e.getAttribute('onclick') || '',
        href: e.getAttribute('href') || '',
      })).filter(e => e.onclick.includes('.pdf') || e.href.includes('.pdf'));
      
      // data attributes
      results.dataPdf = Array.from(document.querySelectorAll('[data-pdf], [data-src*="pdf"], [data-url*="pdf"], [data-download]')).map(e => ({
        tag: e.tagName,
        dataPdf: e.getAttribute('data-pdf'),
        dataSrc: e.getAttribute('data-src'),
        dataUrl: e.getAttribute('data-url'),
        dataDownload: e.getAttribute('data-download'),
      }));
      
      // any element containing "pdf" in attributes
      const allEls = Array.from(document.querySelectorAll('*'));
      results.misc = [];
      for (const el of allEls.slice(0, 500)) {
        const src = el.src || '';
        const href = el.href || '';
        const onclick = el.getAttribute('onclick') || '';
        if (src.includes('.pdf') || href.includes('.pdf') || onclick.includes('.pdf')) {
          results.misc.push({ tag: el.tagName, src, href, onclick: onclick.substring(0, 100) });
        }
      }
      
      return results;
    });
    
    console.log('\n=== Analysis Results ===');
    console.log(`\nIframes (${analysis.iframes.length}):`);
    analysis.iframes.forEach(e => console.log(`  src="${e.src}" id="${e.id}"`));
    
    console.log(`\nEmbeds (${analysis.embeds.length}):`);
    analysis.embeds.forEach(e => console.log(`  type="${e.type}" src="${e.src}"`));
    
    console.log(`\nPDF Links (${analysis.pdfLinks.length}):`);
    analysis.pdfLinks.forEach(e => console.log(`  "${e.text}" → ${e.href}`));
    
    console.log(`\nLinks containing .pdf (${analysis.pdfInHref.length}):`);
    analysis.pdfInHref.forEach(e => console.log(`  "${e.text}" → ${e.href}`));
    
    console.log(`\nButtons/Links with PDF onclick (${analysis.buttons.length}):`);
    analysis.buttons.forEach(e => console.log(`  ${e.tag}: "${e.text}" | onclick="${e.onclick}"`));
    
    console.log(`\nData attributes (${analysis.dataPdf.length}):`);
    analysis.dataPdf.forEach(e => console.log(`  ${JSON.stringify(e)}`));
    
    console.log(`\nMisc PDF refs (${analysis.misc.length}):`);
    analysis.misc.slice(0, 5).forEach(e => console.log(`  ${e.tag}: src="${e.src}" href="${e.href}"`));
    
    // Try screenshot
    await page.screenshot({ path: 'D:/SC_link/server/scihub_sh_doi2.png', fullPage: false });
    console.log('\n📸 Screenshot saved to D:/SC_link/server/scihub_sh_doi2.png');
    
  } catch (e) {
    console.log(`Error: ${e.message}`);
    await page.screenshot({ path: 'D:/SC_link/server/scihub_sh_error.png' }).catch(() => {});
    console.log('📸 Error screenshot saved');
  }
  
  await browser.close();
}

analyzeSciHubSh().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
