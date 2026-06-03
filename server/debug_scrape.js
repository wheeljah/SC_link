// downloadService의 각 단계를 직접 테스트해서 어디서 실패하는지 파악
require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const cloudscraper = require('cloudscraper');
const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scholarlink';
const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 10000 });

const dois = [
  '10.1016/j.cellimm.2004.06.005',
  '10.1007/s13668-023-00492-x'
];

async function getActiveServers() {
  const { rows } = await pool.query(
    `SELECT id, name, url, type, status, avg_latency
     FROM download_servers
     WHERE is_active = true AND status IN ('ONLINE','SLOW')
     ORDER BY avg_latency ASC LIMIT 10`
  );
  return rows;
}

async function testServer(server, doi) {
  console.log(`\n--- [${server.name}] ${server.url}/${doi} ---`);
  
  try {
    if (server.type === 'scihub') {
      // Test 1: cloudscraper (fast path)
      const pageUrl = `${server.url}/${doi}`;
      console.log(`  Step 1: cloudscraper.get(${pageUrl})`);
      try {
        const pageHtml = await cloudscraper.get(pageUrl, { timeout: 15000 });
        console.log(`  ✅ Got HTML (${pageHtml.length} chars)`);
        
        // Parse for PDF
        const $ = cheerio.load(pageHtml);
        
        const embed = $('embed[type="application/pdf"]').attr('src') ||
                      $('iframe').filter('[src*="pdf"], [src*="viewer"]').attr('src');
        if (embed) { console.log(`  ✅ Found embed: ${embed}`); return 'FOUND_EMBED'; }
        
        const pdfHref = $('a[href$=".pdf"]').first().attr('href') ||
                        $('a[href*=".pdf?"]').first().attr('href');
        if (pdfHref) { console.log(`  ✅ Found PDF link: ${pdfHref}`); return 'FOUND_PDF_HREF'; }
        
        const dataPdf = $('[data-pdf], [data-src*="pdf"], [data-url*="pdf"]').first()
          .attr('data-pdf') || $('[data-pdf], [data-src*="pdf"], [data-url*="pdf"]').first().attr('data-src') ||
          $('[data-pdf], [data-src*="pdf"], [data-url*="pdf"]').first().attr('data-url');
        if (dataPdf) { console.log(`  ✅ Found data-pdf: ${dataPdf}`); return 'FOUND_DATA_PDF'; }

        // Check for download button
        const downloadBtn = $('a:contains("Download"), a:contains("download"), button:contains("Download")').first();
        if (downloadBtn.length > 0) {
          console.log(`  ✅ Found download button: ${downloadBtn.text().trim()}`);
          const onclick = downloadBtn.attr('onclick') || '';
          const match = onclick.match(/['"]([^'"]*\.pdf[^'"]*)['"]/) || onclick.match(/src[:=]\s*['"]([^'"]+)['"]/);
          if (match) { console.log(`  ✅ onclick PDF: ${match[1]}`); return 'FOUND_ONCLICK'; }
        }

        // Check page title to see if we got a captcha or error
        const title = $('title').text();
        console.log(`  📄 Page title: "${title}"`);
        if (title.toLowerCase().includes('captcha') || title.toLowerCase().includes('cloudflare')) {
          return 'CLOUDFLARE_BLOCK';
        }
        if (pageHtml.includes('captcha') || pageHtml.includes('Cloudflare')) {
          return 'CLOUDFLARE_BLOCK';
        }
        
        console.log(`  ❌ No PDF found in page`);
        return 'NOT_FOUND';
      } catch (e) {
        console.log(`  ❌ cloudscraper error: ${e.message.substring(0, 100)}`);
        if (e.message.includes('403') || e.message.includes('blocked') || e.response?.status === 403) {
          return 'CLOUDFLARE_BLOCK';
        }
        return 'ERROR';
      }
    }
    
    if (server.type === 'libgen') {
      let searchUrl;
      if (server.url.includes('scimag')) {
        searchUrl = `${server.url}?req=${encodeURIComponent(doi)}&lg_topic=libgen&open=0&view=simple&res=25&phrase=1&column=def`;
      } else {
        searchUrl = `${server.url}?s=${encodeURIComponent(doi)}`;
      }
      console.log(`  Step 1: cloudscraper.get(${searchUrl})`);
      try {
        const res = await cloudscraper.get(searchUrl, { timeout: 15000 });
        const $ = cheerio.load(res);
        const pdfLink = $('a[href*=".pdf"]').first().attr('href') ||
                        $('a[href*="/get"]').first().attr('href');
        if (pdfLink) {
          console.log(`  ✅ Found libgen link: ${pdfLink}`);
          return 'FOUND_LINK';
        }
        console.log(`  ❌ No PDF link found`);
        return 'NOT_FOUND';
      } catch (e) {
        console.log(`  ❌ Error: ${e.message.substring(0, 100)}`);
        return 'ERROR';
      }
    }
    
    if (server.type === 'archive') {
      console.log(`  Step 1: Searching Anna's Archive...`);
      const searchUrl = `https://annas-archive.org/search?q=${encodeURIComponent(doi)}&content_type=pdf`;
      try {
        const pageHtml = await cloudscraper.get(searchUrl, { timeout: 15000 });
        const $ = cheerio.load(pageHtml);
        const firstResult = $('a[href*="/md5/"]').first().attr('href');
        if (firstResult) {
          console.log(`  ✅ Found Anna's result: ${firstResult}`);
          const md5Html = await cloudscraper.get(`https://annas-archive.org${firstResult}`, { timeout: 15000 });
          const $$ = cheerio.load(md5Html);
          const dlLink = $$('a[href*="/download/"]').first().attr('href') ||
                         $$('a[href*=".pdf"]').first().attr('href');
          if (dlLink) {
            console.log(`  ✅ Found download link: ${dlLink}`);
            return 'FOUND_LINK';
          }
        }
        console.log(`  ❌ No Anna's Archive result`);
        return 'NOT_FOUND';
      } catch (e) {
        console.log(`  ❌ Error: ${e.message.substring(0, 100)}`);
        return 'ERROR';
      }
    }

    return 'UNKNOWN_TYPE';
  } catch (e) {
    console.log(`  ❌ Unexpected error: ${e.message}`);
    return 'ERROR';
  }
}

async function main() {
  try {
    const servers = await getActiveServers();
    console.log(`\n📡 활성 서버 (${servers.length}개):`);
    servers.forEach(s => console.log(`  - [${s.id}] ${s.name} (${s.type}) ${s.url}`));

    for (const doi of dois) {
      console.log(`\n\n${'#'.repeat(70)}`);
      console.log(`# DOI: ${doi}`);
      console.log(`${'#'.repeat(70)}`);
      
      let allFailed = true;
      for (const server of servers) {
        const result = await testServer(server, doi);
        if (result === 'FOUND_EMBED' || result === 'FOUND_PDF_HREF' || 
            result === 'FOUND_DATA_PDF' || result === 'FOUND_ONCLICK' ||
            result === 'FOUND_LINK') {
          console.log(`  🎉 PDF URL 발견! 다운로드 가능!`);
          allFailed = false;
          break;
        }
        if (result === 'CLOUDFLARE_BLOCK') {
          console.log(`  🔒 Cloudflare 차단됨`);
        }
      }
      
      if (allFailed) {
        console.log(`\n  ❌ 모든 서버에서 PDF를 찾지 못함`);
      }
    }

    await pool.end();
  } catch (e) {
    console.error('Fatal:', e.message);
    await pool.end();
    process.exit(1);
  }
}

main();
