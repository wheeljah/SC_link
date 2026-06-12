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

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Cloudflare Worker proxy (CF_PROXY_URL env var). When set, blocked downloads
// are retried through the CF edge IP to bypass Render's IP blocklist.
const CF_PROXY_URL = process.env.CF_PROXY_URL?.replace(/\/$/, '') || null;
function cfProxied(targetUrl: string): string | null {
  if (!CF_PROXY_URL) return null;
  return `${CF_PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;
}

interface DownloadResult {
  filePath: string;
  fileSize: number;
  title?: string;
  authors?: string;
  journal?: string;
  year?: number;
  directUrl?: string;
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
  // Try direct first; fall back to CF proxy if blocked and proxy is configured
  const candidates: Array<{ url: string; label: string }> = [
    { url: pdfUrl, label: 'direct' },
  ];
  const proxied = cfProxied(pdfUrl);
  if (proxied) candidates.push({ url: proxied, label: 'cf-proxy' });

  for (const { url, label } of candidates) {
    try {
      if (label === 'direct') {
        const accessible = await checkPdfAccessible(pdfUrl);
        if (!accessible) {
          console.log(`[download] PDF URL not accessible (403/blocked): ${pdfUrl}`);
          if (!proxied) return null;
          continue; // try proxy
        }
      }

      const pdfRes = await axios.get(url, {
        responseType: 'stream',
        timeout: 20000,
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
        console.log(`[download] file too small (${stat.size}b) [${label}]`);
        continue;
      }

      // PDF 매직바이트 검증 (%PDF-)
      const fd = fs.openSync(filePath, 'r');
      const magic = Buffer.alloc(5);
      fs.readSync(fd, magic, 0, 5, 0);
      fs.closeSync(fd);
      if (magic.toString('ascii') !== '%PDF-') {
        fs.unlinkSync(filePath);
        console.log(`[download] not a real PDF (magic=${magic.toString('ascii').replace(/\n/g,'')}) [${label}]`);
        continue;
      }

      if (label === 'cf-proxy') console.log(`[download] success via CF proxy`);
      return { filePath: `/uploads/${filename}`, fileSize: stat.size };
    } catch (e) {
      if (axios.isAxiosError(e)) {
        console.log(`[download] Failed [${label}]: ${e.response?.status} ${pdfUrl}`);
      }
      // continue to next candidate
    }
  }
  return null;
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


// ─── OpenAIRE Graph API ──────────────────────────────────────────────────────
// EU 지원 연구 중심 OA 저장소 — Graph API v1 (2026-05 이후 신규 엔드포인트)
async function downloadFromOpenAIRE(doi: string): Promise<DownloadResult | null> {
  try {
    const res = await axios.get(
      'https://api.openaire.eu/graph/v1/researchProducts',
      {
        params: {
          doi,
          type: 'publication',
          pageSize: 1,
          format: 'json',
        },
        timeout: 12000,
        headers: {
          'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)',
          'Accept': 'application/json',
        },
      }
    );

    const results: Array<{
      mainTitle?: string;
      publicationDate?: string;
      authors?: Array<{ fullName?: string }>;
      instances?: Array<{
        urls?: string[];
        accessRight?: { code?: string; label?: string };
      }>;
    }> = res.data?.results ?? [];

    if (!results.length) { console.log(`[openaire] Not found: ${doi}`); return null; }

    const paper = results[0];
    const candidates: string[] = [];

    // OPEN 인스턴스(code=c_abf2)의 URL 우선 수집
    const openInstances = (paper.instances ?? []).filter(
      i => i.accessRight?.code === 'c_abf2' || i.accessRight?.label === 'OPEN'
    );
    for (const inst of openInstances) {
      for (const url of inst.urls ?? []) {
        if (url && !candidates.includes(url)) candidates.push(url);
      }
    }
    // 나머지 인스턴스도 시도
    for (const inst of paper.instances ?? []) {
      for (const url of inst.urls ?? []) {
        if (url && !candidates.includes(url)) candidates.push(url);
      }
    }

    const year = paper.publicationDate ? parseInt(paper.publicationDate.slice(0, 4)) : undefined;
    const authors = (paper.authors ?? []).slice(0, 5).map(a => a.fullName ?? '').filter(Boolean).join(', ');

    for (const url of candidates) {
      const result = await downloadFileFromUrl(url, doi, 'openaire_');
      if (result) {
        console.log(`[openaire] ✅ PDF 확보: ${doi}`);
        return { ...result, title: paper.mainTitle, authors, year };
      }
    }
    console.log(`[openaire] No downloadable PDF for ${doi} (${candidates.length} URLs tried)`);
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) console.log(`[openaire] ${e.response?.status} ${e.message}`);
    return null;
  }
}

// ─── OA.mg API ───────────────────────────────────────────────────────────────
// 2.4억 논문 인덱스 — Unpaywall 유사 응답 구조, key 불필요
async function downloadFromOAMG(doi: string): Promise<DownloadResult | null> {
  try {
    const res = await axios.get(
      `https://api.oa.mg/v2/work`,
      {
        params: { doi },
        timeout: 10000,
        headers: {
          'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)',
          'Accept': 'application/json',
        },
      }
    );
    const data = res.data;

    // PDF URL 후보 수집 (best_oa_location 우선)
    const candidates: string[] = [];
    if (data?.best_oa_location?.url_for_pdf) candidates.push(data.best_oa_location.url_for_pdf);
    if (data?.best_oa_location?.url) candidates.push(data.best_oa_location.url);
    for (const loc of data?.oa_locations ?? []) {
      if (loc.url_for_pdf && !candidates.includes(loc.url_for_pdf)) candidates.push(loc.url_for_pdf);
      if (loc.url && !candidates.includes(loc.url)) candidates.push(loc.url);
    }

    if (!candidates.length) { console.log(`[oamg] No OA PDF for ${doi}`); return null; }

    const authors = (data?.z_authors ?? []).slice(0, 5)
      .map((a: { given?: string; family?: string }) => [a.given, a.family].filter(Boolean).join(' '))
      .filter(Boolean).join(', ');

    for (const url of candidates) {
      const result = await downloadFileFromUrl(url, doi, 'oamg_');
      if (result) {
        console.log(`[oamg] ✅ PDF 확보: ${doi}`);
        return {
          ...result,
          title:   data?.title   ?? undefined,
          authors: authors       || undefined,
          year:    data?.year    ?? undefined,
          journal: data?.journal_name ?? undefined,
        };
      }
    }

    // 서버 차단으로 다운로드 불가 — directUrl 반환
    if (candidates.length > 0) {
      console.log(`[oamg] Server download blocked; returning directUrl: ${candidates[0]}`);
      return {
        filePath: '',
        fileSize: 0,
        directUrl: candidates[0],
        title:   data?.title   ?? undefined,
        authors: authors       || undefined,
        year:    data?.year    ?? undefined,
      };
    }
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response?.status === 404) return null;
      console.log(`[oamg] ${e.response?.status} ${e.message}`);
    }
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
    // Use CF proxy for API call if available (fast.wbleb.com blocks Render IPs)
    const directApiUrl = `${API_BASE}/api/v1/paper/${encodeURIComponent(doi)}`;
    const apiUrl = cfProxied(directApiUrl) ?? directApiUrl;
    const apiRes = await axios.get(apiUrl, {
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

// ─── OA: arXiv ──────────────────────────────────────────────────────────────
async function downloadFromArxiv(doi: string): Promise<DownloadResult | null> {
  try {
    const res = await axios.get(
      `https://export.arxiv.org/api/query?search_query=doi:${encodeURIComponent(doi)}&max_results=1`,
      { timeout: 8000, headers: { 'User-Agent': randomUA() } }
    );
    // arXiv Atom XML에서 ID 추출
    const idMatch = (res.data as string).match(/arxiv\.org\/abs\/([\d.]+(?:v\d+)?)/i);
    if (!idMatch) { console.log(`[arxiv] No match for DOI: ${doi}`); return null; }
    const arxivId = idMatch[1].replace(/v\d+$/, '');
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
    console.log(`[arxiv] ${doi} → ${arxivId}: ${pdfUrl}`);
    return await downloadFileFromUrl(pdfUrl, doi, 'arxiv_');
  } catch (e) {
    if (axios.isAxiosError(e)) console.log(`[arxiv] ${e.response?.status} ${e.message}`);
    return null;
  }
}

// ─── OA: Zenodo ─────────────────────────────────────────────────────────────
async function downloadFromZenodo(doi: string): Promise<DownloadResult | null> {
  try {
    const res = await axios.get(
      'https://zenodo.org/api/records',
      {
        timeout: 10000,
        params: { q: `doi:"${doi}"`, size: 3 },
        headers: { 'User-Agent': randomUA() },
      }
    );
    const hits: any[] = res.data?.hits?.hits ?? [];
    if (!hits.length) { console.log(`[zenodo] Not found: ${doi}`); return null; }
    for (const record of hits) {
      const files: any[] = record.files ?? [];
      const pdfFile = files.find((f: any) => f.type === 'pdf' || (f.key as string)?.endsWith('.pdf'));
      const pdfUrl: string | undefined = pdfFile?.links?.self;
      if (!pdfUrl) continue;
      console.log(`[zenodo] ${doi} → ${pdfUrl}`);
      const result = await downloadFileFromUrl(pdfUrl, doi, 'zenodo_');
      if (result) return result;
    }
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) console.log(`[zenodo] ${e.response?.status} ${e.message}`);
    return null;
  }
}

// ─── OA: bioRxiv / medRxiv ──────────────────────────────────────────────────
async function downloadFromBioRxiv(doi: string): Promise<DownloadResult | null> {
  for (const server of ['biorxiv', 'medrxiv'] as const) {
    try {
      const res = await axios.get(
        `https://api.biorxiv.org/details/${server}/${encodeURIComponent(doi)}/na/json`,
        { timeout: 8000, headers: { 'User-Agent': randomUA() } }
      );
      const collection: any[] = res.data?.collection ?? [];
      if (!collection.length) continue;
      // 최신 버전 우선
      const latest = collection.sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))[0];
      const baseUrl = server === 'biorxiv' ? 'https://www.biorxiv.org' : 'https://www.medrxiv.org';
      const pdfUrl = `${baseUrl}/content/${latest.doi}v${latest.version}.full.pdf`;
      console.log(`[${server}] ${doi} → ${pdfUrl}`);
      const result = await downloadFileFromUrl(pdfUrl, doi, `${server}_`);
      if (result) return result;
    } catch (e) {
      if (axios.isAxiosError(e)) console.log(`[${server}] ${e.response?.status} ${e.message}`);
    }
  }
  return null;
}

