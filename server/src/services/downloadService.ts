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

// Render 등 Chrome 없는 환경에서 Puppeteer 시도 자체를 건너뜀
const PUPPETEER_AVAILABLE = process.env.PUPPETEER_SKIP_DOWNLOAD !== 'true';

async function getBrowser() {
  if (!PUPPETEER_AVAILABLE) throw new Error('[puppeteer] Chrome 사용 불가 (PUPPETEER_SKIP_DOWNLOAD=true)');
  if (!browserPromise) {
    const puppeteer = await import('puppeteer');
    browserPromise = puppeteer.default.launch({
      executablePath: process.env.CHROME_PATH || 'google-chrome-stable',
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

async function checkPdfAccessible(pdfUrl: string): Promise<boolean> {
  try {
    const head = await axios.head(pdfUrl, { timeout: 15000, maxRedirects: 5 });
    const ct = String(head.headers['content-type'] || '');
    const size = head.headers['content-length'];
    return (ct.includes('pdf') || !!size) && head.status === 200;
  } catch (e) {
    if (axios.isAxiosError(e) && (e.response?.status === 403 || e.response?.status === 401)) {
      return false;
    }
    return true;
  }
}

async function downloadFileFromUrl(pdfUrl: string, doi: string, prefix = ''): Promise<DownloadResult | null> {
  try {
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

// ─── OA: Semantic Scholar ─────────────────────────────────────────────────────
async function downloadFromSemanticScholar(doi: string): Promise<DownloadResult | null> {
  try {
    const res = await axios.get(
      `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}`,
      {
        params: { fields: 'openAccessPdf,title' },
        timeout: 10000,
        headers: { 'User-Agent': 'ScholarLink/1.0 (research tool)' },
      }
    );
    const pdfUrl: string | undefined = res.data?.openAccessPdf?.url;
    if (!pdfUrl) {
      console.log(`[s2] No OA PDF for ${doi}`);
      return null;
    }
    console.log(`[s2] OA PDF: ${pdfUrl}`);
    return await downloadFileFromUrl(pdfUrl, doi, 's2_');
  } catch (e) {
    if (axios.isAxiosError(e)) console.log(`[s2] ${e.response?.status} ${e.message}`);
    return null;
  }
}

// ─── OA: Europe PMC ───────────────────────────────────────────────────────────
async function downloadFromEuropePMC(doi: string): Promise<DownloadResult | null> {
  try {
    // Step 1: search by DOI
    const searchRes = await axios.get(
      'https://www.ebi.ac.uk/europepmc/webservices/rest/search',
      {
        params: {
          query: `DOI:${doi}`,
          resultType: 'lite',
          format: 'json',
          pageSize: 1,
        },
        timeout: 10000,
      }
    );
    const results = searchRes.data?.resultList?.result;
    if (!results?.length) return null;

    const article = results[0];
    const pmcId: string | undefined = article.pmcid;
    const isOA: boolean = article.isOpenAccess === 'Y';

    if (!isOA || !pmcId) {
      console.log(`[europepmc] ${doi}: not OA or no PMCID`);
      return null;
    }

    // Step 2: get PDF via PMC render endpoint
    const pdfUrl = `https://europepmc.org/backend/ptpmcrender.fcgi?accid=${pmcId}&blobtype=pdf`;
    console.log(`[europepmc] ${doi} → ${pmcId}: ${pdfUrl}`);
    return await downloadFileFromUrl(pdfUrl, doi, 'epmc_');
  } catch (e) {
    if (axios.isAxiosError(e)) console.log(`[europepmc] ${e.response?.status} ${e.message}`);
    return null;
  }
}

// ─── OA: PubMed Central ───────────────────────────────────────────────────────
async function downloadFromPMC(doi: string): Promise<DownloadResult | null> {
  try {
    // Step 1: DOI → PMCID via ID converter
    const idRes = await axios.get(
      'https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/',
      {
        params: { ids: doi, format: 'json', idtype: 'doi' },
        timeout: 10000,
      }
    );
    const record = idRes.data?.records?.[0];
    const pmcid: string | undefined = record?.pmcid;
    if (!pmcid) {
      console.log(`[pmc] No PMCID for ${doi}`);
      return null;
    }

    // Step 2: get OA download links
    const oaRes = await axios.get(
      'https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi',
      {
        params: { id: pmcid, format: 'json' },
        timeout: 10000,
      }
    );
    const links: Array<{ href: string; format: string }> = oaRes.data?.records?.[0]?.links ?? [];
    const pdfLink = links.find(l => l.format === 'pdf')?.href;
    if (!pdfLink) {
      console.log(`[pmc] No PDF link for ${pmcid}`);
      return null;
    }

    // Step 3: download (FTP URL → convert to HTTPS)
    const pdfUrl = pdfLink.replace(/^ftp:/, 'https:');
    console.log(`[pmc] ${doi} → ${pmcid}: ${pdfUrl}`);
    return await downloadFileFromUrl(pdfUrl, doi, 'pmc_');
  } catch (e) {
    if (axios.isAxiosError(e)) console.log(`[pmc] ${e.response?.status} ${e.message}`);
    return null;
  }
}

// ─── OA: CORE API ─────────────────────────────────────────────────────────────
async function downloadFromCORE(doi: string): Promise<DownloadResult | null> {
  const apiKey = process.env.CORE_API_KEY;
  if (!apiKey) {
    console.log('[core] CORE_API_KEY not set, skipping');
    return null;
  }
  try {
    const res = await axios.get(
      'https://api.core.ac.uk/v3/search/works',
      {
        params: { q: `doi:${doi}`, limit: 1, api_key: apiKey },
        timeout: 10000,
      }
    );
    const work = res.data?.results?.[0];
    if (!work) return null;

    const pdfUrl: string | undefined = work.downloadUrl || work.fullTextUrl;
    if (!pdfUrl) {
      console.log(`[core] No PDF URL for ${doi}`);
      return null;
    }
    console.log(`[core] PDF: ${pdfUrl}`);
    return await downloadFileFromUrl(pdfUrl, doi, 'core_');
  } catch (e) {
    if (axios.isAxiosError(e)) console.log(`[core] ${e.response?.status} ${e.message}`);
    return null;
  }
}

// ─── Sci-Hub.run (FastAPI backend) ───────────────────────────────────────────
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
    const apiRes = await axios.get(`${API_BASE}/api/v1/paper/${encodeURIComponent(doi)}`, {
      timeout: 8000,
      headers,
    });
    const data = apiRes.data;
    if (!data.success) return null;

    const pdfPath: string = data.url;
    const pdfUrl = pdfPath.startsWith('http') ? pdfPath : `${API_BASE}${pdfPath}`;
    const result = await downloadFileFromUrl(pdfUrl, doi, 'shr_');
    if (result) {
      console.log(`[scihub.run] Downloaded: ${doi} (cached=${data.cached})`);
      return result;
    }
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response?.status === 404) { console.log(`[scihub.run] Not found: ${doi}`); return null; }
      console.log(`[scihub.run] ${e.response?.status} ${e.message}`);
    }
    return null;
  }
}

// ─── Sci-Hub (cloudscraper → cheerio) ───────────────────────────────────────

class ScrapeBlockedError extends Error {
  constructor(message: string) { super(message); this.name = 'ScrapeBlockedError'; }
}
class SciHubNotAvailableError extends Error {
  constructor(message: string) { super(message); this.name = 'SciHubNotAvailableError'; }
}

async function scrapeSciHubPage(doi: string, server: ServerInfo): Promise<string | null> {
  try {
    const pageUrl = `${server.url}/${doi}`;
    const pageHtml = await cloudscraper.get(pageUrl) as string;

    if (
      pageHtml.includes('DDoS-Guard') ||
      pageHtml.includes('Cloudflare') ||
      pageHtml.includes('Just a moment') ||
      pageHtml.length < 100
    ) {
      throw new ScrapeBlockedError(`Protection page from ${server.name}: ${pageUrl}`);
    }

    const notAvailablePatterns = [
      'Log in to access this article',
      'The article reader is available to registered users',
      'Login to access',
      'not found in Sci-Hub',
      'Article not found',
    ];
    for (const pattern of notAvailablePatterns) {
      if (pageHtml.includes(pattern)) {
        throw new SciHubNotAvailableError(`Paper not available on ${server.name}: ${pattern}`);
      }
    }

    const $ = cheerio.load(pageHtml);

    const embedSrc = $('embed[type="application/pdf"]').attr('src') ||
                     $('iframe').filter('[src*="pdf"], [src*="viewer"]').attr('src');
    if (embedSrc) return embedSrc.startsWith('http') ? embedSrc : `${server.url}${embedSrc}`;

    const pdfHref = $('a[href$=".pdf"]').first().attr('href') ||
                    $('a[href*=".pdf?"]').first().attr('href') ||
                    $('button[onclick*=".pdf"]').first().attr('onclick')?.match(/['"]([^'"]*\.pdf[^'"]*)['"]/)?.[1];
    if (pdfHref) return pdfHref.startsWith('http') ? pdfHref : `${server.url}${pdfHref}`;

    const dataPdf = $('[data-pdf]').first().attr('data-pdf') ||
                    $('[data-src*="pdf"]').first().attr('data-src') ||
                    $('[data-url*="pdf"]').first().attr('data-url');
    if (dataPdf) return dataPdf.startsWith('http') ? dataPdf : `${server.url}${dataPdf}`;

    return null;
  } catch (e) {
    if (e instanceof ScrapeBlockedError) throw e;
    if (e instanceof SciHubNotAvailableError) throw e;
    return null;
  }
}

async function scrapeSciHubWithBrowser(doi: string, server: ServerInfo): Promise<string | null> {
  console.log(`[puppeteer] Scraping ${doi} via ${server.name}...`);
  let browser;
  try {
    browser = await getBrowser();
  } catch(e: unknown) {
    console.log(`[puppeteer] Browser launch failed: ${(e as Error).message}`);
    return null;
  }
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const pageUrl = `${server.url}/${doi}`;
    try {
      await page.goto(pageUrl, { waitUntil: 'load', timeout: 20000 });
    } catch(e: unknown) {
      console.log(`[puppeteer] goto failed: ${(e as Error).message.substring(0, 200)}`);
      return null;
    }

    await page.waitForSelector('embed[type="application/pdf"], iframe[src*="pdf"], a[href$=".pdf"], [class*="download"]', {
      timeout: 15000,
    }).catch(() => {});

    const candidates: string[] = [];

    const embeds = await page.$$eval('embed[src], iframe[src]', (els: (Element & { src?: string })[]) =>
      els.map(e => e.src || '')
    );
    candidates.push(...embeds);

    const links = await page.$$eval('a[href]', (els: (HTMLAnchorElement & { href?: string })[]) =>
      els.filter(e => (e.href || '').toLowerCase().includes('.pdf')).map(e => e.href || '')
    );
    candidates.push(...links);

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
        try {
          const head = await axios.head(resolved, { timeout: 8000, maxRedirects: 3 });
          const ct = String(head.headers['content-type'] || '');
          if (ct.includes('pdf') || head.headers['content-length']) return resolved;
        } catch { /* try next */ }
      }
    }

    return null;
  } catch {
    try { await page.close(); } catch { /* ignore */ }
    return null;
  }
}

