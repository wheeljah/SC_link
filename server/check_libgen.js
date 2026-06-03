const axios = require('axios');
const cheerio = require('cheerio');

const doi = '10.1007/s13668-023-00492-x';
const url = 'https://libgen.li/?s=' + encodeURIComponent(doi);

axios.get(url, { timeout: 15000 }).then(r => {
  const html = r.data;
  const $ = cheerio.load(html);

  const rows = $('table.catalog tr').length;
  const links = $('a').map((i, el) => $(el).attr('href')).get();
  const pdfLinks = links.filter(l => l && l.includes('.pdf'));
  const getLinks = links.filter(l => l && l.includes('/get'));
  const text = $('body').text();
  const hasTitle = text.includes('Fucoxanthin') || text.includes('fucoxanthin');

  console.log('Table rows:', rows);
  console.log('Total links:', links.length);
  console.log('PDF links:', pdfLinks.length);
  console.log('/get/ links:', getLinks.length);
  console.log('Fucoxanthin found:', hasTitle);

  if (rows > 1) {
    $('table.catalog tr').slice(0, 3).each((i, row) => {
      const tds = $(row).find('td').map((j, td) => $(td).text().trim().substring(0, 40)).get();
      if (tds.length > 0) console.log('Row:', tds.join(' | '));
    });
  }

  if (html.includes('Cloudflare') || html.includes('Just a moment')) {
    console.log('Cloudflare protection!');
  }
  if (html.includes('captcha') || html.includes('CAPTCHA')) {
    console.log('CAPTCHA detected!');
  }

  // Try scraping the search results more carefully
  const h2s = $('h2, h3').map((i, el) => $(el).text().trim()).get();
  console.log('Headings:', h2s);

}).catch(e => console.log('Error:', e.message));
