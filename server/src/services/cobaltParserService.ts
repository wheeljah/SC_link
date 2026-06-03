/**
 * Cobalt (colab.ws) Parser
 *
 * Direct article pages: https://colab.ws/articles/{doi}
 * Direct journal pages:  https://colab.ws/journals/{journal_id}
 *
 * Both are SSR pages — no API calls needed, just scrape the rendered HTML.
 * Requires COBALT_SESSION_COOKIE (colab_session cookie from .colab.ws).
 *
 * Quick test: browse to https://colab.ws/articles/10.1038/s41576-019-0205-4
 *   → "ЦИТИРУЕТСЯ В 1064" (citations), article references (186)
 *   → Journal links to https://colab.ws/journals/13955
 *   → Journal page shows: SJR 20.403, IF 52, CiteScore 57.7, Q1
 */

import 'dotenv/config';
import puppeteer from 'puppeteer';

export interface CobaltPaperMetrics {
  doi: string;
  title?: string;
  citationCount?: number;
  articleReferences?: number;
  sjrQuartile?: string | null;
  sjrValue?: number;
  citescore?: number;
  impactFactor?: number;
  journalName?: string;
  journalId?: string;
  issn?: string;
  year?: number;
  source: 'cobalt';
}

export interface EnrichmentResult {
  doi: string;
  citationCount?: number;
  sjrQuartile?: string | null;
  sjrValue?: number;
  citescore?: number;
  journalName?: string;
  found: boolean;
}

const SESSION_COOKIE = process.env.COBALT_SESSION_COOKIE || '';
const COBALT_BASE = 'https://colab.ws';

if (!SESSION_COOKIE) {
  console.warn('[cobalt] COBALT_SESSION_COOKIE not set — parser disabled. Set it in .env to enable.');
}

async function getBrowser() {
  const { default: puppeteer } = await import('puppeteer');
  return puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
    ],
  });
}

async function getPage(browser: Awaited<ReturnType<typeof getBrowser>>, url: string): Promise<{ text: string; url: string } | null> {
  if (!SESSION_COOKIE) return null;

  const page = await browser.newPage();
  try {
    // Stealth: hide automation
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8' });

    // Set ALL known cookies from the session
    const cookies = [
      { name: 'colab_session', value: SESSION_COOKIE, domain: '.colab.ws', path: '/', httpOnly: true, secure: true },
      { name: 'colab_ws_locale', value: 'en', domain: '.colab.ws', path: '/' },
    ];
    await page.setCookie(...cookies);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });

    // Cloudflare challenge page — wait for it to resolve
    let attempts = 0;
    while (attempts < 5) {
      const text = await page.evaluate(() => document.body.innerText);
      if (!text.includes('Checking your browser') && !text.includes('cf-challenge') && !text.includes('Please wait')) break;
      console.log(`[cobalt] CF challenge, waiting (attempt ${attempts + 1}/5)...`);
      await new Promise(r => setTimeout(r, 5000));
      attempts++;
    }

    const finalText = await page.evaluate(() => document.body.innerText);
    return { text: finalText, url: page.url() };
  } catch (e) {
    console.error('[cobalt] Page load failed:', (e as Error).message);
    return null;
  } finally {
    await page.close();
  }
}

// ── Parse article page ────────────────────────────────────────────────────────

function parseArticleMetrics(text: string, doi: string): { citations: number; references: number; title: string; journalId: string | null; year: number | null } {
  // Title: first long line (>40 chars) that appears BEFORE author names (not "Gene Therapy Center", "Department", etc.)
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 10);

  // Keywords that signal a non-title line (affiliations, metadata, UI)
  const nonTitleKeywords = /^(RU|EN|Q[1-4]|SCIMAGO|SJR|CiteScore|ISSN|Impact|doi|http|Выдан|Genetics|Molecular|Biochemistry|Medicine|Gene Therapy Center|Department|Publishing|страницы|том|издание|Принято|Submitted|Keywords)/i;

  let title = '';
  for (const line of lines) {
    if (line.length > 40 && line.length < 250 && !nonTitleKeywords.test(line)) {
      title = line;
      break;
    }
  }

  // Citations: "ЦИТИРУЕТСЯ В 1064" or "cited by 1064"
  const citeMatch = text.match(/(?:ЦИТИРУЕТСЯ[^\d]*|cited\s+(?:by|in)[\s:]*|Citations?:?\s*)(\d[\d\s]*)/i);
  let citations = 0;
  if (citeMatch) {
    citations = parseInt(citeMatch[1].replace(/[\s,]/g, ''), 10);
  }

  // References: "ПРИСТАТЕЙНЫЕ ССЫЛКИ 186" or similar
  const refMatch = text.match(/(?:ПРИСТАТЕЙНЫЕ\s+ССЫЛКИ|References?|reference[s]?[\s:]*|Статей[\s:]*)\s*(\d+)/i);
  const references = refMatch ? parseInt(refMatch[1], 10) : 0;

  // Journal ID from URL pattern in text (e.g. /journals/13955)
  const journalIdMatch = text.match(/\/journals\/(\d+)/i);
  const journalId = journalIdMatch ? journalIdMatch[1] : null;

  // Year from publication date
  const yearMatch = text.match(/Дата публикации[:\s]*(\d{4}-\d{2}-\d{2})|Publish(?:ed|ing)[:\s]*(20\d{2})|(\d{4}-\d{2}-\d{2})/i);
  let year: number | null = null;
  if (yearMatch) {
    const y = yearMatch[1] || yearMatch[2] || yearMatch[3];
    if (y) year = parseInt(y.substring(0, 4), 10);
  }
  // Fallback: any 4-digit year in range
  if (!year) {
    const fallbackYear = text.match(/\b(20\d{2})\b/);
    year = fallbackYear ? parseInt(fallbackYear[1], 10) : null;
  }

  return { citations, references, title, journalId, year };
}

