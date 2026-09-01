export interface PaperRecord {
  title: string;
  authors: string[];
  journal?: string;
  year?: number;
  doi?: string;
  abstract?: string;
  landingUrl: string;
  openAccessUrl?: string;
  openAccessSource?: string;
}

const DOI_PATTERN = /10\.\d{4,9}\/[\-._;()/:A-Z0-9]+/i;
const ARXIV_PATTERN = /(?:arxiv:)?(\d{4}\.\d{4,5}(?:v\d+)?)/i;
const PMID_PATTERN = /^(?:pmid:\s*)?(\d{6,10})$/i;

function stripHtml(value?: string): string | undefined {
  return value?.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function yearFromParts(parts?: number[][]): number | undefined {
  return parts?.[0]?.[0];
}

function extractDoi(input: string): string | undefined {
  return input.match(DOI_PATTERN)?.[0]?.replace(/[.,;]+$/, '');
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`검색 소스 응답 오류 (${response.status})`);
  return response.json() as Promise<T>;
}

async function enrichOpenAccess(record: PaperRecord): Promise<PaperRecord> {
  if (!record.doi) return record;
  try {
    const data = await fetchJson<{
      open_access?: { oa_url?: string | null };
      best_oa_location?: { pdf_url?: string | null; landing_page_url?: string | null; source?: { display_name?: string | null } | null } | null;
    }>(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(record.doi)}`);
    const location = data.best_oa_location;
    const openAccessUrl = data.open_access?.oa_url ?? location?.pdf_url ?? location?.landing_page_url ?? undefined;
    return openAccessUrl
      ? { ...record, openAccessUrl, openAccessSource: location?.source?.display_name ?? 'OpenAlex' }
      : record;
  } catch {
    return record;
  }
}

async function searchCrossref(query: string, doi?: string): Promise<PaperRecord> {
  type CrossrefWork = {
    title?: string[];
    author?: Array<{ given?: string; family?: string }>;
    'container-title'?: string[];
    published?: { 'date-parts'?: number[][] };
    issued?: { 'date-parts'?: number[][] };
    DOI?: string;
    URL?: string;
    abstract?: string;
  };
  const url = doi
    ? `https://api.crossref.org/works/${encodeURIComponent(doi)}`
    : `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=1&select=DOI,title,author,container-title,published,issued,URL,abstract`;
  const payload = await fetchJson<{ message: CrossrefWork | { items?: CrossrefWork[] } }>(url);
  const message = payload.message;
  const work = ('items' in message ? message.items?.[0] : message) as CrossrefWork | undefined;
  if (!work?.title?.[0]) throw new Error('논문 정보를 찾지 못했습니다. DOI 또는 제목을 다시 확인해주세요.');
  const resolvedDoi = work.DOI ?? doi;
  return enrichOpenAccess({
    title: work.title[0],
    authors: work.author?.map(author => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean) ?? [],
    journal: work['container-title']?.[0],
    year: yearFromParts(work.published?.['date-parts']) ?? yearFromParts(work.issued?.['date-parts']),
    doi: resolvedDoi,
    abstract: stripHtml(work.abstract),
    landingUrl: work.URL ?? (resolvedDoi ? `https://doi.org/${resolvedDoi}` : 'https://search.crossref.org/'),
  });
}

async function searchPubMed(pmid: string): Promise<PaperRecord> {
  const data = await fetchJson<{ result: Record<string, { title?: string; authors?: Array<{ name?: string }>; fulljournalname?: string; pubdate?: string; articleids?: Array<{ idtype?: string; value?: string }> }> }>(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${encodeURIComponent(pmid)}&retmode=json`,
  );
  const work = data.result[pmid];
  if (!work?.title) throw new Error('PubMed 논문 정보를 찾지 못했습니다.');
  const pmc = work.articleids?.find(item => item.idtype === 'pmc')?.value;
  return {
    title: work.title,
    authors: work.authors?.map(author => author.name ?? '').filter(Boolean) ?? [],
    journal: work.fulljournalname,
    year: Number(work.pubdate?.match(/\d{4}/)?.[0]) || undefined,
    landingUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    openAccessUrl: pmc ? `https://pmc.ncbi.nlm.nih.gov/articles/${pmc}/pdf/` : undefined,
    openAccessSource: pmc ? 'PubMed Central' : undefined,
  };
}

export async function searchOpenAccessPaper(input: string): Promise<PaperRecord> {
  const normalized = input.trim();
  if (!normalized) throw new Error('DOI, PMID, arXiv ID 또는 논문 제목을 입력해주세요.');
  const arxiv = normalized.match(ARXIV_PATTERN)?.[1];
  if (arxiv) return { title: `arXiv:${arxiv}`, authors: [], landingUrl: `https://arxiv.org/abs/${arxiv}`, openAccessUrl: `https://arxiv.org/pdf/${arxiv}.pdf`, openAccessSource: 'arXiv' };
  const pmid = normalized.match(PMID_PATTERN)?.[1];
  if (pmid) return searchPubMed(pmid);
  return searchCrossref(normalized, extractDoi(normalized));
}
