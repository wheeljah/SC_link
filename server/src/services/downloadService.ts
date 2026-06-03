import axios from 'axios';
import * as cheerio from 'cheerio';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cloudscraper = require('cloudscraper') as {
  get: (opts: string | { url: string }) => Promise<string>;
};
import fs from 'fs';
import path from 'path';
import { pool } from '../db/pool';
import { getAvailableServers, pickServer, ServerInfo } from './loadBalancerService';
import { decrypt } from './encryptionService';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

interface DownloadResult {
  filePath: string;
  fileSize: number;
  title?: string;
  authors?: string;
  journal?: string;
  year?: number;
}

// ─── Browser (Puppeteer) ──────────────────────────────────────────────────────
let browserPromise: ReturnType<typeof import('puppeteer').default.launch> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    const puppeteer = await import('puppeteer');
    browserPromise = puppeteer.default.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--mute-audio',
      ],
    });
  }
  return browserPromise;
}

// ─── File download helper ────────────────────────────────────────────────────

/** Verify PDF URL is accessible (HEAD check) before attempting full download */
async function checkPdfAccessible(pdfUrl: string): Promise<boolean> {
  try {
    const head = await axios.head(pdfUrl, { timeout: 15000, maxRedirects: 5 });
    const ct = String(head.headers['content-type'] || '');
    const size = head.headers['content-length'];
    // Accept if content-type is pdf OR if we got a non-403 status with a size
    return (ct.includes('pdf') || !!size) && head.status === 200;
  } catch (e) {
    if (axios.isAxiosError(e) && (e.response?.status === 403 || e.response?.status === 401)) {
      return false; // Explicitly blocked — don't waste time downloading
    }
    // DNS error, timeout etc. — try anyway (might work via browser)
    return true;
  }
}

