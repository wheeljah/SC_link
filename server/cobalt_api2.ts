import 'dotenv/config';
import puppeteer from 'puppeteer';
const cookie = process.env.COBALT_SESSION_COOKIE;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true, args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setCookie({name:'colab_session',value:cookie,domain:'.colab.ws',path:'/',httpOnly:true,secure:true});

  // Intercept ALL network requests
  const allCalls = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('cobalt.colab.ws') && (url.includes('api') || url.includes('pub') || url.includes('search') || url.includes('article'))) {
      allCalls.push({ type: 'request', url });
    }
  });
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('cobalt.colab.ws') && (url.includes('api') || url.includes('pub') || url.includes('search') || url.includes('article'))) {
      try {
        const body = await res.text();
        allCalls.push({ type: 'response', url, status: res.status(), body: body.substring(0, 500) });
      } catch(e) {
        allCalls.push({ type: 'response', url, error: e.message });
      }
    }
  });

  // Search
  await page.goto('https://cobalt.colab.ws/?term=10.1038%2Fs41576-019-0205-4', {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 4000));

  console.log('All calls:', JSON.stringify(allCalls, null, 2));

  // Also: what are all links from the page?
  const allLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .filter(a => !a.href.includes('#') && a.href !== 'https://cobalt.colab.ws/' && a.href !== 'https://cobalt.colab.ws/en')
      .map(a => ({ href: a.href, text: a.innerText?.trim() }))
      .slice(0, 20);
  });
  console.log('\nAll links:', JSON.stringify(allLinks, null, 2));

  await browser.close();
})().catch(e => console.log('Error:', e.message));