// ─── Crossref (TDM full-text links) ──────────────────────────────────────────
// 출판사가 메타데이터에 직접 등록한 text-mining 전문(PDF) 링크 — key 불필요.
// 일부 진성 OA 출판사(Frontiers, MDPI, Hindawi 등)는 직접 PDF URL 제공.
async function downloadFromCrossref(doi: string): Promise<DownloadResult | null> {
  try {
    const res = await axios.get(
      `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)',
          'Accept': 'application/json',
        },
      }
    );
    const msg = res.data?.message;
    if (!msg) { console.log(`[crossref] Not found: ${doi}`); return null; }

    const links: Array<{ URL?: string; 'content-type'?: string; 'intended-application'?: string }> =
      msg.link ?? [];
    // PDF content-type 우선, 그다음 text-mining 용도 링크
    const pdfLinks = links.filter(l => l['content-type'] === 'application/pdf');
    const tdmLinks = links.filter(
      l => l['intended-application'] === 'text-mining' && !pdfLinks.includes(l)
    );
    const candidates = [...pdfLinks, ...tdmLinks].map(l => l.URL).filter(Boolean) as string[];
    if (!candidates.length) { console.log(`[crossref] No full-text link for ${doi}`); return null; }

    const title = Array.isArray(msg.title) ? msg.title[0] : msg.title;
    const authors = (msg.author ?? []).slice(0, 5)
      .map((a: { given?: string; family?: string }) => [a.given, a.family].filter(Boolean).join(' '))
      .filter(Boolean).join(', ');
    const year = msg.published?.['date-parts']?.[0]?.[0]
      ?? msg.issued?.['date-parts']?.[0]?.[0];
    const journal = Array.isArray(msg['container-title']) ? msg['container-title'][0] : undefined;

    for (const url of candidates) {
      const result = await downloadFileFromUrl(url, doi, 'crossref_');
      if (result) {
        console.log(`[crossref] ✅ PDF 확보: ${doi}`);
        return { ...result, title, authors: authors || undefined, year, journal };
      }
    }
    console.log(`[crossref] No downloadable PDF for ${doi} (${candidates.length} URLs tried)`);
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response?.status === 404) return null;
      console.log(`[crossref] ${e.response?.status} ${e.message}`);
    }
    return null;
  }
}

// ─── DOAJ (Directory of Open Access Journals) ────────────────────────────────
// 순수 OA 저널 색인 — rate limit 없음, key 불필요. bibjson.link[].type = 'fulltext'.
async function downloadFromDOAJ(doi: string): Promise<DownloadResult | null> {
  try {
    // DOI 내 슬래시는 백슬래시로 이스케이프 (DOAJ 쿼리 문법)
    const escaped = doi.replace(/\//g, '\\/');
    const res = await axios.get(
      `https://doaj.org/api/v4/search/articles/doi:${encodeURIComponent(escaped)}`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)',
          'Accept': 'application/json',
        },
      }
    );
    const results: any[] = res.data?.results ?? [];
    if (!results.length) { console.log(`[doaj] Not found: ${doi}`); return null; }

    const bibjson = results[0].bibjson ?? {};
    const links: Array<{ type?: string; url?: string; content_type?: string }> = bibjson.link ?? [];
    // fulltext 링크 우선
    const candidates = [
      ...links.filter(l => l.type === 'fulltext'),
      ...links.filter(l => l.type !== 'fulltext'),
    ].map(l => l.url).filter(Boolean) as string[];
    if (!candidates.length) { console.log(`[doaj] No fulltext link for ${doi}`); return null; }

    const authors = (bibjson.author ?? []).slice(0, 5)
      .map((a: { name?: string }) => a.name).filter(Boolean).join(', ');
    const year = bibjson.year ? parseInt(bibjson.year) : undefined;
    const journal = bibjson.journal?.title;

    for (const url of candidates) {
      const result = await downloadFileFromUrl(url, doi, 'doaj_');
      if (result) {
        console.log(`[doaj] ✅ PDF 확보: ${doi}`);
        return { ...result, title: bibjson.title, authors: authors || undefined, year, journal };
      }
    }
    console.log(`[doaj] No downloadable PDF for ${doi} (${candidates.length} URLs tried)`);
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response?.status === 404) return null;
      console.log(`[doaj] ${e.response?.status} ${e.message}`);
    }
    return null;
  }
}

