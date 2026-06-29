// Quick smoke test for citationService buildCitationGraph
// 실제 DOI로 OpenAlex 호출 → DB 캐시 → 응답 확인

import { buildCitationGraph } from '../src/services/citationService';

async function main() {
  const doi = process.argv[2] || '10.1038/nature14539';  // Deep learning (LeCun, Bengio, Hinton)
  console.log(`Testing citation graph build for DOI: ${doi}`);
  console.log('---');

  const start = Date.now();
  try {
    const data = await buildCitationGraph({
      seedDoi: doi,
      depth: 1,
      maxNodes: 30,
      direction: 'both',
    });
    const elapsed = Date.now() - start;
    console.log(`✅ Success in ${elapsed}ms (internal buildTime: ${data.stats.buildTimeMs}ms)`);
    console.log(`   Seed: ${data.seedId}`);
    console.log(`   Nodes: ${data.nodes.length}`);
    console.log(`   Edges: ${data.edges.length}`);
    console.log(`   Stats: downloadable=${data.stats.downloadableCount}, partial=${data.stats.partialCount}, paid=${data.stats.paidCount}, inCollection=${data.stats.inCollectionCount}`);
    console.log(`   From cache: ${data.stats.fromCache}`);
    console.log('---');
    console.log('Top 5 nodes by citation count:');
    const top = [...data.nodes].sort((a, b) => b.citationCount - a.citationCount).slice(0, 5);
    for (const n of top) {
      console.log(`  - [${n.accessStatus}] ${n.title.slice(0, 60)} (${n.year || '?'}) — cited ${n.citationCount}×`);
    }
  } catch (e) {
    console.error('❌ Error:', (e as Error).message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