async function downloadFileFromUrl(pdfUrl: string, doi: string, prefix = ''): Promise<DownloadResult | null> {
  try {
    // Quick HEAD check first — reject 403s early
    const accessible = await checkPdfAccessible(pdfUrl);
    if (!accessible) {
      console.log(`[download] PDF URL not accessible (403/blocked): ${pdfUrl}`);
      return null;
    }

    const pdfRes = await axios.get(pdfUrl, {
      responseType: 'stream',
      timeout: 60000,
      headers: { 'User-Agent': 'Mozilla/5.0 ScholarLink/1.0' },
    });

    const filename = `${prefix}${Date.now()}_${doi.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const filePath = path.join(UPLOAD_DIR, filename);
    const writer = fs.createWriteStream(filePath);

    await new Promise<void>((resolve, reject) => {
      pdfRes.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    const stat = fs.statSync(filePath);
    if (stat.size < 5000) {
      // Probably an error page — discard
      fs.unlinkSync(filePath);
      return null;
    }
    return { filePath: `/uploads/${filename}`, fileSize: stat.size };
  } catch (e) {
    if (axios.isAxiosError(e)) {
      console.log(`[download] Failed to download PDF: ${e.response?.status} ${pdfUrl}`);
    }
    return null;
  }
}

// ─── Credentials (Z-Library) ─────────────────────────────────────────────────
async function getUserCredential(userId: number, serverId: number): Promise<{ loginId: string; password: string } | null> {
  const { rows } = await pool.query(
    `SELECT login_id, password_enc, enc_iv FROM user_server_credentials WHERE user_id=$1 AND server_id=$2`,
    [userId, serverId]
  );
  if (!rows[0]) return null;
  try {
    const [ivHex, tagHex] = rows[0].enc_iv.split(':');
    const password = decrypt(rows[0].password_enc, ivHex, tagHex);
    return { loginId: rows[0].login_id, password };
  } catch {
    return null;
  }
}

// ─── Sci-Hub.run (FastAPI backend) ───────────────────────────────────────────
/** Special API-based Sci-Hub.run that uses a FastAPI backend at fast.wbleb.com */
async function downloadFromSciHubRun(doi: string, server: ServerInfo): Promise<DownloadResult | null> {
  console.log(`[scihub.run] Called for DOI=${doi}`);
  const API_BASE = 'https://fast.wbleb.com';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://sci-hub.run',
    'Referer': 'https://sci-hub.run/',
    'Content-Type': 'application/json',
    'sec-fetch-site': 'cross-site',
    'sec-fetch-mode': 'cors',
  };

  try {
    // Step 1: Query the API
    const apiRes = await axios.get(`${API_BASE}/api/v1/paper/${encodeURIComponent(doi)}`, {
      timeout: 8000,
      headers,
    });

    const data = apiRes.data;

    if (!data.success) {
      // Paper not in database
      return null;
    }

    // Step 2: Construct PDF URL
    // The backend returns either an absolute URL or a relative path like "/papers/xxx.pdf"
    const pdfPath: string = data.url;
    const pdfUrl = pdfPath.startsWith('http')
      ? pdfPath
      : `${API_BASE}${pdfPath}`;

    // Step 3: Download the PDF
    const result = await downloadFileFromUrl(pdfUrl, doi, 'shr_');

    if (result) {
      console.log(`[scihub.run] Downloaded: ${doi} → ${pdfPath} (cached=${data.cached})`);
      return result;
    }

    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response?.status === 404) {
        // Paper not found in database — try next server
        console.log(`[scihub.run] Paper not found: ${doi}`);
        return null;
      }
      console.log(`[scihub.run] API error: ${e.response?.status} ${e.message}`);
    } else {
      console.log(`[scihub.run] Error: ${(e as Error).message}`);
    }
    return null;
  }
}

// ─── Sci-Hub (cloudscraper → cheerio) ───────────────────────────────────────

/** Error thrown when cloudscraper hits a protection page (DDoS-Guard / Cloudflare) */
class ScrapeBlockedError extends Error {
  constructor(message: string) { super(message); this.name = 'ScrapeBlockedError'; }
}

/** Error thrown when the Sci-Hub page shows "login required" — paper not in Sci-Hub DB */
class SciHubNotAvailableError extends Error {
  constructor(message: string) { super(message); this.name = 'SciHubNotAvailableError'; }
}

async function scrapeSciHubPage(doi: string, server: ServerInfo): Promise<string | null> {
  try {
    const pageUrl = `${server.url}/${doi}`;
    const pageHtml = await cloudscraper.get(pageUrl) as string;

    // Detect DDoS-Guard / Cloudflare protection pages
    if (
      pageHtml.includes('DDoS-Guard') ||
      pageHtml.includes('Cloudflare') ||
      pageHtml.includes('Just a moment') ||
      pageHtml.length < 100
    ) {
      throw new ScrapeBlockedError(`Protection page from ${server.name}: ${pageUrl}`);
    }

    // Detect "login required / not available" pages — paper is not in Sci-Hub DB
    // These pages show article metadata but no PDF download link
    const notAvailablePatterns = [
      'Log in to access this article',
      'The article reader is available to registered users',
      'Login to access',
      'not found in Sci-Hub',
      'Article not found',
    ];
    for (const pattern of notAvailablePatterns) {
      if (pageHtml.includes(pattern)) {
        throw new SciHubNotAvailableError(`Paper not available on Sci-Hub (${server.name}): ${pattern}`);
      }
    }

    const $ = cheerio.load(pageHtml);

    // Try embedded PDF viewer
    const embedSrc = $('embed[type="application/pdf"]').attr('src') ||
                     $('iframe').filter('[src*="pdf"], [src*="viewer"]').attr('src');
    if (embedSrc) return embedSrc.startsWith('http') ? embedSrc : `${server.url}${embedSrc}`;

    // Try direct PDF links
    const pdfHref = $('a[href$=".pdf"]').first().attr('href') ||
                    $('a[href*=".pdf?"]').first().attr('href') ||
                    $('button[onclick*=".pdf"]').first().attr('onclick')?.match(/['"]([^'"]*\.pdf[^'"]*)['"]/)?.[1];
    if (pdfHref) return pdfHref.startsWith('http') ? pdfHref : `${server.url}${pdfHref}`;

    // Try data-* attributes holding PDF URLs
    const dataPdf = $('[data-pdf], [data-src*="pdf"], [data-url*="pdf"]').first()
      .attr('data-pdf') || $('[data-pdf], [data-src*="pdf"], [data-url*="pdf"]').first().attr('data-src') ||
      $('[data-pdf], [data-src*="pdf"], [data-url*="pdf"]').first().attr('data-url');
    if (dataPdf) return dataPdf.startsWith('http') ? dataPdf : `${server.url}${dataPdf}`;

    // Try clicking download buttons via text
    const downloadBtn = $('a:contains("Download"), a:contains("download"), button:contains("Download")').first();
    if (downloadBtn.length > 0) {
      const onclick = downloadBtn.attr('onclick') || '';
      const match = onclick.match(/['"]([^'"]*\.pdf[^'"]*)['"]/) || onclick.match(/src[:=]\s*['"]([^'"]+)['"]/);
      if (match) return match[1].startsWith('http') ? match[1] : `${server.url}${match[1]}`;
    }

    return null;
  } catch (e) {
    // Re-throw protection errors so the caller can retry with Puppeteer
    if (e instanceof ScrapeBlockedError) throw e;
    if (e instanceof SciHubNotAvailableError) throw e;
    return null;
  }
}

// ─── Sci-Hub (Puppeteer — Cloudflare / dynamic JS) ──────────────────────────
async function scrapeSciHubWithBrowser(doi: string, server: ServerInfo): Promise<string | null> {
  console.log(`[puppeteer] Scraping ${doi} via ${server.name}...`);
  let browser;
  try {
    browser = await getBrowser();
    console.log(`[puppeteer] Browser OK`);
  } catch(e: any) {
    console.log(`[puppeteer] Browser launch failed: ${e.message}`);
    throw e; // propagate so downloadFromSciHub can try next server
  }
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const pageUrl = `${server.url}/${doi}`;
    console.log(`[puppeteer] Navigating to ${pageUrl}...`);
    try {
      await page.goto(pageUrl, { waitUntil: 'load', timeout: 20000 });
    } catch(e: any) {
      console.log(`[puppeteer] page.goto failed: ${e.message.substring(0, 200)}`);
      // Don't throw — fall through to returning null
      return null;
    }
    console.log(`[puppeteer] Page loaded, URL: ${page.url()}`);

    // Wait for PDF viewer or download button
    await page.waitForSelector('embed[type="application/pdf"], iframe[src*="pdf"], a[href$=".pdf"], [class*="download"]', {
      timeout: 15000,
    }).catch(() => {/* continue anyway */});

    // Collect all candidate URLs
    const candidates: string[] = [];

    // iframes / embeds
    const embeds = await page.$$eval('embed[src], iframe[src]', (els: (Element & { src?: string })[]) =>
      els.map(e => e.src || '')
    );
    candidates.push(...embeds);

    // direct PDF links
    const links = await page.$$eval('a[href]', (els: (HTMLAnchorElement & { href?: string })[]) =>
      els.filter(e => (e.href || '').toLowerCase().includes('.pdf'))
        .map(e => e.href || '')
    );
    candidates.push(...links);

    // buttons with onclick PDF refs
    const btnCandidates = await page.$$eval('button, a', (els: Element[]) =>
      els.flatMap(e => {
        const el = e as HTMLElement;
        const onclick = el.getAttribute('onclick') || '';
        const match = onclick.match(/['"]([^'"]*\.pdf[^'"]*)['"]/) || [];
        return [...match, el.getAttribute('data-src') || '', el.getAttribute('data-url') || '', el.getAttribute('data-pdf') || ''].filter(Boolean) as string[];
      })
    );
    candidates.push(...btnCandidates);

    await page.close();

    for (const candidate of candidates) {
      if (candidate && candidate.length > 10 && !candidate.includes('void') && !candidate.includes('undefined')) {
        const resolved = candidate.startsWith('//') ? `https:${candidate}` :
                         candidate.startsWith('/') ? `${server.url}${candidate}` :
                         candidate;
        // Quick HEAD check
        try {
          const head = await axios.head(resolved, { timeout: 8000, maxRedirects: 3 });
          const ct = String(head.headers['content-type'] || '');
          if (ct.includes('pdf') || head.headers['content-length']) {
            return resolved;
          }
        } catch { /* try next */ }
      }
    }

    return null;
  } catch {
    try { await page.close(); } catch { /* ignore */ }
    return null;
  }
}

// ─── Sci-Hub master downloader ────────────────────────────────────────────────
async function downloadFromSciHub(doi: string, server: ServerInfo): Promise<DownloadResult | null> {
  // Sci-Hub.run uses a FastAPI backend — different mechanism from traditional HTML scraping
  if (server.url.includes('sci-hub.run')) {
    return await downloadFromSciHubRun(doi, server);
  }
  let cloudscraperPdfUrl: string | null = null;

  // 1. Try cloudscraper first (fast, no browser overhead)
  try {
    cloudscraperPdfUrl = await scrapeSciHubPage(doi, server);
  } catch (e) {
    if (e instanceof ScrapeBlockedError) {
      console.log(`[scihub] cloudscraper blocked on ${server.name}, falling back to Puppeteer...`);
      // Skip cloudscraper entirely — go straight to Puppeteer
      cloudscraperPdfUrl = null;
    } else if (e instanceof SciHubNotAvailableError) {
      // Paper not in Sci-Hub DB — skip Puppeteer too and try next server immediately
      console.log(`[scihub] ${server.name}: ${e.message}`);
      return null;
    } else {
      return null;
    }
  }

  if (cloudscraperPdfUrl) {
    const result = await downloadFileFromUrl(cloudscraperPdfUrl, doi, 'scidir_');
    if (result) return result;

    // cloudscraper found the PDF URL but direct download was blocked (e.g. 403 DDoS-Guard).
    // Try Puppeteer with the known URL — browser session may bypass the block.
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      const resolvedUrl = cloudscraperPdfUrl.startsWith('http')
        ? cloudscraperPdfUrl
        : `${server.url}${cloudscraperPdfUrl}`;
      await page.goto(resolvedUrl, { timeout: 30000 });
      await page.waitForSelector('body', { timeout: 5000 }).catch(() => {});
      const ct = await page.evaluate(() => document.contentType || '');
      if (ct.includes('pdf') || resolvedUrl.endsWith('.pdf')) {
        const filename = `scidir_${Date.now()}_${doi.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const filePath = path.join(UPLOAD_DIR, filename);
        const pdfBuffer = await page.pdf({ printBackground: true });
        fs.writeFileSync(filePath, pdfBuffer);
        const stat = fs.statSync(filePath);
        if (stat.size > 5000) {
          return { filePath: `/uploads/${filename}`, fileSize: stat.size };
        }
        fs.unlinkSync(filePath);
      }
    } catch {
      // Puppeteer approach also failed — fall through to next step
    } finally {
      await page.close().catch(() => {});
    }
  }

  // 2. Fallback to Puppeteer page scraping (handles Cloudflare on the search page)
  // Skip if cloudscraper found a "login required" page — paper not in Sci-Hub DB at all
  const browserPdfUrl = await scrapeSciHubWithBrowser(doi, server);
  if (browserPdfUrl) {
    const result = await downloadFileFromUrl(browserPdfUrl, doi, 'scidir_');
    if (result) return result;
  }

  return null;
}