// ─── Internet Archive Scholar (fatcat) ───────────────────────────────────────
// IA가 보존한 2,500만+ 논문 전문 — 폐간/오래된 논문에 특히 강함. key 불필요.
async function downloadFromFatcat(doi: string): Promise<DownloadResult | null> {
  try {
    const res = await axios.get(
      `https://api.fatcat.wiki/v0/release/lookup`,
      {
        timeout: 12000,
        params: { doi: doi.toLowerCase(), expand: 'files', hide: 'abstracts,refs' },
        headers: {
          'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)',
          'Accept': 'application/json',
        },
      }
    );
    const rel = res.data;
    if (!rel?.ident) { console.log(`[fatcat] Not found: ${doi}`); return null; }

    const files: any[] = rel.files ?? [];
    const candidates: string[] = [];
    // PDF mimetype 파일 우선, archive.org 호스트 URL 선호
    const pdfFiles = files.filter(f => (f.mimetype ?? '').includes('pdf'));
    for (const f of [...pdfFiles, ...files]) {
      const urls: Array<{ url?: string }> = f.urls ?? [];
      const sorted = urls
        .map(u => u.url)
        .filter(Boolean)
        .sort((a, b) => (b!.includes('archive.org') ? 1 : 0) - (a!.includes('archive.org') ? 1 : 0)) as string[];
      for (const u of sorted) if (!candidates.includes(u)) candidates.push(u);
    }
    if (!candidates.length) { console.log(`[fatcat] No preserved file for ${doi}`); return null; }

    const authors = (rel.contribs ?? []).slice(0, 5)
      .map((c: { raw_name?: string }) => c.raw_name).filter(Boolean).join(', ');

    for (const url of candidates) {
      const result = await downloadFileFromUrl(url, doi, 'fatcat_');
      if (result) {
        console.log(`[fatcat] ✅ PDF 확보: ${doi}`);
        return { ...result, title: rel.title, authors: authors || undefined, year: rel.release_year };
      }
    }
    console.log(`[fatcat] No downloadable PDF for ${doi} (${candidates.length} URLs tried)`);
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response?.status === 404) return null;
      console.log(`[fatcat] ${e.response?.status} ${e.message}`);
    }
    return null;
  }
}

