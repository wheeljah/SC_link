import 'dotenv/config';
import { getCobaltPaperMetrics, enrichDOIs, getJournalMetricsByISSN } from './src/services/cobaltParserService';

async function test() {
  console.log('=== Test 1: DOI lookup ===');
  const m = await getCobaltPaperMetrics('10.1038/s41576-019-0205-4');
  console.log(m ? JSON.stringify(m, null, 2) : 'Not found');

  console.log('\n=== Test 2: ISSN journal metrics ===');
  const j = await getJournalMetricsByISSN('0959-8138'); // BMJ
  console.log(j ? JSON.stringify(j, null, 2) : 'Journal not found');

  console.log('\n=== Test 3: Batch enrichment ===');
  const results = await enrichDOIs([
    '10.1038/s41576-019-0205-4',
    '10.1007/s11306-025-02345-w',
  ]);
  console.table(results);
}

test().catch(e => console.log('Fatal:', e.message));