// ─── LibGen ─────────────────────────────────────────────────────────────────
async function downloadFromLibGen(doi: string, server: ServerInfo): Promise<DownloadResult | null> {
  try {
    let searchUrl: string;
    if (server.url.includes('scimag')) {
      searchUrl = `${server.url}?req=${encodeURIComponent(doi)}&lg_topic=libgen&open=0&view=simple&res=25&phrase=1&column=def`;
    } else {
      searchUrl = `${server.url}?s=${encodeURIComponent(doi)}`;
    }

    const res = await cloudscraper.get(searchUrl) as string;

    const $ = cheerio.load(res as string);
    let pdfLink = $('a[href*=".pdf"]').first().attr('href');
    if (!pdfLink) pdfLink = $('a[href*="/get"]').first().attr('href');
    if (!pdfLink) pdfLink = $('tr td a[href*="download"]').first().attr('href');
    if (!pdfLink) return null;

    const fullUrl = pdfLink.startsWith('http') ? pdfLink : `${server.url}${pdfLink}`;
    return await downloadFileFromUrl(fullUrl, doi, 'libgen_');
  } catch {
    return null;
  }
}

// ─── Anna's Archive ───────────────────────────────────────────────────────────
async function downloadFromAnnasArchive(doi: string, _server: ServerInfo): Promise<DownloadResult | null> {
  try {
    const searchUrl = `https://annas-archive.org/search?q=${encodeURIComponent(doi)}&content_type=pdf`;
    const pageHtml = await cloudscraper.get(searchUrl) as string;

    const $ = cheerio.load(pageHtml);
    const firstResult = $('a[href*="/md5/"]').first().attr('href');
    if (!firstResult) return null;

    const md5PageUrl = `https://annas-archive.org${firstResult}`;
    const md5Html = await cloudscraper.get(md5PageUrl) as string;

    const $$ = cheerio.load(md5Html);
    let dlLink = $$('a[href*="/download/"]').first().attr('href');
    if (!dlLink) dlLink = $$('a[href*=".pdf"]').first().attr('href');
    if (!dlLink) return null;

    const pdfUrl = dlLink.startsWith('http') ? dlLink : `https://annas-archive.org${dlLink}`;
    return await downloadFileFromUrl(pdfUrl, doi, 'annas_');
  } catch {
    return null;
  }
}