// ─── HAL (Archive ouverte HAL, 프랑스 국립 OA 저장소) ─────────────────────────
// 유럽·프랑스 연구 전문에 강함. fileMain_s = HAL 호스팅 PDF, files_s = 직접 PDF 목록.
async function downloadFromHAL(doi: string): Promise<DownloadResult | null> {
  try {
    const res = await axios.get(
      'https://api.archives-ouvertes.fr/search/',
      {
        timeout: 10000,
        params: {
          q: '*:*',
          fq: `doiId_s:"${doi}"`,
          fl: 'title_s,authFullName_s,producedDateY_i,files_s,fileMain_s',
          wt: 'json',
          rows: 1,
        },
        headers: {
          'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)',
          'Accept': 'application/json',
        },
      }
    );
    const docs: any[] = res.data?.response?.docs ?? [];
    if (!docs.length) { console.log(`[hal] Not found: ${doi}`); return null; }

    const doc = docs[0];
    const candidates: string[] = [];
    for (const u of (doc.files_s ?? []) as string[]) if (u && !candidates.includes(u)) candidates.push(u);
    if (doc.fileMain_s && !candidates.includes(doc.fileMain_s)) candidates.push(doc.fileMain_s);
    if (!candidates.length) { console.log(`[hal] No fulltext for ${doi}`); return null; }

    const title = Array.isArray(doc.title_s) ? doc.title_s[0] : doc.title_s;
    const authors = (doc.authFullName_s ?? []).slice(0, 5).join(', ');
    const year = doc.producedDateY_i;

    for (const url of candidates) {
      const result = await downloadFileFromUrl(url, doi, 'hal_');
      if (result) {
        console.log(`[hal] ✅ PDF 확보: ${doi}`);
        return { ...result, title, authors: authors || undefined, year };
      }
    }
    console.log(`[hal] No downloadable PDF for ${doi} (${candidates.length} URLs tried)`);
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) console.log(`[hal] ${e.response?.status} ${e.message}`);
    return null;
  }
}