// ── Parse journal page ────────────────────────────────────────────────────────

function parseJournalMetrics(text: string): { sjrQuartile: string | null; sjrValue: number; citescore: number; impactFactor: number; journalName: string; issn: string | null } {
  // Journal name: first line that isn't menu text
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  let journalName = '';
  for (const line of lines) {
    if (line.length > 5 && !/^(RU|EN|Q[1-4]|SCIMAGO|SJR|CiteScore|ISSN|Impact|doi|http|Выдан|Принято|Submitted)/i.test(line) && !/^\d+$/.test(line)) {
      journalName = line;
      break;
    }
  }

  // SJR value
  const sjrMatch = text.match(/(?:SJR|шрж)\s+([\d,]+\.?\d*)/i);
  const sjrValue = sjrMatch ? parseFloat(sjrMatch[1].replace(/,/g, '')) : 0;

  // Impact Factor
  const ifMatch = text.match(/(?:Impact\s*factor|IF)\s+([\d,]+\.?\d*)/i);
  const impactFactor = ifMatch ? parseFloat(ifMatch[1].replace(/,/g, '')) : 0;

  // CiteScore
  const csMatch = text.match(/(?:CiteScore|citescore)\s+([\d,]+\.?\d*)/i);
  const citescore = csMatch ? parseFloat(csMatch[1].replace(/,/g, '')) : 0;

  // Quartile
  const qMatch = text.match(/\b(Q[1-4])\b/i);
  const sjrQuartile = qMatch ? qMatch[1].toUpperCase() : null;

  // ISSN
  const issnMatch = text.match(/ISSN[:\s]*([\d]{4}-[\dXx]{4})/i);
  const issn = issnMatch ? issnMatch[1] : null;

  return { sjrQuartile, sjrValue, citescore, impactFactor, journalName, issn };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch paper metrics from Cobalt by DOI.
 * Requires COBALT_SESSION_COOKIE env var.
 */
export async function getCobaltPaperMetrics(doi: string): Promise<CobaltPaperMetrics | null> {
  if (!SESSION_COOKIE) return null;

  const cleanDoi = doi.trim();
  const browser = await getBrowser();

  try {
    // 1. Get article page (direct, no search needed)
    const articleResult = await getPage(browser, `${COBALT_BASE}/articles/${cleanDoi}?locale=en`);
    if (!articleResult) return null;

    const article = parseArticleMetrics(articleResult.text, cleanDoi);
    if (!article.citations && !article.references && !article.title) {
      return null; // probably not found or not logged in
    }

    // 2. Get journal page if we have a journal ID
    let journalMetrics = { sjrQuartile: null as string | null, sjrValue: 0, citescore: 0, impactFactor: 0, journalName: '', issn: '' as string | null };
    if (article.journalId) {
      const journalResult = await getPage(browser, `${COBALT_BASE}/journals/${article.journalId}?locale=en`);
      if (journalResult) {
        journalMetrics = parseJournalMetrics(journalResult.text);
      }
    }

    return {
      doi: cleanDoi,
      title: article.title || undefined,
      citationCount: article.citations || undefined,
      articleReferences: article.references || undefined,
      sjrQuartile: journalMetrics.sjrQuartile || undefined,
      sjrValue: journalMetrics.sjrValue || undefined,
      citescore: journalMetrics.citescore || undefined,
      impactFactor: journalMetrics.impactFactor || undefined,
      journalName: journalMetrics.journalName || undefined,
      journalId: article.journalId || undefined,
      issn: journalMetrics.issn || undefined,
      year: article.year || undefined,
      source: 'cobalt',
    };
  } finally {
    await browser.close();
  }
}

/**
 * Get journal metrics by journal ID or ISSN.
 */
export async function getCobaltJournalMetrics(identifier: string): Promise<{
  sjrQuartile: string | null;
  sjrValue: number;
  citescore: number;
  impactFactor: number;
  journalName: string;
  issn: string | null;
} | null> {
  if (!SESSION_COOKIE) return null;

  const browser = await getBrowser();
  try {
    // Try as journal ID first (numeric), then as ISSN
    const url = /^\d+$/.test(identifier)
      ? `${COBALT_BASE}/journals/${identifier}?locale=en`
      : `${COBALT_BASE}/journals?issn=${encodeURIComponent(identifier)}`;

    const result = await getPage(browser, url);
    if (!result) return null;

    const metrics = parseJournalMetrics(result.text);
    if (!metrics.sjrValue && !metrics.journalName) return null;

    return metrics;
  } finally {
    await browser.close();
  }
}

// Convenience alias
export { getCobaltPaperMetrics as cobaltParser };
export default { getCobaltPaperMetrics, getCobaltJournalMetrics };