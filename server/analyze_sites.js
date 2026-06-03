const axios = require('axios');

async function check(url, name) {
  console.log(`\n=== ${name} ===`);
  console.log(`URL: ${url}`);
  try {
    const res = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' }
    });
    console.log(`Status: ${res.status}`);
    console.log(`Content-Type: ${res.headers['content-type']}`);
    console.log(`Final URL: ${res.request?.res?.responseUrl || url}`);
    console.log(`HTML length: ${res.data.length}`);
    console.log(`Title: ${(res.data.match(/<title[^>]*>([^<]+)<\/title>/i) || ['', ''])[1]}`);
    
    // Check for key indicators
    const text = res.data;
    const checks = [
      ['Cloudflare', text.includes('Cloudflare') || text.includes('Just a moment')],
      ['PDF link', text.includes('.pdf') || text.includes('pdf')],
      ['Login/Register', text.includes('login') || text.includes('sign in') || text.includes('register')],
      ['Download', text.includes('download') || text.includes('Download')],
      ['Paywall', text.includes('paywall') || text.includes('subscription')],
      ['Open Access', text.includes('open access') || text.includes('Open Access')],
    ];
    console.log('\nChecks:');
    checks.forEach(([label, result]) => console.log(`  ${result ? '✅' : '❌'} ${label}`));
    
    return { url, status: res.status, html: res.data };
  } catch (e) {
    if (e.response) {
      console.log(`Status: ${e.response.status}`);
      console.log(`Headers:`, JSON.stringify(e.response.headers, null, 2));
    } else {
      console.log(`Error: ${e.message}`);
    }
    return null;
  }
}

async function main() {
  const sites = [
    ['https://sci-net.xyz/', 'sci-net.xyz'],
    ['https://link.springer.com/article/10.1007/s11306-025-02345-w', 'Springer Article (DOI lookup)'],
    ['https://www.nature.com/articles/s41576-019-0205-4', 'Nature Article'],
  ];
  
  for (const [url, name] of sites) {
    await check(url, name);
  }
  
  // Also check if sci-net has an API or special endpoints
  console.log('\n\n=== sci-net.xyz deeper analysis ===');
  const r = await check('https://sci-net.xyz/', 'sci-net.xyz main page');
  if (r) {
    const $ = require('cheerio').load(r.html);
    const links = $('a[href]').map((i, el) => $(el).attr('href')).get().filter(h => h && !h.startsWith('#') && !h.startsWith('javascript'));
    const uniqueDomains = [...new Set(links.map(l => {
      try { return new URL(l).hostname; } catch { return 'relative'; }
    }))];
    console.log('\nExternal domains found:', uniqueDomains);
    console.log('All links:', links.slice(0, 20));
    
    // Check if there's a search form
    const forms = $('form').map((i, el) => ({
      action: $(el).attr('action'),
      method: $(el).attr('method'),
      inputs: $(el).find('input').map((j, inp) => $(inp).attr('name')).get()
    })).get();
    console.log('\nForms:', JSON.stringify(forms, null, 2));
  }
}

main().catch(e => console.error(e.message));