async function downloadFromSciHub(doi: string, server: ServerInfo): Promise<DownloadResult | null> {
  if (server.url.includes('sci-hub.run')) return await downloadFromSciHubRun(doi, server);

  let cloudscraperPdfUrl: string | null = null;

  try {
    cloudscraperPdfUrl = await scrapeSciHubPage(doi, server);
  } catch (e) {
    if (e instanceof ScrapeBlockedError) {
      console.log(`[scihub] cloudscraper blocked on ${server.name}, falling back to Puppeteer...`);
      cloudscraperPdfUrl = null;
    } else if (e instanceof SciHubNotAvailableError) {
      console.log(`[scihub] ${server.name}: ${e.message}`);
      return null;
    } else {
      return null;
    }
  }

  if (cloudscraperPdfUrl) {
    const result = await downloadFileFromUrl(cloudscraperPdfUrl, doi, 'scidir_');
    if (result) return result;

    if (PUPPETEER_AVAILABLE) {
      try {
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
            if (stat.size > 5000) return { filePath: `/uploads/${filename}`, fileSize: stat.size };
            fs.unlinkSync(filePath);
          }
        } catch { /* fall through */ }
        finally { await page.close().catch(() => {}); }
      } catch { /* Chrome 없음 — 건너뜀 */ }
    }
  }

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
    // libgen.rs / libgen.st / libgen.is use /scimag endpoint
    if (server.url.includes('scimag') || server.url.match(/libgen\.(rs|st|is|li|la|gl|bz|vg)/)) {
      const base = server.url.replace(/\/scimag.*$/, '');
      searchUrl = `${base}/scimag/?req=${encodeURIComponent(doi)}&lg_topic=libgen&open=0&view=simple&res=25&phrase=1&column=def`;
    } else {
      searchUrl = `${server.url}?s=${encodeURIComponent(doi)}`;
    }

    const res = await cloudscraper.get(searchUrl) as string;
    const $ = cheerio.load(res);

    let pdfLink = $('a[href*=".pdf"]').first().attr('href');
    if (!pdfLink) pdfLink = $('a[href*="/get"]').first().attr('href');
    if (!pdfLink) pdfLink = $('tr td a[href*="download"]').first().attr('href');
    if (!pdfLink) {
      // library.lol style: direct download link in table
      $('td a[href^="http"]').each((_: number, el: unknown) => {
        if (pdfLink) return false; // break
        const href = $(el as Parameters<typeof $>[0]).attr('href') || '';
        if (href.includes('library.lol') || href.includes('libgen') || href.endsWith('.pdf')) {
          pdfLink = href;
        }
      });
    }
    if (!pdfLink) return null;

    const fullUrl = pdfLink.startsWith('http') ? pdfLink : `${server.url}${pdfLink}`;

    // library.lol returns an intermediate download page — follow it
    if (fullUrl.includes('library.lol') || fullUrl.includes('get.php')) {
      const dlPage = await cloudscraper.get(fullUrl) as string;
      const $dl = cheerio.load(dlPage);
      const directLink = $dl('a[href*=".pdf"]').first().attr('href') ||
                         $dl('h2 a').first().attr('href');
      if (directLink) return await downloadFileFromUrl(
        directLink.startsWith('http') ? directLink : `${fullUrl}${directLink}`, doi, 'libgen_'
      );
    }

    return await downloadFileFromUrl(fullUrl, doi, 'libgen_');
  } catch {
    return null;
  }
}

