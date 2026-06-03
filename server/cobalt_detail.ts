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

  // 1. Article detail page
  console.log('=== Article detail ===');
  await page.goto('https://colab.ws/articles/10.1038/s41576-019-0205-4?locale=en', {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 2000));

  const articleData = await page.evaluate(() => {
    const body = document.body.innerText;
    // Extract all numbers that look like citations
    const allNumbers = body.match(/\b\d[\d.,]*[kK]?\b/g)?.slice(0, 30) || [];
    const lines = body.split('\n').filter(l => l.trim().length > 0);
    return { lines: lines.slice(0, 60), allNumbers };
  });
  console.log('Article lines:', JSON.stringify(articleData.lines, null, 2));

  // 2. Journal page for SCImago/SJR/IF
  console.log('\n=== Journal detail ===');
  await page.goto('https://colab.ws/journals/13955?locale=en', {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 2000));

  const journalData = await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').filter(l => l.trim().length > 0);
    return { lines: lines.slice(0, 80) };
  });
  console.log('Journal lines:', JSON.stringify(journalData.lines, null, 2));

  await browser.close();
})().catch(e => console.log('Error:', e.message));