// ─── OSF Preprints (api.osf.io) ──────────────────────────────────────────────
// PsyArXiv·SocArXiv·EngrXiv·MetaArXiv 등 다수 프리프린트 커뮤니티 통합. key 불필요.
async function downloadFromOSF(doi: string): Promise<DownloadResult | null> {
  try {
    const res = await axios.get(
      'https://api.osf.io/v2/preprints/',
      {
        timeout: 12000,
        params: { 'filter[doi]': doi, 'page[size]': 1 },
        headers: {
          'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)',
          'Accept': 'application/vnd.api+json',
        },
      }
    );
    const data: any[] = res.data?.data ?? [];
    if (!data.length) { console.log(`[osf] Not found: ${doi}`); return null; }

    const pp = data[0];
    const attrs = pp.attributes ?? {};
    // primary_file 리소스 → links.download 가 실제 PDF
    const fileHref: string | undefined = pp.relationships?.primary_file?.links?.related?.href;
    const candidates: string[] = [];
    if (fileHref) {
      try {
        const fileRes = await axios.get(fileHref, {
          timeout: 10000,
          headers: { 'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)', 'Accept': 'application/vnd.api+json' },
        });
        const dl: string | undefined = fileRes.data?.data?.links?.download;
        if (dl) candidates.push(dl);
      } catch { /* primary_file 조회 실패 시 무시 */ }
    }
    if (attrs.doi && pp.id) candidates.push(`https://osf.io/download/${pp.id}/`);
    if (!candidates.length) { console.log(`[osf] No downloadable file for ${doi}`); return null; }

    const year = attrs.date_published ? parseInt(String(attrs.date_published).slice(0, 4)) : undefined;
    for (const url of candidates) {
      const result = await downloadFileFromUrl(url, doi, 'osf_');
      if (result) {
        console.log(`[osf] ✅ PDF 확보: ${doi}`);
        return { ...result, title: attrs.title, year };
      }
    }
    console.log(`[osf] No downloadable PDF for ${doi} (${candidates.length} URLs tried)`);
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) console.log(`[osf] ${e.response?.status} ${e.message}`);
    return null;
  }
}