// ─── Anna's Archive ───────────────────────────────────────────────────────────
// annas-archive.org는 2026년 1월 차단됨 — server.url 사용 (.gl/.gd 미러)
async function downloadFromAnnasArchive(doi: string, server: ServerInfo): Promise<DownloadResult | null> {
  const base = server.url.endsWith('/') ? server.url.slice(0, -1) : server.url;
  try {
    const searchUrl = `${base}/search?q=${encodeURIComponent(doi)}&content_type=pdf`;
    const pageHtml = await cloudscraper.get(searchUrl) as string;
    const $ = cheerio.load(pageHtml);

    const firstResult = $('a[href*="/md5/"]').first().attr('href');
    if (!firstResult) return null;

    const md5PageUrl = firstResult.startsWith('http') ? firstResult : `${base}${firstResult}`;
    const md5Html = await cloudscraper.get(md5PageUrl) as string;
    const $$ = cheerio.load(md5Html);

    let dlLink = $$('a[href*="/download/"]').first().attr('href');
    if (!dlLink) dlLink = $$('a[href*=".pdf"]').first().attr('href');
    if (!dlLink) return null;

    const pdfUrl = dlLink.startsWith('http') ? dlLink : `${base}${dlLink}`;
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

    const dlBtn = $$('a[href*="/download/"]').first().attr('href');
    if (!dlBtn) return null;

    const dlUrl = dlBtn.startsWith('http') ? dlBtn : `${server.url}${dlBtn}`;
    return await downloadFileFromUrl(dlUrl, doi, 'zlib_');
  } catch {
    return null;
  }
}

