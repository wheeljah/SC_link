export interface OpenAccessLink {
  source: string;
  url: string;
}

export interface PaperRecord {
  title: string;
  authors: string[];
  journal?: string;
  year?: number;
  doi?: string;
  abstract?: string;
  landingUrl: string;
  openAccessLinks: OpenAccessLink[];
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

function addAccessLink(links: OpenAccessLink[], source: string, url?: string | null): OpenAccessLink[] {
  if (!url || links.some(link => link.url === url)) return links;
  return [...links, { source, url }];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`검색 소스 응답 오류 (${response.status})`);
  return response.json() as Promise<T>;
}

async function enrichOpenAccess(record: PaperRecord): Promise<PaperRecord> {
  if (!record.doi) return record;

  const [openAlex, semanticScholar, europePmc] = await Promise.allSettled([
    fetchJson<{
      best_oa_location?: { pdf_url?: string | null; landing_page_url?: string | null; source?: { display_name?: string | null } | null } | null;
      locations?: Array<{ pdf_url?: string | null; landing_page_url?: string | null; is_oa?: boolean; source?: { display_name?: string | null } | null }>;
    }>(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(record.doi)}`),
    fetchJson<{ openAccessPdf?: { url?: string | null } | null }>(
      `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(record.doi)}?fields=openAccessPdf`,
    ),
    fetchJson<{ resultList?: { result?: Array<{ isOpenAccess?: string; pmcid?: string }> } }>(
      `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:${encodeURIComponent(record.doi)}&format=json&pageSize=1`,
    ),
  ]);

  let openAccessLinks = record.openAccessLinks;
  if (openAlex.status === 'fulfilled') {
    const locations = [openAlex.value.best_oa_location, ...(openAlex.value.locations ?? []).filter(location => location.is_oa)];
    for (const location of locations) {
      openAccessLinks = addAccessLink(
        openAccessLinks,
        location?.source?.display_name ?? 'OpenAlex',
        location?.pdf_url ?? location?.landing_page_url,
      );
    }
  }
  if (semanticScholar.status === 'fulfilled') {
    openAccessLinks = addAccessLink(openAccessLinks, 'Semantic Scholar', semanticScholar.value.openAccessPdf?.url);
  }
  if (europePmc.status === 'fulfilled') {
    const result = europePmc.value.resultList?.result?.[0];
    if (result?.isOpenAccess === 'Y' && result.pmcid) {
      openAccessLinks = addAccessLink(openAccessLinks, 'Europe PMC', `https://europepmc.org/articles/${result.pmcid}?pdf=render`);
    }
  }
  return { ...record, openAccessLinks };
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
    link?: Array<{ URL?: string; 'content-type'?: string }>;
  };
  const url = doi
    ? `https://api.crossref.org/works/${encodeURIComponent(doi)}`
    : `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(query)}&rows=1&select=DOI,title,author,container-title,published,issued,URL,abstract,link`;
  const payload = await fetchJson<{ message: CrossrefWork | { items?: CrossrefWork[] } }>(url);
  const message = payload.message;
  const work = ('items' in message ? message.items?.[0] : message) as CrossrefWork | undefined;
  if (!work?.title?.[0]) throw new Error('논문 정보를 찾지 못했습니다. DOI 또는 제목을 다시 확인해주세요.');
  const resolvedDoi = work.DOI ?? doi;
  const openAccessLinks = (work.link ?? [])
    .filter(link => link['content-type']?.includes('pdf'))
    .reduce((links, link) => addAccessLink(links, 'Crossref 제공 PDF', link.URL), [] as OpenAccessLink[]);
  return enrichOpenAccess({
    title: work.title[0],
    authors: work.author?.map(author => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean) ?? [],
    journal: work['container-title']?.[0],
    year: yearFromParts(work.published?.['date-parts']) ?? yearFromParts(work.issued?.['date-parts']),
    doi: resolvedDoi,
    abstract: stripHtml(work.abstract),
    landingUrl: work.URL ?? (resolvedDoi ? `https://doi.org/${resolvedDoi}` : 'https://search.crossref.org/'),
    openAccessLinks,
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
    openAccessLinks: pmc ? [{ source: 'PubMed Central', url: `https://pmc.ncbi.nlm.nih.gov/articles/${pmc}/pdf/` }] : [],
  };
}

export async function searchOpenAccessPaper(input: string): Promise<PaperRecord> {
  const normalized = input.trim();
  if (!normalized) throw new Error('DOI, PMID, arXiv ID 또는 논문 제목을 입력해주세요.');
  const arxiv = normalized.match(ARXIV_PATTERN)?.[1];
  if (arxiv) {
    return {
      title: `arXiv:${arxiv}`,
      authors: [],
      landingUrl: `https://arxiv.org/abs/${arxiv}`,
      openAccessLinks: [{ source: 'arXiv', url: `https://arxiv.org/pdf/${arxiv}.pdf` }],
    };
  }
  const pmid = normalized.match(PMID_PATTERN)?.[1];
  if (pmid) return searchPubMed(pmid);
  return searchCrossref(normalized, extractDoi(normalized));
}
