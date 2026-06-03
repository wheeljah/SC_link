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

  // 1. Search
  await page.goto('https://cobalt.colab.ws/?term=10.1038%2Fs41576-019-0205-4', {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 3000));

  // 2. Get page state
  const state = await page.evaluate(() => {
    // Find the first publication result
    const results = Array.from(document.querySelectorAll('[class*="publication"], .result-item, article, [class*="item"]'));
    return {
      url: window.location.href,
      resultCount: results.length,
      bodySnippet: document.body.innerText.substring(0, 300),
    };
  });
  console.log('State:', JSON.stringify(state, null, 2));

  // 3. Click the first result
  const firstLink = await page.$('a[href*="/publication/"]');
  if (firstLink) {
    console.log('\nClicking first result...');
    await Promise.all([
      firstLink.click(),
      page.waitForNavigation({waitUntil:'networkidle2', timeout:30000}).catch(() => {})
    ]);
    await new Promise(r => setTimeout(r, 2000));

    const detailState = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.querySelector('[class*="title"]')?.innerText || document.querySelector('h1')?.innerText || '',
        bodyText: document.body.innerText.substring(0, 600),
      };
    });
    console.log('\nDetail page:', JSON.stringify(detailState, null, 2));
  } else {
    console.log('No publication links found. Trying to find any links...');
    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => h.includes('colab')).slice(0, 10)
    );
    console.log('Links:', JSON.stringify(links));
  }

  await browser.close();
})().catch(e => console.log('Error:', e.message));