// ─── DataCite (api.datacite.org) ─────────────────────────────────────────────
// 데이터셋·학위논문·기관 리포지터리 DOI 다수. contentUrl[] = 직접 파일, url = 랜딩. key 불필요.
async function downloadFromDataCite(doi: string): Promise<DownloadResult | null> {
  try {
    // DataCite는 path에 raw DOI(슬래시 포함)를 그대로 사용
    const res = await axios.get(
      `https://api.datacite.org/dois/${doi}`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)',
          'Accept': 'application/vnd.api+json',
        },
      }
    );
    const attr = res.data?.data?.attributes;
    if (!attr) { console.log(`[datacite] Not found: ${doi}`); return null; }

    const candidates: string[] = [];
    for (const u of (attr.contentUrl ?? []) as string[]) if (u && !candidates.includes(u)) candidates.push(u);
    if (attr.url && !candidates.includes(attr.url)) candidates.push(attr.url);
    if (!candidates.length) { console.log(`[datacite] No content URL for ${doi}`); return null; }

    const title = Array.isArray(attr.titles) ? attr.titles[0]?.title : undefined;
    const authors = (attr.creators ?? []).slice(0, 5)
      .map((c: { name?: string }) => c.name).filter(Boolean).join(', ');
    const year = attr.publicationYear;

    for (const url of candidates) {
      const result = await downloadFileFromUrl(url, doi, 'datacite_');
      if (result) {
        console.log(`[datacite] ✅ PDF 확보: ${doi}`);
        return { ...result, title, authors: authors || undefined, year };
      }
    }
    console.log(`[datacite] No downloadable PDF for ${doi} (${candidates.length} URLs tried)`);
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response?.status === 404) return null;
      console.log(`[datacite] ${e.response?.status} ${e.message}`);
    }
    return null;
  }
}

