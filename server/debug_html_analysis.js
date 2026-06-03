// cloudscraper HTML 분석 - PDF URL 없음 원인 파악
const cloudscraper = require('cloudscraper');
const cheerio = require('cheerio');

const doi = '10.1007/s13668-023-00492-x';
const servers = [
  { name: 'sci-hub.sh', url: 'https://sci-hub.sh' },
  { name: 'sci-hub.wf', url: 'https://sci-hub.wf' },
  { name: 'sci-hub.ren', url: 'https://sci-hub.ren' },
];

async function analyze(html, serverName) {
  console.log(`\n=== ${serverName} HTML Analysis ===`);
  const $ = cheerio.load(html);

  console.log(`Title: "${$('title').text()}"`);
  console.log(`HTML length: ${html.length}`);

  // Check for Cloudflare
  if (html.includes('Cloudflare') || html.includes('Just a moment')) {
    console.log('⚠️ Cloudflare protection detected!');
    return;
  }

  // Show key sections
  const h1 = $('h1').text().trim();
  const h2 = $('h2').map((i, el) => $(el).text().trim()).get().slice(0, 3);
  const bodyText = $('body').text().trim().substring(0, 500);
  console.log('H1:', h1);
  console.log('H2s:', h2);
  console.log('Body preview:', bodyText.substring(0, 300));

  // Check for specific Sci-Hub elements
  const forms = $('form').map((i, el) => ({
    action: $(el).attr('action'),
    method: $(el).attr('method'),
    id: $(el).attr('id'),
    inputs: $(el).find('input').map((j, inp) => ({ name: $(inp).attr('name'), value: $(inp).attr('value') || '' })).get()
  })).get();
  console.log('\nForms:', JSON.stringify(forms, null, 2));

  // Check iframes
  const iframes = $('iframe').map((i, el) => ({
    src: $(el).attr('src') || '',
    id: $(el).attr('id'),
    style: $(el).attr('style') || ''
  })).get();
  console.log('Iframes:', JSON.stringify(iframes));

  // Check embeds
  const embeds = $('embed').map((i, el) => ({ src: $(el).attr('src'), type: $(el).attr('type') })).get();
  console.log('Embeds:', JSON.stringify(embeds));

  // Check for any element with onclick containing PDF
  const pdfOnclick = $('[onclick*="pdf"], [onclick*="download"], [onclick*="pdf"]').map((i, el) => ({
    tag: el.tagName,
    onclick: $(el).attr('onclick')?.substring(0, 300)
  })).get();
  console.log('Elements with PDF onclick:', JSON.stringify(pdfOnclick));

  // Check for hidden inputs or special divs
  const hidden = $('input[type="hidden"]').map((i, el) => ({ name: $(el).attr('name'), value: $(el).attr('value')?.substring(0, 100) })).get();
  console.log('Hidden inputs:', JSON.stringify(hidden));

  // Check divs for sci-hub-specific classes
  const sciHubDivs = $('[class*="download"], [class*="pdf"], [id*="download"], [id*="pdf"], [id*="viewer"]').map((i, el) => ({
    tag: el.tagName,
    id: $(el).attr('id'),
    class: $(el).attr('class'),
    text: $(el).text().trim().substring(0, 100)
  })).get();
  console.log('Sci-Hub divs:', JSON.stringify(sciHubDivs));

  // Check for any external script that loads PDF
  const scripts = $('script').map((i, el) => {
    const src = $(el).attr('src') || '';
    const text = $(el).text().substring(0, 500);
    return { src, text: text.substring(0, 200) };
  }).get();
  console.log('\nScripts (inline):', scripts.filter(s => !s.src).map(s => s.text).join('\n'));
  console.log('Scripts (external):', scripts.filter(s => s.src).map(s => s.src).join(', '));

  // Show all links
  const allLinks = $('a[href]').map((i, el) => ({ href: $(el).attr('href'), text: $(el).text().trim().substring(0, 80) })).get();
  const downloadLinks = allLinks.filter(l => l.href && (l.href.includes('download') || l.href.includes('.pdf') || l.href.includes('get')));
  console.log('\nDownload links:', JSON.stringify(downloadLinks));
  console.log('Total links:', allLinks.length);
}

async function main() {
  for (const server of servers) {
    try {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Testing ${server.name}...`);
      const html = await cloudscraper.get(`${server.url}/${doi}`);
      await analyze(html, server.name);
    } catch (e) {
      console.log(`Error on ${server.name}:`, e.message);
      if (e.response) {
        console.log('Status:', e.response.status);
        console.log('Body preview:', String(e.response.body || '').substring(0, 200));
      }
    }
  }
}

main().catch(e => console.error(e.message));
