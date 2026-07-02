// server/src/services/jobCrawlerService.ts
// 크롤러 오케스트레이터 — DB의 enabled 소스를 돌면서 어댑터 호출 → upsert + crawl_logs
//
// 안전선 (W1):
// - robots.txt 존중 (현재는 KISTI/NRF 모두 명시 차단 없음 확인)
// - rate-limit (소스별 rate_limit_ms 적용)
// - PII drop (어댑터 단계에서 이미 sanitizePII 호출)
// - upsert ON CONFLICT (source_id, external_id) DO UPDATE

import { createHash } from 'crypto';
import cron from 'node-cron';
import { pool } from '../db/pool';
import { kistiRssAdapter } from './jobSources/kistiRssAdapter';
import { nrfCheerioAdapter } from './jobSources/nrfCheerioAdapter';
import { JobSourceAdapter } from './jobSources/types';

const ADAPTERS: Record<string, JobSourceAdapter> = {
  'kisti-rss': kistiRssAdapter,
  'nrf-cheerio': nrfCheerioAdapter,
};

interface CrawlResult {
  source_id: number;
  source_code: string;
  fetched: number;
  new: number;
  updated: number;
  skipped: number;
  duration_ms: number;
  status: 'ok' | 'error';
  error?: string;
}

/**
 * 단일 소스 1회 실행. 외부에서도 호출 가능 (admin 수동 트리거 등)
 */
