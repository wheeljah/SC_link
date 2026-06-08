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

// ─── User-Agent 순환 (봇 탐지 우회) ─────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
];
const randomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];



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
    const head = await axios.head(pdfUrl, {
      timeout: 10000, maxRedirects: 5,
      headers: { 'User-Agent': randomUA(), 'Accept': 'application/pdf,*/*' },
    });
    // 명시적 차단(403/401/429)만 false, 나머지는 GET으로 시도 (magic byte가 최종 검증)
    return head.status < 400;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const s = e.response?.status;
      if (s === 403 || s === 401 || s === 429) return false;
    }
    return true; // 네트워크 오류 포함 — 일단 GET 시도
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
      maxRedirects: 10,
      headers: {
        'User-Agent': randomUA(),
        'Accept': 'application/pdf,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://doi.org/',
      },
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
      console.log(`[download] file too small (${stat.size}b), skipping`);
      return null;
    }

    // PDF 매직바이트 검증 (%PDF-)
    const fd = fs.openSync(filePath, 'r');
    const magic = Buffer.alloc(5);
    fs.readSync(fd, magic, 0, 5, 0);
    fs.closeSync(fd);
    if (magic.toString('ascii') !== '%PDF-') {
      fs.unlinkSync(filePath);
      console.log(`[download] not a real PDF (magic=${magic.toString('ascii').replace(/\n/g,'')}) — likely HTML page`);
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
export interface S2PaperMeta {
  title?: string;
  authors?: string;
  year?: number;
  journal?: string;
  citationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdfUrl?: string;
}

export async function fetchPaperMetadataFromS2(doi: string): Promise<S2PaperMeta | null> {
  try {
    const res = await axios.get(
      `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}`,
      {
        params: { fields: 'title,authors,year,journal,citationCount,isOpenAccess,openAccessPdf,publicationVenue' },
        timeout: 10000,
        headers: { 'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)' },
      }
    );
    const d = res.data;
    const authors = (d.authors as { name: string }[] | undefined)
      ?.slice(0, 5).map((a) => a.name).join(', ') ?? undefined;
    const journal = d.journal?.name ?? d.publicationVenue?.name ?? undefined;
    return {
      title: d.title ?? undefined,
      authors,
      year: d.year ?? undefined,
      journal,
      citationCount: d.citationCount ?? undefined,
      isOpenAccess: d.isOpenAccess ?? undefined,
      openAccessPdfUrl: d.openAccessPdf?.url ?? undefined,
    };
  } catch {
    return null;
  }
}

async function downloadFromSemanticScholar(doi: string): Promise<DownloadResult | null> {
  try {
    const meta = await fetchPaperMetadataFromS2(doi);
    if (!meta?.openAccessPdfUrl) {
      console.log(`[s2] No OA PDF for ${doi}`);
      return null;
    }
    console.log(`[s2] OA PDF: ${meta.openAccessPdfUrl}`);
    const dl = await downloadFileFromUrl(meta.openAccessPdfUrl, doi, 's2_');
    if (!dl) return null;
    return {
      ...dl,
      title:   meta.title,
      authors: meta.authors,
      year:    meta.year,
      journal: meta.journal,
    };
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
  // API키 없어도 무료 100req/min으로 동작 (키 있으면 Bearer 헤더로 전송)
  const apiKey = process.env.CORE_API_KEY;
  const headers: Record<string, string> = { 'User-Agent': 'ScholarLink/1.0' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const res = await axios.get(
      'https://api.core.ac.uk/v3/search/works',
      {
        params: { q: `doi:"${doi}"`, limit: 3 },
        headers,
        timeout: 12000,
      }
    );
    const results: Array<{
      downloadUrl?: string;
      fullTextUrl?: string;
      links?: Array<{ type?: string; url?: string }>;
      title?: string;
      authors?: Array<{ name?: string }>;
      year?: number;
      journals?: Array<{ title?: string }>;
    }> = res.data?.results ?? [];

    for (const work of results) {
      // 다운로드 후보 수집 (우선순위: downloadUrl > links[type=download] > fullTextUrl > links[type=reader])
      const candidates: string[] = [];
      if (work.downloadUrl) candidates.push(work.downloadUrl);
      for (const link of work.links ?? []) {
        if (link.url && link.type === 'download') candidates.push(link.url);
      }
      if (work.fullTextUrl) candidates.push(work.fullTextUrl);
      for (const link of work.links ?? []) {
        if (link.url && link.type !== 'download') candidates.push(link.url);
      }

      for (const url of candidates) {
        const dl = await downloadFileFromUrl(url, doi, 'core_');
        if (dl) {
          return {
            ...dl,
            title:   work.title,
            authors: work.authors?.slice(0, 5).map(a => a.name ?? '').join(', '),
            year:    work.year,
            journal: work.journals?.[0]?.title,
          };
        }
      }
    }
    console.log(`[core] No downloadable PDF for ${doi}`);
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) console.log(`[core] ${e.response?.status} ${e.message}`);
    return null;
  }
}


// ─── RISS (학술연구정보서비스) ─────────────────────────────────────────────
// KCI(한국연구재단) 등재 국내 논문 full-text 접근
async function downloadFromRISS(doi: string): Promise<DownloadResult | null> {
  try {
    const searchUrl = `https://www.riss.kr/search/Search.do?isDetailSearch=N&searchGubun=true&viewYn=OP&query=${encodeURIComponent(doi)}&strQuery=${encodeURIComponent(doi)}&colName=re_a_kor&resultCount=5`;
    const html = await axios.get(searchUrl, {
      timeout: 12000,
      headers: { 'User-Agent': randomUA() },
    }).then(r => r.data as string);

    const $ = cheerio.load(html);
    const pdfLink = $('a[href*="/pdf/"], a[href*="downloadFullText"], a[href*=".pdf"]').first().attr('href');
    if (!pdfLink) return null;

    const fullUrl = pdfLink.startsWith('http') ? pdfLink : `https://www.riss.kr${pdfLink}`;
    return await downloadFileFromUrl(fullUrl, doi, 'riss_');
  } catch {
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
    if (embedSrc) {
      const fixedEmbed = embedSrc.startsWith('//') ? 'https:' + embedSrc : embedSrc;
      return fixedEmbed.startsWith('http') ? fixedEmbed : `${server.url}${fixedEmbed}`;
    }

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
    // 1단계: DOI로 검색
    const searchUrl = `${base}/search?q=${encodeURIComponent(doi)}&content_type=pdf`;
    const pageHtml = await cloudscraper.get(searchUrl) as string;
    const $ = cheerio.load(pageHtml);

    const firstResult = $('a[href*="/md5/"]').first().attr('href');
    if (!firstResult) return null;

    const md5PageUrl = firstResult.startsWith('http') ? firstResult : `${base}${firstResult}`;
    const md5Html = await cloudscraper.get(md5PageUrl) as string;
    const $$ = cheerio.load(md5Html);

    // 2단계: 직접 다운로드 링크 수집 (우선순위순)
    const candidates: string[] = [];

    // fast_download (직접 PDF, 가장 신뢰도 높음)
    $$('a[href*="/fast_download/"]').each((_: number, el: Parameters<typeof $$>[0]) => {
      const href = $$(el).attr('href');
      if (href) candidates.push(href.startsWith('http') ? href : `${base}${href}`);
    });
    // /download/ 링크
    $$('a[href*="/download/"]').each((_: number, el: Parameters<typeof $$>[0]) => {
      const href = $$(el).attr('href');
      if (href) candidates.push(href.startsWith('http') ? href : `${base}${href}`);
    });
    // .pdf 직접 링크
    $$('a[href$=".pdf"]').each((_: number, el: Parameters<typeof $$>[0]) => {
      const href = $$(el).attr('href');
      if (href) candidates.push(href.startsWith('http') ? href : `${base}${href}`);
    });

    for (const url of candidates) {
      const result = await downloadFileFromUrl(url, doi, 'annas_');
      if (result) return result;
    }
    return null;
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
interface UnpaywallLocation {
  url?: string;
  url_for_pdf?: string;
  url_for_landing_page?: string;
  host_type?: string;  // 'publisher' | 'repository'
  version?: string;    // 'publishedVersion' | 'acceptedVersion' | 'submittedVersion'
}

function sortUnpaywallLocations(locs: UnpaywallLocation[]): UnpaywallLocation[] {
  const hostPriority: Record<string, number> = { publisher: 0, repository: 1 };
  const verPriority: Record<string, number>  = { publishedVersion: 0, acceptedVersion: 1, submittedVersion: 2 };
  return [...locs].sort((a, b) => {
    const ha = hostPriority[a.host_type ?? ''] ?? 9;
    const hb = hostPriority[b.host_type ?? ''] ?? 9;
    if (ha !== hb) return ha - hb;
    const va = verPriority[a.version ?? ''] ?? 9;
    const vb = verPriority[b.version ?? ''] ?? 9;
    return va - vb;
  });
}

// ─── OpenAlex (PaperGate 동일 데이터 소스 — 450M 논문, API key 불필요) ────────
async function downloadFromOpenAlex(doi: string): Promise<DownloadResult | null> {
  try {
    const url = `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}` +
      `?select=title,open_access,best_oa_location,locations,authorships,publication_year` +
      `&mailto=${process.env.UNPAYWALL_EMAIL || 'user@scholarlink.app'}`;

    const res = await axios.get(url, { timeout: 15000 });
    const data = res.data;

    // 모든 위치에서 pdf_url 수집 (best_oa_location 우선)
    const candidates: string[] = [];
    const best = data.best_oa_location;
    if (best?.pdf_url) candidates.push(best.pdf_url);
    if (data.open_access?.oa_url && !candidates.includes(data.open_access.oa_url)) {
      candidates.push(data.open_access.oa_url);
    }
    for (const loc of (data.locations || []) as { pdf_url?: string; is_oa?: boolean }[]) {
      if (loc.pdf_url && loc.is_oa && !candidates.includes(loc.pdf_url)) {
        candidates.push(loc.pdf_url);
      }
    }

    for (const pdfUrl of candidates) {
      try {
        const result = await downloadFileFromUrl(pdfUrl, doi);
        if (result) {
          const authors = ((data.authorships || []) as { author?: { display_name?: string } }[])
            .slice(0, 3).map((a) => a.author?.display_name || '').filter(Boolean).join(', ');
          return {
            ...result,
            title: data.title || undefined,
            authors: authors || undefined,
            year: data.publication_year || undefined,
          };
        }
      } catch { /* 다음 URL 시도 */ }
    }
    return null;
  } catch (err) {
    const msg = (err as { response?: { status?: number } }).response?.status;
    if (msg === 404) return null; // 논문 없음
    throw err;
  }
}

async function downloadFromUnpaywall(doi: string): Promise<DownloadResult | null> {
  const email = process.env.UNPAYWALL_EMAIL;
  if (!email) { console.log('[unpaywall] UNPAYWALL_EMAIL not set. Skipping.'); return null; }

  try {
    const res = await axios.get(
      `https://api.unpaywall.org/v2/${encodeURIComponent(doi)}`,
      { timeout: 15000, params: { email } }
    );
    const data = res.data;
    if (!data.is_oa) { console.log(`[unpaywall] ${doi}: not OA (oa_status=${data.oa_status})`); return null; }

    // oa_locations 전체 수집 (best + 나머지) → 중복 제거 후 우선순위 정렬
    const allLocs: UnpaywallLocation[] = [];
    if (data.best_oa_location) allLocs.push(data.best_oa_location);
    for (const loc of data.oa_locations ?? []) {
      if (!allLocs.some(l => l.url_for_pdf === loc.url_for_pdf && l.url === loc.url)) {
        allLocs.push(loc);
      }
    }
    const sorted = sortUnpaywallLocations(allLocs);
    console.log(`[unpaywall] ${sorted.length}개 OA 위치 시도 (oa_status=${data.oa_status})`);

    for (const loc of sorted) {
      // 1순위: 직접 PDF URL
      if (loc.url_for_pdf) {
        const r = await downloadFileFromUrl(loc.url_for_pdf, doi, 'unpaywall_');
        if (r) { console.log(`[unpaywall] ✅ url_for_pdf (${loc.host_type})`); return r; }
      }
      // 2순위: 일반 URL (landing page or direct)
      if (loc.url) {
        const r = await downloadFileFromUrl(loc.url, doi, 'unpaywall_');
        if (r) { console.log(`[unpaywall] ✅ url (${loc.host_type})`); return r; }
      }
      // 3순위: landing page
      if (loc.url_for_landing_page && loc.url_for_landing_page !== loc.url) {
        const r = await downloadFileFromUrl(loc.url_for_landing_page, doi, 'unpaywall_');
        if (r) { console.log(`[unpaywall] ✅ landing_page (${loc.host_type})`); return r; }
      }
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
export async function downloadPaper(
  doi: string,
  userId: number,
  onProgress?: (msg: string) => void
): Promise<DownloadResult> {

  const progress = (msg: string) => { onProgress?.(msg); console.log(`[download] ${msg}`); };

  // ─── Phase 1: Open Access APIs (무료·합법, API key 불필요) ────────────────
  const oaSources: Array<[string, () => Promise<DownloadResult | null>]> = [
    ['OpenAlex',         () => downloadFromOpenAlex(doi)],
    ['Unpaywall',        () => downloadFromUnpaywall(doi)],
    ['Semantic Scholar', () => downloadFromSemanticScholar(doi)],
    ['Europe PMC',       () => downloadFromEuropePMC(doi)],
    ['PMC OA',           () => downloadFromPMC(doi)],
    ['CORE',             () => downloadFromCORE(doi)],
  ];

  for (const [name, fn] of oaSources) {
    progress(`🔍 ${name} 확인 중...`);
    try {
      const r = await fn();
      if (r) { progress(`✅ ${name} — PDF 확보`); return r; }
      progress(`✗ ${name} — 없음`);
    } catch { progress(`✗ ${name} — 오류`); }
  }

  // ─── Phase 1.5: RISS (국내 기관 학술DB, KCI 논문) ──────────────────────────
  progress(`🔍 RISS 국내 학술DB 확인 중...`);
  try {
    const rissResult = await downloadFromRISS(doi);
    if (rissResult) { progress(`✅ RISS — PDF 확보`); return rissResult; }
    progress(`✗ RISS — 없음`);
  } catch { progress(`✗ RISS — 오류`); }

  // ─── Phase 2: Sci-Hub.run API (빠른 캐시 우선) ───────────────────────────
  const { rows: runRows } = await pool.query(
    `SELECT id, name, url, type, status, avg_latency FROM download_servers WHERE url LIKE '%sci-hub.run%' AND is_active = true LIMIT 1`
  );
  if (runRows.length > 0) {
    progress(`🔍 Sci-Hub API 캐시 확인 중...`);
    const runResult = await downloadFromSciHubRun(doi, runRows[0] as ServerInfo);
    if (runResult) {
      progress(`✅ Sci-Hub API — PDF 확보`);
      await pool.query(
        `UPDATE download_servers SET success_rate = LEAST(100, COALESCE(success_rate,0)*0.95+5) WHERE id=$1`,
        [runRows[0].id]
      );
      return runResult;
    }
    progress(`✗ Sci-Hub API — 없음`);
  }

  // ─── Phase 3: Remaining servers — 전체 순차 시도 ────────────────────────────
  const servers = await getAvailableServers();
  if (servers.length === 0) throw new Error('현재 사용 가능한 다운로드 서버가 없습니다.');

  // 책 챕터 DOI 판별 (Springer: 10.1007/978-... 또는 _ 포함)
  const isBookChapter = /^10\.\d{4}\/978-/.test(doi) || doi.includes('_');

  // 시도 순서: 책 챕터이면 Anna's Archive 우선, 그 다음 Sci-Hub → LibGen
  const remaining = servers
    .filter(s => !s.url.includes('sci-hub.run'))
    .sort((a, b) => {
      if (isBookChapter) {
        const priority: Record<string, number> = { archive: 0, libgen: 1, scihub: 2, zlibrary: 3, ia: 4 };
        return (priority[a.type] ?? 5) - (priority[b.type] ?? 5);
      }
      const priority: Record<string, number> = { scihub: 0, libgen: 1, archive: 2, zlibrary: 3, ia: 4 };
      return (priority[a.type] ?? 5) - (priority[b.type] ?? 5);
    });

  progress(`📋 ${remaining.length}개 서버 순차 시도 시작...`);

  for (const server of remaining) {
    progress(`🔍 ${server.name} 확인 중...`);
    let result: DownloadResult | null = null;

    try {
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
    } catch { progress(`✗ ${server.name} — 오류`); }

    if (result) {
      progress(`✅ ${server.name} — PDF 확보`);
      await pool.query(
        `UPDATE download_servers SET success_rate = LEAST(100, COALESCE(success_rate,0)*0.95+5) WHERE id=$1`,
        [server.id]
      );
      return result;
    }
    progress(`✗ ${server.name} — 없음`);
  }

  throw new Error('PDF를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.');
}
