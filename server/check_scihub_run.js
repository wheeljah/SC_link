const axios = require('axios');
const cheerio = require('cheerio');

async function checkDomain(url, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Checking: ${label} (${url})`);
  
  try {
    // Main page
    const res = await axios.get(url, { 
      timeout: 20000, 
      maxRedirects: 3, 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' } 
    });
    const $ = cheerio.load(res.data);
    console.log('Status:', res.status, '| Length:', res.data.length);
    console.log('Title:', $('title').text().trim());
    console.log('Cloudflare:', res.data.includes('Cloudflare') || res.data.includes('Just a moment') ? 'YES ⚠️' : 'NO ✅');
    console.log('DDoS-Guard:', res.data.includes('DDoS-Guard') ? 'YES ⚠️' : 'NO ✅');
    
    const forms = [];
    $('form').each((i, el) => {
      forms.push({
        action: $(el).attr('action'),
        method: $(el).attr('method'),
        inputs: $(el).find('input').map((j, inp) => $(inp).attr('name')).get()
      });
    });
    console.log('Forms:', JSON.stringify(forms));
    
    // Try DOI directly
    const doi = '10.1007/s13668-023-00492-x';
    console.log(`\n--- Testing DOI: ${doi} ---`);
    
    const r2 = await axios.get(url + '/' + doi, { 
      timeout: 20000, 
      maxRedirects: 3,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' }
    });
    const $2 = cheerio.load(r2.data);
    console.log('DOI page status:', r2.status, '| Length:', r2.data.length);
    console.log('DOI page title:', $2('title').text().trim().substring(0, 100));
    console.log('Cloudflare:', r2.data.includes('Cloudflare') || r2.data.includes('Just a moment') ? 'YES ⚠️' : 'NO ✅');
    console.log('DDoS-Guard:', r2.data.includes('DDoS-Guard') ? 'YES ⚠️' : 'NO ✅');
    
    const hasLoginPage = r2.data.includes('Log in to access') || r2.data.includes('Login to access');
    console.log('"Login required" page:', hasLoginPage ? 'YES ⚠️' : 'NO ✅');
    
    const hasPdf = $2('a[href*=".pdf"]').length > 0 || $2('embed[src*=".pdf"]').length > 0 || $2('iframe[src*=".pdf"]').length > 0;
    console.log('Has PDF elements:', hasPdf ? 'YES ✅' : 'NO ❌');
    
    const pdfLinks = $2('a[href*=".pdf"]').map((i, el) => $2(el).attr('href')).get();
    const embedSrcs = $2('embed[src]').map((i, el) => $2(el).attr('src')).get();
    const iframeSrcs = $2('iframe[src]').map((i, el) => $2(el).attr('src')).get();
    if (pdfLinks.length) console.log('PDF links:', pdfLinks.slice(0, 3));
    if (embedSrcs.length) console.log('Embed srcs:', embedSrcs.slice(0, 3));
    if (iframeSrcs.length) console.log('Iframe srcs:', iframeSrcs.slice(0, 3));
    
    // Test cloudscraper too
    const cloudscraper = require('cloudscraper');
    console.log('\n--- Testing with cloudscraper ---');
    try {
      const csHtml = await cloudscraper.get(url + '/' + doi);
      const $cs = cheerio.load(csHtml);
      console.log('cloudscraper status: OK | length:', csHtml.length);
      console.log('cloudscraper title:', $cs('title').text().trim().substring(0, 100));
      const csPdfLinks = $cs('a[href*=".pdf"]').map((i, el) => $cs(el).attr('href')).get();
      const csEmbeds = $cs('embed[src]').map((i, el) => $cs(el).attr('src')).get();
      const csIframes = $cs('iframe[src]').map((i, el) => $cs(el).attr('src')).get();
      console.log('PDF links:', csPdfLinks.slice(0, 3));
      console.log('Embeds:', csEmbeds.slice(0, 3));
      console.log('Iframes:', csIframes.slice(0, 3));
      console.log('Login required:', csHtml.includes('Log in to access') ? 'YES ⚠️' : 'NO ✅');
    } catch (e) {
      console.log('cloudscraper error:', e.message.substring(0, 200));
    }
    
  } catch (e) {
    console.log('Error:', e.message);
    if (e.response) {
      console.log('Status:', e.response.status);
      console.log('Headers:', JSON.stringify(e.response.headers));
    }
  }
}

async function main() {
  await checkDomain('https://sci-hub.run', 'sci-hub.run (root)');
  await checkDomain('https://sci-hub.run/es', 'sci-hub.run/es (Spanish)');
}

main().catch(e => console.error(e.message));
