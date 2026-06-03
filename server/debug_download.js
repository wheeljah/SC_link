// 직접 PDF URL을 가져와서 다운로드 시도
require('dotenv').config();
const axios = require('axios');
const cloudscraper = require('cloudscraper');
const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = './uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function testPdfDownload() {
  console.log('🔍 PDF 다운로드 직접 테스트\n');

  // DOI 1: Sci-Hub.st가 PDF URL을 찾았음
  const doi1 = '10.1016/j.cellimm.2004.06.005';
  const scihubUrl = 'https://sci-hub.st';
  const pdfRelPath1 = '/storage/2024/1317/f94ccd8d46421595c7a5d287b79a177a/kioi2004.pdf';
  const fullPdfUrl1 = `${scihubUrl}${pdfRelPath1}`;

  console.log(`[1] DOI: ${doi1}`);
  console.log(`    PDF URL: ${fullPdfUrl1}`);
  
  // Test 1a: Direct axios HEAD check
  try {
    const head = await axios.head(fullPdfUrl1, { timeout: 15000, maxRedirects: 5 });
    console.log(`    HEAD: ${head.status} | Content-Type: ${head.headers['content-type']} | Size: ${head.headers['content-length']}`);
  } catch (e) {
    console.log(`    HEAD ERROR: ${e.message.substring(0, 120)}`);
  }
  
  // Test 1b: cloudscraper GET
  try {
    const res = await cloudscraper.get(fullPdfUrl1, { timeout: 15000 });
    console.log(`    cloudscraper GET: OK, ${res.length} bytes (type: ${typeof res})`);
    if (Buffer.isBuffer(res)) {
      console.log(`    Buffer size: ${res.length}`);
    }
  } catch (e) {
    console.log(`    cloudscraper GET ERROR: ${e.message.substring(0, 120)}`);
    if (e.response) console.log(`    Status: ${e.response.status}`);
  }

  // Test 1c: Full download
  try {
    const pdfRes = await axios.get(fullPdfUrl1, {
      responseType: 'stream',
      timeout: 60000,
      headers: { 'User-Agent': 'Mozilla/5.0 ScholarLink/1.0' },
    });
    const filename = `test_${Date.now()}_${doi1.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const filePath = path.join(UPLOAD_DIR, filename);
    const writer = fs.createWriteStream(filePath);
    pdfRes.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    const stat = fs.statSync(filePath);
    console.log(`    Full download: ${stat.size} bytes saved to ${filename}`);
    if (stat.size < 5000) {
      console.log(`    ⚠️ 파일이 너무 작음 (${stat.size} bytes) — 에러 페이지일 가능성`);
      fs.unlinkSync(filePath);
    } else {
      console.log(`    ✅ 유효한 PDF`);
    }
  } catch (e) {
    console.log(`    Full download ERROR: ${e.message.substring(0, 120)}`);
  }

  console.log('\n---\n');

  // DOI 2: 10.1007/s13668-023-00492-x — 모든 서버 실패
  const doi2 = '10.1007/s13668-023-00492-x';
  console.log(`[2] DOI: ${doi2}`);
  
  // Try Anna's Archive alternative domain
  const annasDomains = [
    'https://annas-archive.org',
    'https://annasarchive.org',
    'https://s央archive.org',
  ];
  
  // Try directly via archive.org
  console.log('    Testing archive.org directly...');
  try {
    const arRes = await axios.get(`https://archive.org/search?query=${encodeURIComponent(doi2)}`, { 
      timeout: 15000, 
      headers: { 'User-Agent': 'Mozilla/5.0 ScholarLink/1.0' }
    });
    console.log(`    archive.org search: ${arRes.status}`);
  } catch (e) {
    console.log(`    archive.org ERROR: ${e.message.substring(0, 100)}`);
  }

  // Try libgen with different URL format
  console.log('    Testing LibGen alternative...');
  try {
    const lgRes = await cloudscraper.get(`https://libgen.lc/json.php?req=${encodeURIComponent(doi2)}&columns=id,title,author,md5&limit=1`, { timeout: 15000 });
    console.log(`    LibGen JSON API: ${lgRes.substring(0, 200)}`);
  } catch (e) {
    console.log(`    LibGen JSON ERROR: ${e.message.substring(0, 100)}`);
  }

  // Try Sci-Hub with a fresh domain
  console.log('    Testing Sci-Hub.nu...');
  try {
    const shRes = await cloudscraper.get(`https://sci-hub.nu/10.1007/s13668-023-00492-x`, { timeout: 15000 });
    const cheerio = require('cheerio');
    const $ = cheerio.load(shRes);
    const pdfLink = $('a[href$=".pdf"]').first().attr('href') || $('iframe').attr('src');
    console.log(`    Sci-Hub.nu: status=OK | PDF=${pdfLink || 'none'}`);
  } catch (e) {
    console.log(`    Sci-Hub.nu ERROR: ${e.message.substring(0, 100)}`);
  }

  console.log('\n✅ 테스트 완료');
}

testPdfDownload().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
