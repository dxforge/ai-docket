import { getDb } from '../db/index.js';
import type { LinkParams, LinkResult } from '../types/index.js';

export async function link(params: LinkParams): Promise<LinkResult> {
  const db = getDb();

  if (params.action === 'add') {
    const fromResult = await db.execute({
      sql: 'SELECT id FROM docs WHERE id = ?',
      args: [params.from_id],
    });
    const toResult = await db.execute({
      sql: 'SELECT id FROM docs WHERE id = ?',
      args: [params.to_id],
    });

    if (fromResult.rows.length === 0 || toResult.rows.length === 0) {
      throw new Error('NOT_FOUND');
    }

    await db.execute({
      sql: `INSERT OR IGNORE INTO doc_links (from_id, to_id) VALUES (?, ?)`,
      args: [params.from_id, params.to_id],
    });

    return { success: true };
  } else {
    await db.execute({
      sql: 'DELETE FROM doc_links WHERE from_id = ? AND to_id = ?',
      args: [params.from_id, params.to_id],
    });

    return { success: true };
  }
}
