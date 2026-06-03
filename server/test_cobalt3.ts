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

  await page.goto('https://colab.ws/articles/10.1038/s41576-019-0205-4?locale=en', {waitUntil:'load', timeout:20000});
  await new Promise(r => setTimeout(r, 2000));

  // Get all lines with position info
  const allLines = await page.evaluate(() => {
    const lines = document.body.innerText.split('\n').map((l, i) => ({ i, text: l.trim(), len: l.trim().length }));
    // Find the title - it's the longest line > 30 chars before author names
    const candidate = lines.filter(l => l.len > 30 && l.len < 200 && !/^(RU|EN|Q[1-4]|SCIMAGO|SJR|CiteScore|ISSN|Impact|doi|http|Выдан|Genetics|Molecular|Biochemistry|Medicine)/i.test(l.text));
    return { allLines: lines.filter(l=>l.len>5).slice(0,80), candidate: candidate.slice(0,5) };
  });

  console.log('Candidates for title:', JSON.stringify(allLines.candidate, null, 2));

  // Get hrefs
  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .filter(a => a.href.includes('/journals/') && !a.href.includes('#'))
      .map(a => ({ href: a.href, text: a.innerText?.trim() }))
  );
  console.log('\nJournal links:', JSON.stringify(hrefs));

  await browser.close();
})().catch(e => console.log('Error:', e.message));