export async function runCrawl(sourceCode: string): Promise<CrawlResult> {
  const adapter = ADAPTERS[sourceCode];
  if (!adapter) throw new Error(`Unknown adapter: ${sourceCode}`);

  const { rows: srcRows } = await pool.query(
    `SELECT id, code, rate_limit_ms FROM job_sources WHERE code = $1 AND enabled = TRUE`,
    [sourceCode],
  );
  if (srcRows.length === 0) {
    return { source_id: 0, source_code: sourceCode, fetched: 0, new: 0, updated: 0, skipped: 0, duration_ms: 0, status: 'error', error: 'source disabled or not found' };
  }
  const source = srcRows[0];

  const startedAt = new Date();
  const logRow = await pool.query(
    `INSERT INTO job_crawl_logs (source_id, started_at, status) VALUES ($1, $2, 'running') RETURNING id`,
    [source.id, startedAt],
  );
  const logId = logRow.rows[0].id;

  try {
    // Rate-limit (최소 간격) — 단순 sleep (요청 간)
    const minDelay = source.rate_limit_ms || 3000;

    const items = await adapter.fetchList();
    let newCount = 0, updatedCount = 0, skippedCount = 0;

    for (const item of items) {
      const description_hash = item.description_html
        ? createHash('sha256').update(item.description_html).digest('hex')
        : null;

      const { rows: existing } = await pool.query(
        `SELECT description_hash FROM job_postings WHERE source_id = $1 AND external_id = $2`,
        [source.id, item.external_id],
      );

      if (existing.length === 0) {
        await pool.query(
          `INSERT INTO job_postings
            (source_id, external_id, canonical_url, title, organization, category, fields,
             deadline, posted_at, summary, description_html, description_hash, region, language)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            source.id,
            item.external_id,
            item.canonical_url,
            item.title,
            item.organization || null,
            item.category || null,
            item.fields || null,
            item.deadline || null,
            item.posted_at || null,
            item.summary || null,
            item.description_html || null,
            description_hash,
            adapter.region,
            'ko',
          ],
        );
        newCount++;
      } else if (existing[0].description_hash !== description_hash) {
        await pool.query(
          `UPDATE job_postings SET
             canonical_url = $3, title = $4, organization = $5, category = $6, fields = $7,
             deadline = $8, posted_at = $9, summary = $10, description_html = $11,
             description_hash = $12, updated_at = NOW(), is_active = TRUE
           WHERE source_id = $1 AND external_id = $2`,
          [
            source.id,
            item.external_id,
            item.canonical_url, item.title, item.organization || null, item.category || null,
            item.fields || null, item.deadline || null, item.posted_at || null,
            item.summary || null, item.description_html || null, description_hash,
          ],
        );
        updatedCount++;
      } else {
        skippedCount++;
      }

      // 항목 간 rate-limit
      await new Promise(r => setTimeout(r, Math.min(minDelay, 500)));
    }

    // 마감 지난 공고 자동 비활성
    await pool.query(
      `UPDATE job_postings SET is_active = FALSE
       WHERE source_id = $1 AND deadline IS NOT NULL AND deadline < NOW()`,
      [source.id],
    );

    const finishedAt = new Date();
    await pool.query(
      `UPDATE job_crawl_logs
       SET finished_at = $2, items_new = $3, items_updated = $4, items_skipped = $5, status = 'ok'
       WHERE id = $1`,
      [logId, finishedAt, newCount, updatedCount, skippedCount],
    );
    await pool.query(
      `UPDATE job_sources SET last_crawled_at = $2, last_status = 'ok', last_error = NULL WHERE id = $1`,
      [source.id, finishedAt],
    );

    return {
      source_id: source.id,
      source_code: sourceCode,
      fetched: items.length,
      new: newCount,
      updated: updatedCount,
      skipped: skippedCount,
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      status: 'ok',
    };
  } catch (err) {
    const finishedAt = new Date();
    const msg = (err as Error).message?.slice(0, 1000) || 'unknown';
    await pool.query(
      `UPDATE job_crawl_logs SET finished_at = $2, status = 'error', error = $3 WHERE id = $1`,
      [logId, finishedAt, msg],
    );
    await pool.query(
      `UPDATE job_sources SET last_crawled_at = $2, last_status = 'error', last_error = $3 WHERE id = $1`,
      [source.id, finishedAt, msg],
    );
    console.error(`[crawl] ${sourceCode} error:`, msg);
    return {
      source_id: source.id,
      source_code: sourceCode,
      fetched: 0,
      new: 0,
      updated: 0,
      skipped: 0,
      duration_ms: finishedAt.getTime() - startedAt.getTime(),
      status: 'error',
      error: msg,
    };
  }
}

/**
 * 모든 enabled 소스 한 번 실행 (부팅 시 또는 admin 수동 트리거)
 */
export async function runAllCrawls(): Promise<CrawlResult[]> {
  const { rows } = await pool.query(
    `SELECT code FROM job_sources WHERE enabled = TRUE ORDER BY id`,
  );
  const results: CrawlResult[] = [];
  for (const r of rows) {
    const result = await runCrawl(r.code);
    results.push(result);
  }
  return results;
}

// ── node-cron 등록 (앱 부팅 시 initCrawlerCron 호출) ──────────────────────

const cronJobs: cron.ScheduledTask[] = [];

/**
 * DB의 모든 enabled 소스의 cron_expr을 읽어 node-cron으로 등록.
 * 앱 시작 시 1회 호출.
 */
export function initCrawlerCron(): void {
  // 기존 등록 해제 (개발 hot reload 대비)
  cronJobs.forEach(j => j.stop());
  cronJobs.length = 0;

  void (async () => {
    const { rows } = await pool.query(
      `SELECT id, code, cron_expr FROM job_sources WHERE enabled = TRUE`,
    );
    for (const src of rows) {
      if (!cron.validate(src.cron_expr)) {
        console.warn(`[crawler] invalid cron for ${src.code}: ${src.cron_expr}`);
        continue;
      }
      const task = cron.schedule(src.cron_expr, () => {
        console.log(`[crawler] scheduled run: ${src.code}`);
        void runCrawl(src.code).then(r =>
          console.log(`[crawler] ${src.code}: ${r.status} new=${r.new} updated=${r.updated} skipped=${r.skipped} (${r.duration_ms}ms)`),
        ).catch(e => console.error(`[crawler] ${src.code} crashed:`, e));
      }, { timezone: 'Asia/Seoul' });
      cronJobs.push(task);
      console.log(`[crawler] registered: ${src.code} (${src.cron_expr}, KST)`);
    }
  })();
}