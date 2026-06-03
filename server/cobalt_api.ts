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

  // Intercept network requests
  const apiCalls = [];
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('/publication') || url.includes('/search')) {
      try {
        const body = await response.text();
        apiCalls.push({ url, status: response.status(), body: body.substring(0, 300) });
      } catch {}
    }
  });

  // Search
  await page.goto('https://cobalt.colab.ws/?term=10.1038%2Fs41576-019-0205-4', {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 3000));

  console.log('API calls found:', apiCalls.length);
  for (const call of apiCalls) {
    console.log('\nURL:', call.url);
    console.log('Status:', call.status);
    console.log('Body:', call.body);
  }

  await browser.close();
})().catch(e => console.log('Error:', e.message));