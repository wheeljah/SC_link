import { Request, Response } from 'express';
import { pool } from '../db/pool';

export async function getActiveBanner(req: Request, res: Response): Promise<void> {
  const position = (req.query.position as string)?.toUpperCase();
  if (!position || !['TOP', 'BOTTOM'].includes(position)) {
    res.status(400).json({ success: false, message: 'position은 TOP 또는 BOTTOM 이어야 합니다.' });
    return;
  }

  const { rows } = await pool.query(
    `SELECT id, position, type, icon, message, cta_text, cta_url, image_url, advertiser_name, bg_color, text_color
     FROM ad_banners
     WHERE position = $1
       AND status = 'ACTIVE'
       AND (start_at IS NULL OR start_at <= NOW())
       AND (end_at IS NULL OR end_at > NOW())
     ORDER BY priority DESC
     LIMIT 1`,
    [position]
  );

  if (!rows[0]) { res.json({ success: true, data: null }); return; }
  res.json({ success: true, data: rows[0] });
}

export async function trackImpression(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  await pool.query(`UPDATE ad_banners SET impression_count = impression_count + 1 WHERE id = $1`, [id]);
  res.status(204).end();
}

export async function trackClick(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  await pool.query(`UPDATE ad_banners SET click_count = click_count + 1 WHERE id = $1`, [id]);
  res.status(204).end();
}
