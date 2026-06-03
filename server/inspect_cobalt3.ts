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

  // Search
  await page.goto('https://cobalt.colab.ws/?term=10.1038%2Fs41576-019-0205-4', {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 3000));

  // Get the HTML structure of the first result
  const resultHtml = await page.evaluate(() => {
    // Find all elements with click handlers or data attributes
    const allElements = Array.from(document.querySelectorAll('[class*="item"], [class*="card"], [class*="result"], .publications-list > *'));
    const info = allElements.map(el => ({
      tag: el.tagName,
      class: el.className,
      onclick: el.getAttribute('onclick'),
      dataRoute: el.getAttribute('data-route'),
      role: el.getAttribute('role'),
      'v-if': el.getAttribute('v-if'),
      text: el.innerText?.trim()?.substring(0, 80),
    })).filter(e => e.text && e.text.length > 10).slice(0, 5);
    return info;
  });
  console.log('Result elements:', JSON.stringify(resultHtml, null, 2));

  // Try clicking by text content
  const resultItem = await page.evaluate(() => {
    // Find element containing the article title
    const el = Array.from(document.querySelectorAll('*')).find(e => 
      e.innerText?.includes('Engineering adeno-associated virus vectors for gene therapy')
    );
    if (!el) return 'Not found';
    
    // Walk up to find clickable parent
    let parent = el;
    for (let i = 0; i < 5; i++) {
      if (parent.parentElement) {
        parent = parent.parentElement;
        if (parent.onclick || parent.getAttribute('href') !== '#') {
          return { tag: parent.tagName, class: parent.className, href: parent.getAttribute('href'), onclick: parent.getAttribute('onclick') };
        }
      }
    }
    return { found: el.tagName, text: el.innerText.substring(0,100) };
  });
  console.log('\nResult item:', JSON.stringify(resultItem));

  // Get the actual href or route
  const routeInfo = await page.evaluate(() => {
    // Check Vue router or JS navigation
    const vueApp = window.__VUE__ || window.Vue;
    const router = window.__ROUTER__;
    
    // Look for publication route patterns
    const hrefs = Array.from(document.querySelectorAll('a[href]')).map(a => a.href).filter(h => !h.includes('#') && h.includes('cobalt'));
    return { vueApp: !!vueApp, router: !!router, nonHashHrefs: hrefs };
  });
  console.log('\nRoute info:', JSON.stringify(routeInfo));

  // Get detailed data for the first result
  const detailData = await page.evaluate(() => {
    const body = document.body.innerText;
    // Look for citation numbers, SCImago, SJR
    const citationPattern = /(\d[\d.,]*[kK]?)\s*(?:citations?|цитат|cite)/i;
    const scimagoPattern = /SJR[:\s]*([A-Z]\d)/i;
    constsjrValue = /SJR\s+([\d.]+)/i;
    const quartilePattern = /Q[1-4]/i;
    
    return {
      citations: body.match(/\d+[\d.,]*\s*(?:citations?|цитат)/gi)?.slice(0, 5),
      scimago: body.match(/SCIMAGO[^\n]*/i)?.[0],
      sqr: body.match(/SJR[^\n]*/i)?.[0],
      quartiles: body.match(/\bQ[1-4]\b/g),
      impactFactor: body.match(/IF[^0-9]*([0-9.]+)/i)?.[0],
    };
  });
  console.log('\nDetail data:', JSON.stringify(detailData));

  await browser.close();
})().catch(e => console.log('Error:', e.message));