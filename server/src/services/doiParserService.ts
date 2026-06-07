export interface ParsedInput {
  type: 'doi' | 'pmid' | 'arxiv' | 'url' | 'title' | 'unknown';
  value: string;
  doi?: string;
}

const DOI_REGEX = /\b(10\.\d{4,}(?:\.\d+)*\/\S+)/i;
const PMID_REGEX = /(?:PMID|PubMed[:\s]+)(\d+)/i;
const ARXIV_REGEX = /(?:arXiv[:\s]+|arxiv\.org\/abs\/)(\d{4}\.\d{4,5}(?:v\d+)?)/i;
const DOI_URL_REGEX = /(?:doi\.org|dx\.doi\.org)\/(.+)/i;

export function parseInput(raw: string): ParsedInput {
  const input = raw.trim();

  // DOI URL (doi.org/...)
  const doiUrlMatch = input.match(DOI_URL_REGEX);
  if (doiUrlMatch) {
    return { type: 'doi', value: doiUrlMatch[1], doi: doiUrlMatch[1] };
  }

  // 순수 DOI (10.XXXX/...)
  const doiMatch = input.match(DOI_REGEX);
  if (doiMatch) {
    return { type: 'doi', value: doiMatch[1], doi: doiMatch[1] };
  }

  // PubMed ID
  const pmidMatch = input.match(PMID_REGEX);
  if (pmidMatch) {
    return { type: 'pmid', value: pmidMatch[1] };
  }

  // arXiv ID
  const arxivMatch = input.match(ARXIV_REGEX);
  if (arxivMatch) {
    return { type: 'arxiv', value: arxivMatch[1] };
  }

  // URL (저널 페이지 등)
  try {
    const url = new URL(input);
    // URL 내부에서 DOI 재탐색
    const inUrl = input.match(DOI_REGEX);
    if (inUrl) {
      return { type: 'doi', value: inUrl[1], doi: inUrl[1] };
    }
    return { type: 'url', value: url.href };
  } catch {
    // no-op
  }

  // 논문 제목으로 간주 (길이 10자 이상, 공백 포함)
  if (input.length >= 10 && input.includes(' ')) {
    return { type: 'title', value: input };
  }

  return { type: 'unknown', value: input };
}

export async function resolvePmidToDoi(pmid: string): Promise<string | null> {
  try {
    const axios = (await import('axios')).default;
    const res = await axios.get(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`,
      { params: { db: 'pubmed', id: pmid, retmode: 'json' }, timeout: 8000 }
    );
    const result = res.data?.result?.[pmid];
    const doi = result?.articleids?.find((a: { idtype: string; value: string }) => a.idtype === 'doi')?.value;
    return doi || null;
  } catch {
    return null;
  }
}

export async function resolveArxivToDoi(arxivId: string): Promise<string | null> {
  try {
    const axios = (await import('axios')).default;
    const res = await axios.get(
      `https://export.arxiv.org/abs/${arxivId}`,
      { timeout: 8000 }
    );
    const doiMatch = res.data?.match(/doi\.org\/(10\.[^"'\s<>]+)/i);
    return doiMatch ? doiMatch[1] : null;
  } catch {
    return null;
  }
}

export async function resolveTitleToDoi(title: string): Promise<{ doi: string; resolvedTitle: string; openAccessPdfUrl?: string } | null> {
  const axios = (await import('axios')).default;

  // ① Semantic Scholar paper/search (학술 논문 정확도 높음)
  try {
    const s2Res = await axios.get(
      'https://api.semanticscholar.org/graph/v1/paper/search',
      {
        params: {
          query: title,
          limit: 3,
          fields: 'externalIds,title,openAccessPdf,year,authors',
        },
        timeout: 10000,
        headers: { 'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)' },
      }
    );
    const s2Items = s2Res.data?.data as Array<{
      externalIds?: { DOI?: string };
      title?: string;
      openAccessPdf?: { url?: string };
    }> | undefined;
    const s2Best = s2Items?.find(p => p.externalIds?.DOI);
    if (s2Best?.externalIds?.DOI) {
      return {
        doi: s2Best.externalIds.DOI,
        resolvedTitle: s2Best.title ?? title,
        openAccessPdfUrl: s2Best.openAccessPdf?.url,
      };
    }
  } catch { /* fallback */ }

  // ② CrossRef fallback
  try {
    const crRes = await axios.get('https://api.crossref.org/works', {
      params: {
        'query.bibliographic': title,
        rows: 3,
        select: 'DOI,title,author,published',
      },
      timeout: 10000,
      headers: { 'User-Agent': 'ScholarLink/1.0 (mailto:support@scholarlink.app)' },
    });
    const items = crRes.data?.message?.items;
    if (!items?.length) return null;
    const best = items[0];
    return { doi: best.DOI as string, resolvedTitle: (best.title?.[0] as string) ?? title };
  } catch {
    return null;
  }
}
