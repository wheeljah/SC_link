import { Response } from 'express';
import { pool } from '../db/pool';
import { parseInput, resolvePmidToDoi, resolveArxivToDoi } from '../services/doiParserService';
import { downloadPaper } from '../services/downloadService';
import { AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

export async function requestDownload(req: AuthRequest, res: Response): Promise<void> {
  const { input, includeSupplements } = req.body;
  if (!input) {
    res.status(400).json({ success: false, message: '입력값을 제공해주세요.' });
    return;
  }

  const parsed = parseInput(input);

  let doi: string | undefined = parsed.doi;

  if (parsed.type === 'pmid') {
    const resolved = await resolvePmidToDoi(parsed.value);
    if (!resolved) {
      res.status(422).json({ success: false, message: 'PubMed ID에서 DOI를 찾을 수 없습니다.' });
      return;
    }
    doi = resolved;
  } else if (parsed.type === 'arxiv') {
    const resolved = await resolveArxivToDoi(parsed.value);
    doi = resolved || undefined;
  } else if (parsed.type === 'unknown') {
    res.status(400).json({ success: false, message: '지원하지 않는 입력 형식입니다. DOI, PMID, arXiv ID, 또는 URL을 입력해주세요.' });
    return;
  }

  if (!doi) {
    res.status(422).json({ success: false, message: 'DOI를 확인할 수 없습니다.' });
    return;
  }

  // DB에 요청 등록
  const { rows } = await pool.query(
    `INSERT INTO paper_requests (user_id, input_type, input_value, normalized_doi, status)
     VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
    [req.userId, parsed.type, input.trim(), doi]
  );
  const requestId = rows[0].id;

  // SSE 응답으로 진행 상황 전송
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: object) => {
    console.log(`[SSE send] ${event}:`, JSON.stringify(data).substring(0, 100));
    const ok = res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (!ok) console.log('[SSE] write returned false - client buffer full');
  };

  send('progress', { step: 'parsing', message: 'DOI 분석 중...', progress: 20 });

  try {
    send('progress', { step: 'downloading', message: '다운로드 서버 선택 중...', progress: 40 });
    console.log(`[papers] Starting downloadPaper for DOI=${doi}, userId=${req.userId}`);
    const result = await downloadPaper(doi, req.userId!);
    console.log(`[papers] downloadPaper completed: ${result.fileSize} bytes`);

    send('progress', { step: 'saving', message: '파일 저장 중...', progress: 80 });

    await pool.query(
      `UPDATE paper_requests SET status='completed', file_path=$1, file_size=$2, downloaded_at=NOW() WHERE id=$3`,
      [result.filePath, result.fileSize, requestId]
    );
    await pool.query(`UPDATE users SET download_count = download_count + 1 WHERE id = $1`, [req.userId]);

    send('complete', {
      requestId,
      doi,
      filePath: result.filePath,
      fileSize: result.fileSize,
      progress: 100,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '다운로드에 실패했습니다.';
    await pool.query(`UPDATE paper_requests SET status='failed' WHERE id=$1`, [requestId]);
    send('error', { message });
  } finally {
    res.end();
  }
}

export async function getDownloadHistory(req: AuthRequest, res: Response): Promise<void> {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const offset = (page - 1) * limit;

  const { rows } = await pool.query(
    `SELECT id, input_type, input_value, normalized_doi, title, authors, journal, year, status, file_size, downloaded_at, created_at
     FROM paper_requests WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [req.userId, limit, offset]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) as total FROM paper_requests WHERE user_id = $1`,
    [req.userId]
  );

  res.json({ success: true, data: rows, total: parseInt(countRows[0].total), page, limit });
}

export async function serveFile(req: AuthRequest, res: Response): Promise<void> {
  const requestId = parseInt(req.params.id);
  const { rows } = await pool.query(
    `SELECT file_path FROM paper_requests WHERE id = $1 AND user_id = $2`,
    [requestId, req.userId]
  );
  if (!rows[0]?.file_path) {
    res.status(404).json({ success: false, message: '파일을 찾을 수 없습니다.' });
    return;
  }

  const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
  const filename = path.basename(rows[0].file_path);
  const filePath = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, message: '파일이 서버에서 삭제되었습니다.' });
    return;
  }
  res.download(filePath, `paper_${requestId}.pdf`);
}
