import 'dotenv/config';
import puppeteer from 'puppeteer';

async function checkCobalt() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // Load cookie from .env
  const cookieValue = process.env.COBALT_SESSION_COOKIE;
  if (!cookieValue) {
    console.log('No COBALT_SESSION_COOKIE found');
    await browser.close();
    return;
  }
  console.log('Setting session cookie...');
  await page.setCookie({
    name: 'colab_session',
    value: cookieValue,
    domain: '.colab.ws',
    path: '/',
    httpOnly: true,
    secure: true,
  });

  // Navigate to cobalt search
  await page.goto('https://cobalt.colab.ws/?term=10.1038%2Fs41576-019-0205-4', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });
  await new Promise(r => setTimeout(r, 2000));

  const url = page.url();
  console.log('URL:', url);

  // Get page text
  const text = await page.evaluate(() => document.body.innerText);
  console.log('Page text (first 800):\n', text.substring(0, 800));

  // Check for "not found" or error
  const notFound = text.toLowerCase().includes('not found') || text.toLowerCase().includes('не найден');
  console.log('Has not found:', notFound);

  // Check HTML for search results
  const html = await page.content();
  // Look for article/scopus/ваканс/etc indicators
  const relevantHtml = html.substring(0, 3000);
  console.log('\nRelevant HTML (first 1000):', relevantHtml.substring(0, 1000));

  await browser.close();
}

checkCobalt().catch(e => console.log('Error:', e.message));
