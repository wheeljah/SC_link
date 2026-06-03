// 직접 downloadService를 호출해서 DOI 다운로드 테스트
require('dotenv').config();
const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/scholarlink';
const pool = new Pool({ connectionString: dbUrl, connectionTimeoutMillis: 10000 });

async function main() {
  try {
    // 테스트용 유저 ID 가져오기 (가장 첫 번째 유저)
    const userResult = await pool.query('SELECT id, email FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.error('테스트용 유저가 없습니다. 먼저 회원가입하세요.');
      await pool.end();
      process.exit(1);
    }
    const testUserId = userResult.rows[0].id;
    console.log(`테스트 유저: ID=${testUserId}, email=${userResult.rows[0].email}`);

    // downloadService 동적 임포트
    process.chdir(__dirname);
    const { downloadPaper } = await import('./src/services/downloadService.js');

    const dois = [
      '10.1016/j.cellimm.2004.06.005',
      '10.1007/s13668-023-00492-x'
    ];

    for (const doi of dois) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📥 테스트 시작: ${doi}`);
      console.log('='.repeat(60));
      const startTime = Date.now();
      try {
        const result = await downloadPaper(doi, testUserId, 3);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n✅ 성공!`);
        console.log(`   파일: ${result.filePath}`);
        console.log(`   크기: ${(result.fileSize / 1024).toFixed(1)} KB`);
        console.log(`   소요: ${elapsed}s`);
      } catch (err) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n❌ 실패: ${err.message}`);
        console.log(`   소요: ${elapsed}s`);
      }
    }

    await pool.end();
    console.log('\n✅ 전체 테스트 완료');
  } catch (e) {
    console.error('Fatal error:', e.message);
    await pool.end();
    process.exit(1);
  }
}

main();