// ─── Unpaywall (Open Access) ─────────────────────────────────────────────────
async function downloadFromUnpaywall(doi: string): Promise<DownloadResult | null> {
  const email = process.env.UNPAYWALL_EMAIL;
  if (!email) { console.log('[unpaywall] UNPAYWALL_EMAIL not set. Skipping.'); return null; }

  try {
    const res = await axios.get(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}`,
      { timeout: 15000, params: { email } }
    );
    const data = res.data;
    if (!data.is_oa) { console.log(`[unpaywall] ${doi}: not OA`); return null; }

    const bestPdfUrl = data.best_oa_location?.url_for_pdf;
    if (bestPdfUrl) {
      console.log(`[unpaywall] OA PDF: ${bestPdfUrl}`);
      const result = await downloadFileFromUrl(bestPdfUrl, doi, 'unpaywall_');
      if (result) return result;
    }

    const bestUrl = data.best_oa_location?.url;
    if (bestUrl) {
      const result = await downloadFileFromUrl(bestUrl, doi, 'unpaywall_');
      if (result) return result;
    }
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response?.status === 422) { console.log('[unpaywall] Invalid email. Skipping.'); return null; }
      console.log(`[unpaywall] ${e.response?.status} ${e.message}`);
    }
    return null;
  }
}

// ─── Internet Archive ────────────────────────────────────────────────────────
async function downloadFromInternetArchive(doi: string, _server: ServerInfo): Promise<DownloadResult | null> {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const searchUrl = `https://archive.org/search?query=${encodeURIComponent(doi)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('a.result-heading, a.item-title, [class*="result"]', { timeout: 10000 }).catch(() => {});

    const firstResult = await page.$eval('a.result-heading, a.item-title, [class*="result"] a[href]',
      (el: Element) => (el as HTMLAnchorElement).href
    ).catch(() => null);

    await page.close();
    if (!firstResult) return null;

    const page2 = await browser.newPage();
    await page2.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page2.goto(firstResult, { waitUntil: 'networkidle2', timeout: 30000 });
    await page2.waitForSelector('a[href$=".pdf"], .format-group a', { timeout: 10000 }).catch(() => {});

    const pdfLink = await page2.$eval('a[href$=".pdf"]', (el: Element) => (el as HTMLAnchorElement).href).catch(() => null);
    if (!pdfLink) {
      const dlBtn = await page2.$eval('[class*="download"], .format-group a', (el: Element) => (el as HTMLAnchorElement).href).catch(() => null);
      await page2.close();
      if (!dlBtn) return null;
      return await downloadFileFromUrl(dlBtn, doi, 'ia_');
    }

    await page2.close();
    return await downloadFileFromUrl(pdfLink, doi, 'ia_');
  } catch {
    return null;
  }
}

