// Test Unpaywall with configured email
const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });

const EMAIL = process.env.UNPAYWALL_EMAIL || 'wheeljah@gmail.com';
console.log('Using email:', EMAIL);

async function testUnpaywall(doi, label) {
  console.log(`\n--- ${label}: ${doi} ---`);
  try {
    const res = await axios.get(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}`,
      { timeout: 15000, params: { email: EMAIL } }
    );
    const d = res.data;
    console.log(`is_oa: ${d.is_oa}`);
    console.log(`best_oa_location.url_for_pdf: ${d.best_oa_location?.url_for_pdf || 'none'}`);
    console.log(`best_oa_location.url: ${d.best_oa_location?.url || 'none'}`);
    console.log(`title: ${(d.title || '').substring(0, 60)}`);

    if (d.is_oa && d.best_oa_location?.url_for_pdf) {
      const pdfUrl = d.best_oa_location.url_for_pdf;
      const head = await axios.head(pdfUrl, { timeout: 15000 });
      const ct = head.headers['content-type'];
      const cl = head.headers['content-length'];
      console.log(`PDF verify: ${head.status} ${ct} (${cl} bytes) ✅`);
      return pdfUrl;
    } else {
      console.log('No OA PDF found ❌');
      return null;
    }
  } catch (e) {
    if (e.response) {
      console.log(`API error: ${e.response.status} - ${JSON.stringify(e.response.data)}`);
    } else {
      console.log(`Error: ${e.message}`);
    }
    return null;
  }
}

async function main() {
  const testCases = [
    ['10.1038/nature12373', 'Nature (known OA via Harvard)'],
    ['10.1126/science.aaw2567', 'Science (recent OA)'],
    ['10.1016/j.cell.2020.03.045', 'Cell (COVID paper, was OA)'],
    ['10.1038/s41586-020-2649-x', 'Nature COVID paper (was OA)'],
    ['10.1007/s13668-023-00492-x', 'Springer Fucoxanthin (expected: not OA)'],
    ['10.1038/s41576-019-0205-4', 'Nature Reviews Genetics (likely paywalled)'],
  ];

  let found = 0;
  for (const [doi, label] of testCases) {
    const result = await testUnpaywall(doi, label);
    if (result) found++;
  }

  console.log(`\n\n=== Summary ===`);
  console.log(`Tested: ${testCases.length} DOIs`);
  console.log(`OA PDFs found: ${found}`);
}

main().catch(e => console.error(e.message));
