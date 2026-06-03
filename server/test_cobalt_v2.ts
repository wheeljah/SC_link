import 'dotenv/config';
import { getCobaltPaperMetrics } from './src/services/cobaltParserService';

(async () => {
  console.log('=== Test: Cobalt article metrics ===\n');
  const m = await getCobaltPaperMetrics('10.1038/s41576-019-0205-4');
  if (m) {
    console.log('Result:', JSON.stringify(m, null, 2));
  } else {
    console.log('No result (check COBALT_SESSION_COOKIE)');
  }
})().catch(e => console.log('Error:', e.message));