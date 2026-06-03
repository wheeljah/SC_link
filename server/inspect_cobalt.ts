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
  
  await page.goto('https://cobalt.colab.ws/?term=10.1038%2Fs41576-019-0205-4', {waitUntil:'networkidle2', timeout:30000});
  await new Promise(r => setTimeout(r, 2000));
  
  // Get search results info
  const searchInfo = await page.evaluate(() => {
    // Get the article list items
    const items = Array.from(document.querySelectorAll('[class*="publications"], [class*="publication"], .publication-item')).map(el => ({
      title: el.querySelector('[class*="title"]')?.innerText?.trim() || el.innerText?.trim()?.substring(0, 100),
    }));
    
    // Get form structure
    const form = document.querySelector('form[role="search"], form[action*="search"], form');
    const inputs = form ? Array.from(form.querySelectorAll('input')).map(i => ({
      name: i.name, type: i.type, value: i.value, placeholder: i.placeholder
    })) : [];
    
    // Get current URL
    const url = window.location.href;
    
    // Look for citation counts
    const bodyText = document.body.innerText;
    const citationMatches = bodyText.match(/[\d.]+[kм]\s*(?:citations?|цитат)/gi);
    
    // Find the specific result for this DOI
    const doiResults = Array.from(document.querySelectorAll('*')).filter(el => 
      el.innerText && el.innerText.includes('10.1038/s41576-019-0205-4')
    ).map(el => el.innerText.substring(0, 200));
    
    return { items: items.length, inputs, url, citationMatches, doiResults };
  });
  
  console.log('Search info:', JSON.stringify(searchInfo, null, 2));
  
  // Try clicking on the result to get more details
  const resultClick = await page.evaluate(() => {
    // Find the first result item with title
    const result = document.querySelector('[class*="publication"], .result-item, article');
    if (result) {
      // Get all text content
      return result.innerText.substring(0, 500);
    }
    return null;
  });
  console.log('\nFirst result:', resultClick);
  
  await browser.close();
})().catch(e => console.log('Error:', e.message));