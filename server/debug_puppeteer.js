// Puppeteer 폴백이 왜 안 되는지 디버깅
const puppeteer = require('puppeteer');

async function testPuppeteer() {
  console.log('🚀 Puppeteer 테스트 시작...\n');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process'],
  });
  
  const urls = [
    'https://sci-hub.sh/10.1007/s13668-023-00492-x',
    'https://sci-hub.st/10.1007/s13668-023-00492-x',
    'https://annas-archive.org/search?q=10.1007/s13668-023-00492-x&content_type=pdf',
  ];
  
  for (const url of urls) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`URL: ${url}`);
    console.log('='.repeat(60));
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    try {
      console.log('  ⏳ page.goto...');
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log('  ✅ Page loaded');
      
      // Check for Cloudflare challenge
      const title = await page.title();
      console.log(`  Title: "${title}"`);
      
      if (title.includes('Cloudflare') || title.includes('DDoS') || title.includes('Just a moment')) {
        console.log('  🔒 Cloudflare/DDoS challenge page!');
        await page.close();
        continue;
      }
      
      // Wait a bit for JS to render
      await page.waitForTimeout(3000);
      
      // Try to find PDF candidates
      await page.waitForSelector('embed[type="application/pdf"], iframe[src*="pdf"], a[href$=".pdf"], [class*="download"]', {
        timeout: 10000,
      }).catch(() => console.log('  ⏳ Selector timeout — continuing anyway'));
      
      // Collect candidates
      const embeds = await page.$$eval('embed[src], iframe[src]', els => els.map(e => e.src || ''));
      const links = await page.$$eval('a[href]', els => els.filter(e => (e.href || '').toLowerCase().includes('.pdf')).map(e => e.href || ''));
      const buttons = await page.$$eval('button, a', els => els.flatMap(e => {
        const onclick = e.getAttribute('onclick') || '';
        const match = onclick.match(/['"]([^'"]*\.pdf[^'"]*)['"]/) || [];
        return [...match, e.getAttribute('data-src') || '', e.getAttribute('data-url') || '', e.getAttribute('data-pdf') || ''].filter(Boolean);
      }));
      
      console.log(`  Embeds: ${embeds.length > 0 ? embeds.join(', ') : 'none'}`);
      console.log(`  PDF Links: ${links.length > 0 ? links.join(', ') : 'none'}`);
      console.log(`  Button candidates: ${buttons.length > 0 ? buttons.join(', ') : 'none'}`);
      
      if (embeds.length > 0) console.log(`\n  ✅ PDF EMBED FOUND: ${embeds[0]}`);
      else if (links.length > 0) console.log(`\n  ✅ PDF LINK FOUND: ${links[0]}`);
      else if (buttons.length > 0) console.log(`\n  ✅ PDF BUTTON FOUND: ${buttons[0]}`);
      else console.log(`  ❌ No PDF found`);
      
    } catch (e) {
      console.log(`  ❌ Error: ${e.message.substring(0, 150)}`);
    }
    
    await page.close();
  }
  
  await browser.close();
  console.log('\n✅ Puppeteer 테스트 완료');
}

testPuppeteer().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