// ─── Main entry point ────────────────────────────────────────────────────────
export async function downloadPaper(doi: string, userId: number, maxRetries = 5): Promise<DownloadResult> {

  // ─── Phase 1: Open Access APIs (무료·합법, API key 불필요) ────────────────
  const oaSources: Array<[string, () => Promise<DownloadResult | null>]> = [
    ['Unpaywall',      () => downloadFromUnpaywall(doi)],
    ['Semantic Scholar', () => downloadFromSemanticScholar(doi)],
    ['Europe PMC',     () => downloadFromEuropePMC(doi)],
    ['PMC OA',         () => downloadFromPMC(doi)],
    ['CORE',           () => downloadFromCORE(doi)],
  ];

  for (const [name, fn] of oaSources) {
    console.log(`[download] Trying ${name} for ${doi}...`);
    try {
      const r = await fn();
      if (r) { console.log(`[download] ✅ ${name} success`); return r; }
    } catch { /* continue */ }
  }

  // ─── Phase 2: Sci-Hub.run API (빠른 캐시 우선) ───────────────────────────
  const { rows: runRows } = await pool.query(
    `SELECT id, name, url, type, status, avg_latency FROM download_servers WHERE url LIKE '%sci-hub.run%' AND is_active = true LIMIT 1`
  );
  if (runRows.length > 0) {
    console.log('[download] Trying sci-hub.run API...');
    const runResult = await downloadFromSciHubRun(doi, runRows[0] as ServerInfo);
    if (runResult) {
      await pool.query(
        `UPDATE download_servers SET success_rate = LEAST(100, COALESCE(success_rate,0)*0.95+5) WHERE id=$1`,
        [runRows[0].id]
      );
      return runResult;
    }
  }

  // ─── Phase 3: Remaining servers (Sci-Hub mirrors, LibGen, Archive, Z-Lib) ──
  const servers = await getAvailableServers();
  if (servers.length === 0) throw new Error('현재 사용 가능한 다운로드 서버가 없습니다.');

  const remaining = servers.filter(s => !s.url.includes('sci-hub.run'));
  const tried = new Set<number>();

  for (let i = 0; i < maxRetries; i++) {
    const available = remaining.filter(s => !tried.has(s.id));
    if (available.length === 0) break;

    const server = pickServer(available);
    tried.add(server.id);

    let result: DownloadResult | null = null;

    if (server.type === 'scihub') {
      result = await downloadFromSciHub(doi, server);
    } else if (server.type === 'libgen') {
      result = await downloadFromLibGen(doi, server);
    } else if (server.type === 'archive') {
      result = await downloadFromAnnasArchive(doi, server);
    } else if (server.type === 'zlibrary') {
      result = await downloadFromZlibrary(doi, server, userId);
    } else if (server.type === 'ia') {
      result = await downloadFromInternetArchive(doi, server);
    }

    if (result) {
      await pool.query(
        `UPDATE download_servers SET success_rate = LEAST(100, COALESCE(success_rate,0)*0.95+5) WHERE id=$1`,
        [server.id]
      );
      return result;
    }
  }

  throw new Error('PDF를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.');
}