// ─── KCI (한국연구재단 학술지인용색인) ───────────────────────────────────────
// KCI_API_KEY 필요(미설정 시 건너뜀). KCI는 전문 PDF를 직접 호스팅하지 않아
// 대개 메타데이터/랜딩만 제공 — 직접 PDF가 노출될 때만 다운로드 성공.
async function downloadFromKCI(doi: string): Promise<DownloadResult | null> {
  const apiKey = process.env.KCI_API_KEY;
  if (!apiKey) { console.log('[kci] KCI_API_KEY not set. Skipping.'); return null; }
  try {
    const res = await axios.get(
      'https://open.kci.go.kr/po/openapi/openApiSearch.kci',
      {
        timeout: 12000,
        params: { apiCode: 'articleSearch', key: apiKey, doi },
        headers: { 'User-Agent': randomUA(), 'Accept': 'application/xml' },
      }
    );
    const xml = typeof res.data === 'string' ? res.data : '';
    if (!xml) { console.log(`[kci] Empty response for ${doi}`); return null; }
    const $ = cheerio.load(xml, { xmlMode: true });
    // 직접 PDF 링크가 있을 때만 다운로드(없으면 null로 다음 소스 진행)
    const pdfUrl = $('url:contains(".pdf"), fullTextUrl, pdfUrl').first().text().trim();
    if (!pdfUrl || !/\.pdf/i.test(pdfUrl)) { console.log(`[kci] No direct PDF for ${doi}`); return null; }
    const result = await downloadFileFromUrl(pdfUrl, doi, 'kci_');
    if (result) { console.log(`[kci] ✅ PDF 확보: ${doi}`); return result; }
    return null;
  } catch (e) {
    if (axios.isAxiosError(e)) console.log(`[kci] ${e.response?.status} ${e.message}`);
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

    // 서버 IP 차단(출판사 방화벽)으로 다운로드 실패 — OA URL은 유효하므로 클라이언트에 directUrl 반환
    if (candidates.length > 0) {
      const authors = ((data.authorships || []) as { author?: { display_name?: string } }[])
        .slice(0, 3).map((a) => a.author?.display_name || '').filter(Boolean).join(', ');
      console.log(`[openalex] Server download blocked; returning directUrl: ${candidates[0]}`);
      return {
        filePath: '',
        fileSize: 0,
        directUrl: candidates[0],
        title: data.title || undefined,
        authors: authors || undefined,
        year: data.publication_year || undefined,
      };
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
  _userId: number,
  onProgress?: (msg: string) => void,
  signal?: { cancelled: boolean }
): Promise<DownloadResult> {

  const progress = (msg: string) => { onProgress?.(msg); console.log(`[download] ${msg}`); };
  const checkCancelled = () => {
    if (signal?.cancelled) throw new Error('검색이 중지되었습니다.');
  };

  progress(`🔎 DOI 정보 확인 중...`);

  // ─── Phase 1: Open Access APIs (무료·합법, API key 불필요) ────────────────
  // --- 연도 사전 확인 (2022년 초과 논문은 Sci-Hub 건너뜀) ---
  let paperYear: number | undefined;
  // 1차: Semantic Scholar
  try {
    const meta = await fetchPaperMetadataFromS2(doi);
    paperYear = meta?.year;
  } catch { /* ignore */ }
  // 2차: CrossRef (최신 논문에 S2가 없을 때 대비)
  if (!paperYear) {
    try {
      const cr = await axios.get(
        `https://api.crossref.org/works/${encodeURIComponent(doi)}?select=published`,
        { timeout: 6000 }
      );
      paperYear = cr.data?.message?.published?.['date-parts']?.[0]?.[0];
    } catch { /* ignore */ }
  }
  // 3차: OpenAlex
  if (!paperYear) {
    try {
      const oa = await axios.get(
        `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}?select=publication_year`,
        { timeout: 6000 }
      );
      paperYear = oa.data?.publication_year;
    } catch { /* ignore */ }
  }
  const skipSciHub = paperYear !== undefined && paperYear > 2022;
  // 책/챕터 DOI 판별 — Phase 2 이전에 선언 (Springer: 10.XXXX/978-, Elsevier: 10.XXXX/B978-)
  const isBookChapter = /^10\.\d{4}\/B?978-/.test(doi) || doi.includes('_');
  if (skipSciHub) progress(`[skip] ${paperYear}년 논문 — Sci-Hub 건너뜀 (2022년 이후 미지원)`);

  const oaSources: Array<[string, () => Promise<DownloadResult | null>]> = [
    ['OpenAlex',         () => downloadFromOpenAlex(doi)],
    ['Unpaywall',        () => downloadFromUnpaywall(doi)],
    ['OA.mg',            () => downloadFromOAMG(doi)],
    ['OpenAIRE',         () => downloadFromOpenAIRE(doi)],
    ['Semantic Scholar', () => downloadFromSemanticScholar(doi)],
    ['Europe PMC',       () => downloadFromEuropePMC(doi)],
    ['PMC OA',           () => downloadFromPMC(doi)],
    ['CORE',             () => downloadFromCORE(doi)],
    ['DOAJ',             () => downloadFromDOAJ(doi)],
    ['arXiv',            () => downloadFromArxiv(doi)],
    ['Zenodo',           () => downloadFromZenodo(doi)],
    ['DataCite',         () => downloadFromDataCite(doi)],
    ['bioRxiv/medRxiv',  () => downloadFromBioRxiv(doi)],
    ['OSF Preprints',    () => downloadFromOSF(doi)],
    ['IA Scholar',       () => downloadFromFatcat(doi)],
    ['HAL',              () => downloadFromHAL(doi)],
    ['Crossref TDM',     () => downloadFromCrossref(doi)],
  ];

  for (const [name, fn] of oaSources) {
    checkCancelled();
    progress(`🔍 ${name} 확인 중...`);
    try {
      const r = await fn();
      if (r) { progress(`✅ ${name} — PDF 확보`); return r; }
      progress(`✗ ${name} — 없음`);
    } catch (e) {
      if ((e as Error).message === '검색이 중지되었습니다.') throw e;
      progress(`✗ ${name} — 오류`);
    }
  }

  // ─── Phase 1.5: RISS (국내 기관 학술DB, KCI 논문) ──────────────────────────
  checkCancelled();
  progress(`🔍 RISS 국내 학술DB 확인 중...`);
  try {
    const rissResult = await downloadFromRISS(doi);
    if (rissResult) { progress(`✅ RISS — PDF 확보`); return rissResult; }
    progress(`✗ RISS — 없음`);
  } catch (e) {
    if ((e as Error).message === '검색이 중지되었습니다.') throw e;
    progress(`✗ RISS — 오류`);
  }

  // ─── Phase 1.6: KCI (국내 학술 API — API 키 필요 시에만 동작) ───
  for (const [name, fn] of [
    ['KCI',       () => downloadFromKCI(doi)],
  ] as Array<[string, () => Promise<DownloadResult | null>]>) {
    checkCancelled();
    progress(`🔍 ${name} 확인 중...`);
    try {
      const r = await fn();
      if (r) { progress(`✅ ${name} — PDF 확보`); return r; }
      progress(`✗ ${name} — 없음`);
    } catch (e) {
      if ((e as Error).message === '검색이 중지되었습니다.') throw e;
      progress(`✗ ${name} — 오류`);
    }
  }

  // ─── Phase 2: Sci-Hub.run API (CF proxy 경유 — Render IP 차단 우회) ──────────────
  // CF_PROXY_URL 환경변수가 설정된 경우에만 활성화
  if (!skipSciHub && !isBookChapter && CF_PROXY_URL) {
    const { rows: runRows } = await pool.query(
      `SELECT id, name, url, type, status, avg_latency FROM download_servers WHERE url LIKE '%sci-hub.run%' AND is_active = true LIMIT 1`
    );
    if (runRows.length > 0) {
      checkCancelled();
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
  }

  // ─── Phase 3: 병렬 미러 (sci-hub) — cloudscraper는 CF proxy 우회 불가,
  //              현재 비활성화. CF Worker + headless-fetch 방식 지원 시 재활성화 예정.

  // ─── 최종 폴백 ──────────────────────────────────────────────────────────────────
  if (skipSciHub) {
    // 2023+ 논문: Sci-Hub 미지원 — 출판사/DOI 페이지로 안내
    progress(`⚠️ 무료 전문을 찾을 수 없습니다. 출판사 사이트를 확인해보세요.`);
    return { filePath: '', fileSize: 0, directUrl: `https://doi.org/${doi}` };
  }
  progress(`⚠️ 무료 전문을 찾을 수 없습니다. 출판사 사이트를 확인해보세요.`);
  return { filePath: '', fileSize: 0, directUrl: `https://doi.org/${doi}` };
}
// OA sources: OpenAlex, Unpaywall, OA.mg, OpenAIRE, Semantic Scholar, Europe PMC,
// PMC OA, CORE, DOAJ, arXiv, Zenodo, DataCite, bioRxiv/medRxiv, OSF, IA Scholar, HAL,
// Crossref TDM, KCI(키)
