const axios = require('axios');
const cheerio = require('cheerio');

async function analyzeSite(url, name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ANALYSIS: ${name}`);
  console.log(`URL: ${url}`);
  try {
    const res = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 0,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
      validateStatus: s => s < 500
    });
    
    // Follow redirects manually
    let finalUrl = url;
    let html = res.data;
    let status = res.status;
    if (res.headers.location) {
      finalUrl = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).href;
      const r2 = await axios.get(finalUrl, { timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      html = r2.data;
      status = r2.status;
    }

    const $ = cheerio.load(html);
    
    // Extract DOI
    const doiMatch = html.match(/10\.\d{4,}\/[^\s"<>]+/);
    const doi = doiMatch ? doiMatch[0].replace(/[",)>\]]+$/, '') : null;
    
    // Extract title
    const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    
    // Check for OA
    const isOA = html.includes('open access') || html.includes('Open Access') || html.includes('OPEN ACCESS') ||
                 $('meta[name="citation_doi"]').length > 0 && $('meta[name="citation_open_access"]').attr('content') === 'true';
    
    // Check for PDF download
    const pdfLinks = $('a[href*=".pdf"]').map((i, el) => $(el).attr('href')).get();
    const pdfMeta = $('meta[content*=".pdf"]').map((i, el) => $(el).attr('content')).get();
    
    // Publisher info
    const publisher = $('meta[name="citation_publisher"]').attr('content') || '';
    
    // Open Access badge / free PDF
    const oaBadge = $('[class*="open-access"], [class*="OpenAccess"], [class*="oa"]').length;
    const freeTag = html.includes('Free article') || html.includes('Free access') || html.includes('Free PDF');
    
    console.log(`Status: ${status}`);
    console.log(`Final URL: ${finalUrl}`);
    console.log(`DOI: ${doi}`);
    console.log(`Title: ${title.substring(0, 100)}`);
    console.log(`Publisher: ${publisher}`);
    console.log(`Open Access: ${isOA || freeTag || oaBadge > 0 ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Free article tag: ${freeTag ? 'YES' : 'no'}`);
    console.log(`OA badge found: ${oaBadge}`);
    console.log(`PDF meta tags: ${pdfMeta.join(', ')}`);
    console.log(`PDF links: ${pdfLinks.slice(0, 3).join(', ') || 'none'}`);
    
    // For Springer/Nature - check Crossref for real OA status
    if (doi && (url.includes('springer') || url.includes('nature'))) {
      try {
        const cr = await axios.get('https://api.crossref.org/works/' + encodeURIComponent(doi), {
          timeout: 10000,
          headers: { 'User-Agent': 'ScholarLink/1.0' }
        });
        const item = cr.data.message;
        console.log(`\nCrossref says:`);
        console.log(`  Is OA: ${item['is-referenced-by-count'] !== undefined ? 'check links' : '?'}`);
        console.log(`  License: ${JSON.stringify(item.license?.map(l => l['URL']))}`);
        const pdfLink = item.link?.find(l => l['intended-application'] === 'text-mining');
        console.log(`  PDF link: ${pdfLink?.URL || 'none'}`);
        
        // Try Unpaywall
        try {
          const uw = await axios.get(`https://api.unpaywall.org/v2/${doi}?email=test@test.com`, { timeout: 10000 });
          const uwData = uw.data;
          console.log(`\nUnpaywall says:`);
          console.log(`  Is OA: ${uwData.is_oa}`);
          console.log(`  Best OA PDF: ${uwData.best_oa_location?.url_for_pdf || 'none'}`);
          console.log(`  Best OA location: ${uwData.best_oa_location?.url_for_pdf ? 'YES ✅' : 'NO ❌'}`);
        } catch (e) { console.log(`  Unpaywall: ${e.message}`); }
      } catch (e) { console.log(`Crossref: ${e.message}`); }
    }
    
    return { doi, title, html };
  } catch (e) {
    console.log(`Error: ${e.message}`);
    return null;
  }
}

async function analyzeSciNet() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`ANALYSIS: sci-net.xyz`);
  console.log(`URL: https://sci-net.xyz/`);
  
  try {
    const res = await axios.get('https://sci-net.xyz/', {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' }
    });
    const $ = cheerio.load(res.data);
    
    const title = $('title').text();
    const bodyText = $('body').text().trim().substring(0, 500);
    const forms = $('form').map((i, el) => ({
      action: $(el).attr('action'),
      method: $(el).attr('method'),
      inputs: $(el).find('input').map((j, inp) => ({ name: $(inp).attr('name'), type: $(inp).attr('type') })).get()
    })).get();
    
    console.log(`Status: ${res.status}`);
    console.log(`Title: ${title}`);
    console.log(`Body text: ${bodyText.substring(0, 300)}`);
    console.log(`Forms:`, JSON.stringify(forms, null, 2));
    
    // Check for terms of service / about
    const links = $('a[href]').map((i, el) => ({ href: $(el).attr('href'), text: $(el).text().trim() })).get();
    console.log(`Links:`, JSON.stringify(links, null, 2));
    
    // Try to search on sci-net with a DOI
    const testDoi = '10.1007/s13668-023-00492-x';
    console.log(`\nTrying DOI search: ${testDoi}`);
    
    // Try POST search (libgen-style)
    const searchRes = await axios.post('https://sci-net.xyz/', 
      `s=${encodeURIComponent(testDoi)}`,
      { 
        timeout: 20000,
        headers: { 
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://sci-net.xyz/'
        },
        maxRedirects: 3
      }
    ).catch(e => {
      if (e.response) return e.response;
      throw e;
    });
    
    console.log(`Search status: ${searchRes.status}`);
    const searchHtml = cheerio.load(searchRes.data);
    const searchLinks = searchHtml('a[href*=".pdf"], a[href*="/get/"], a[href*="download"]').map((i, el) => searchHtml(el).attr('href')).get();
    console.log(`PDF/download links after search: ${searchLinks.join(', ') || 'none'}`);
    console.log(`Search result title: ${searchHtml('title').text()}`);
    
    return { type: 'login_page', forms };
  } catch (e) {
    console.log(`Error: ${e.message}`);
    if (e.response) {
      console.log(`Status: ${e.response.status}`);
      console.log(`Response: ${String(e.response.data || '').substring(0, 300)}`);
    }
    return null;
  }
}

async function main() {
  await analyzeSciNet();
  await analyzeSite('https://link.springer.com/article/10.1007/s11306-025-02345-w', 'Springer Article');
  await analyzeSite('https://www.nature.com/articles/s41576-019-0205-4', 'Nature Article');
}

main().catch(e => console.error(e.message));