// ─── Z-Library ───────────────────────────────────────────────────────────────
async function downloadFromZlibrary(doi: string, server: ServerInfo, userId: number): Promise<DownloadResult | null> {
  const cred = await getUserCredential(userId, server.id);
  if (!cred) return null;

  try {
    const base = server.url.endsWith('/') ? server.url.slice(0, -1) : server.url;
    const searchUrl = `${base}/search?q=${encodeURIComponent(doi)}`;
    const pageHtml = await cloudscraper.get(searchUrl) as string;

    const $ = cheerio.load(pageHtml);
    const firstLink = $('a[href*="/book/"]').first().attr('href');
    if (!firstLink) return null;

    const bookPageUrl = firstLink.startsWith('http') ? firstLink : `${server.url}${firstLink}`;
    const bookHtml = await cloudscraper.get(bookPageUrl) as string;

    const $$ = cheerio.load(bookHtml);
    let dlBtn = $$('a[href*="/download/"]').first().attr('href');
    if (!dlBtn) return null;

    const dlUrl = dlBtn.startsWith('http') ? dlBtn : `${server.url}${dlBtn}`;
    return await downloadFileFromUrl(dlUrl, doi, 'zlib_');
  } catch {
    return null;
  }
}

// ─── Unpaywall (Open Access) ─────────────────────────────────────────────────
/** Query Unpaywall API for free OA PDF. Called FIRST before any shadow library. */
async function downloadFromUnpaywall(doi: string): Promise<DownloadResult | null> {
  const email = process.env.UNPAYWALL_EMAIL;

  // Skip if not configured
  if (!email) {
    console.log(`[unpaywall] Not configured (set UNPAYWALL_EMAIL env var). Skipping.`);
    return null;
  }

  try {
    const res = await axios.get(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}`,
      {
        timeout: 15000,
        params: { email },
      }
    );

    const data = res.data;

    // Not OA at all
    if (!data.is_oa) {
      console.log(`[unpaywall] ${doi}: not OA`);
      return null;
    }

    // Try best PDF location first
    const bestPdfUrl = data.best_oa_location?.url_for_pdf;
    if (bestPdfUrl) {
      console.log(`[unpaywall] ${doi}: OA PDF found at ${bestPdfUrl}`);
      const result = await downloadFileFromUrl(bestPdfUrl, doi, 'unpaywall_');
      if (result) return result;
    }

    // Fall back to best OA location (may not be PDF but try anyway)
    const bestUrl = data.best_oa_location?.url;
    if (bestUrl) {
      console.log(`[unpaywall] ${doi}: OA location (non-PDF) at ${bestUrl}`);
      const result = await downloadFileFromUrl(bestUrl, doi, 'unpaywall_');
      if (result) return result;
    }

    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      // 422 = fake email → silently skip
      if (e.response?.status === 422) {
        console.log(`[unpaywall] Invalid email configured (UNPAYWALL_EMAIL). Skipping.`);
        return null;
      }
      console.log(`[unpaywall] API error: ${e.response?.status} ${e.message}`);
    } else {
      console.log(`[unpaywall] Error: ${(e as Error).message}`);
    }
    return null;
  }
}

// ─── Internet Archive ────────────────────────────────────────────────────────
async function downloadFromInternetArchive(doi: string, _server: ServerInfo): Promise<DownloadResult | null> {
  try {
    // Use Puppeteer for the SPA (JavaScript-based) interface
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const searchUrl = `https://archive.org/search?query=${encodeURIComponent(doi)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for results to render
    await page.waitForSelector('a.result-heading, a.item-title, [class*="result"]', { timeout: 10000 }).catch(() => {});

    const firstResult = await page.$eval('a.result-heading, a.item-title, [class*="result"] a[href]', (el: Element) =>
      (el as HTMLAnchorElement).href
    ).catch(() => null);

    await page.close();
    if (!firstResult) return null;

    // Navigate to item page and find PDF
    const page2 = await browser.newPage();
    await page2.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page2.goto(firstResult, { waitUntil: 'networkidle2', timeout: 30000 });
    await page2.waitForSelector('a[href$=".pdf"], .format-group a', { timeout: 10000 }).catch(() => {});

    const pdfLink = await page2.$eval('a[href$=".pdf"]', (el: Element) => (el as HTMLAnchorElement).href).catch(() => null);
    if (!pdfLink) {
      // Try download button
      const dlBtn = await page2.$eval('[class*="download"], .format-group a', (el: Element) => (el as HTMLAnchorElement).href).catch(() => null);
      await page2.close();
      if (!dlBtn) return null;
      const result = await downloadFileFromUrl(dlBtn, doi, 'ia_');
      return result;
    }

    await page2.close();
    return await downloadFileFromUrl(pdfLink, doi, 'ia_');
  } catch {
    return null;
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────
export async function downloadPaper(doi: string, userId: number, maxRetries = 3): Promise<DownloadResult> {
  // ─── Step 1: Try Unpaywall first (free, legal OA PDFs) ───────────────────
  console.log(`[download] Trying Unpaywall OA for ${doi}...`);
  const unpaywallResult = await downloadFromUnpaywall(doi);
  if (unpaywallResult) {
    console.log(`[download] ✅ Unpaywall success for ${doi}`);
    return unpaywallResult;
  }

  // ─── Step 2: Try shadow library servers ───────────────────────────────────
  const servers = await getAvailableServers();
  if (servers.length === 0) throw new Error('현재 사용 가능한 다운로드 서버가 없습니다.');

  const tried = new Set<number>();

  for (let i = 0; i < maxRetries; i++) {
    const available = servers.filter(s => !tried.has(s.id));
    if (available.length === 0) break;

    const server = pickServer(available);
    tried.add(server.id);

    let result: DownloadResult | null = null;

    if (server.type === 'scihub') {
      result = await downloadFromSciHub(doi, server);
    } else if (server.type === 'libgen') {
      result = await downloadFromLibGen(doi, server);
    } else if (server.type === 'archive') {
      // Try Anna's Archive first, then Internet Archive
      result = await downloadFromAnnasArchive(doi, server);
      if (!result) result = await downloadFromInternetArchive(doi, server);
    } else if (server.type === 'zlibrary') {
      result = await downloadFromZlibrary(doi, server, userId);
    }

    if (result) {
      await pool.query(
        `UPDATE download_servers SET success_rate = LEAST(100, COALESCE(success_rate,0) * 0.95 + 5) WHERE id = $1`,
        [server.id]
      );
      return result;
    }
  }

  throw new Error(`${maxRetries}번 시도했으나 PDF를 찾을 수 없습니다.`);
}