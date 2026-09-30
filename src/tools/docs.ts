import type { InValue } from '@libsql/client';
import { ulid } from 'ulid';
import { getDb } from '../db/index.js';
import type {
  Doc,
  DocSummary,
  LinkedDoc,
  SaveParams,
  SaveResult,
  GetParams,
  GetResult,
  ListParams,
  ListResult,
  DeleteParams,
  DeleteResult,
} from '../types/index.js';

interface RawDoc {
  id: string;
  project: string;
  name: string | null;
  title: string;
  content: string;
  tags: string | null;
  meta: string | null;
  created_at: string;
  updated_at: string;
}

function parseDoc(raw: RawDoc): Doc {
  return {
    ...raw,
    tags: raw.tags ? JSON.parse(raw.tags) : null,
    meta: raw.meta ? JSON.parse(raw.meta) : null,
  };
}

export async function save(params: SaveParams): Promise<SaveResult> {
  const db = getDb();
  const now = new Date().toISOString();

  let existing: RawDoc | undefined;

  if (params.id) {
    const result = await db.execute({
      sql: 'SELECT * FROM docs WHERE id = ?',
      args: [params.id],
    });
    existing = result.rows[0] as unknown as RawDoc | undefined;
    if (!existing) {
      throw new Error('NOT_FOUND');
    }
  } else if (params.name) {
    const project = params.project ?? '';
    const result = await db.execute({
      sql: 'SELECT * FROM docs WHERE project = ? AND name = ?',
      args: [project, params.name],
    });
    existing = result.rows[0] as unknown as RawDoc | undefined;
    if (existing && !params.upsert) {
      throw new Error('DUPLICATE_NAME');
    }
  }

  if (existing) {
    // 넘기지 않은 필드는 기존 값 유지
    const project = params.project !== undefined ? params.project : existing.project;
    const name = params.name !== undefined ? (params.name || null) : existing.name;
    const title = params.title !== undefined ? params.title : existing.title;
    const content = params.content !== undefined ? params.content : existing.content;
    const tags = params.tags !== undefined ? JSON.stringify(params.tags) : existing.tags;

    let meta: string | null;
    if (params.meta !== undefined) {
      const metaMerge = params.meta_merge !== false;
      if (metaMerge && existing.meta) {
        const existingMeta = JSON.parse(existing.meta) as Record<string, unknown>;
        meta = JSON.stringify({ ...existingMeta, ...params.meta });
      } else {
        meta = JSON.stringify(params.meta);
      }
    } else {
      meta = existing.meta;
    }

    await db.execute({
      sql: `UPDATE docs SET project = ?, name = ?, title = ?, content = ?, tags = ?, meta = ?, updated_at = ?
            WHERE id = ?`,
      args: [project, name, title, content, tags, meta, now, existing.id],
    });

    return {
      id: existing.id,
      project,
      name,
      title,
      created: false,
      created_at: existing.created_at,
      updated_at: now,
    };
  }

  if (!params.title || !params.content) {
    throw new Error('title and content are required for create');
  }

  const id = ulid();
  const project = params.project ?? '';
  const name = params.name || null;
  const tags = params.tags ? JSON.stringify(params.tags) : null;
  const meta = params.meta ? JSON.stringify(params.meta) : null;

  await db.execute({
    sql: `INSERT INTO docs (id, project, name, title, content, tags, meta, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, project, name, params.title, params.content, tags, meta, now, now],
  });

  return {
    id,
    project,
    name,
    title: params.title,
    created: true,
    created_at: now,
    updated_at: now,
  };
}

export async function get(params: GetParams): Promise<GetResult> {
  const db = getDb();
  let row: RawDoc | undefined;

  if (params.id) {
    const result = await db.execute({
      sql: 'SELECT * FROM docs WHERE id = ?',
      args: [params.id],
    });
    row = result.rows[0] as unknown as RawDoc | undefined;
  } else if (params.name) {
    const project = params.project ?? '';
    const result = await db.execute({
      sql: 'SELECT * FROM docs WHERE project = ? AND name = ?',
      args: [project, params.name],
    });
    row = result.rows[0] as unknown as RawDoc | undefined;
  } else {
    throw new Error('Either id or name is required');
  }

  if (!row) {
    throw new Error('NOT_FOUND');
  }

  const doc = parseDoc(row);
  const result: GetResult = { ...doc };

  if (params.include_links) {
    const outgoingResult = await db.execute({
      sql: `SELECT d.id, d.title FROM doc_links l
            JOIN docs d ON l.to_id = d.id
            WHERE l.from_id = ?`,
      args: [row.id],
    });
    const outgoing = outgoingResult.rows as unknown as LinkedDoc[];

    const incomingResult = await db.execute({
      sql: `SELECT d.id, d.title FROM doc_links l
            JOIN docs d ON l.from_id = d.id
            WHERE l.to_id = ?`,
      args: [row.id],
    });
    const incoming = incomingResult.rows as unknown as LinkedDoc[];

    result.links = { outgoing, incoming };
  }

  return result;
}

export async function list(params: ListParams): Promise<ListResult> {
  const db = getDb();
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  let whereClause = '1=1';
  const whereValues: InValue[] = [];

  if (params.project !== undefined) {
    whereClause += ' AND project = ?';
    whereValues.push(params.project);
  }

  if (params.name !== undefined) {
    whereClause += ' AND name = ?';
    whereValues.push(params.name);
  }

  for (const tag of params.tags ?? []) {
    whereClause += ' AND EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)';
    whereValues.push(tag);
  }

  for (const [key, value] of Object.entries(params.meta ?? {})) {
    // 키를 JSON 경로 문자열에 넣지 않고 json_each로 비교해 특수문자 키도 안전하게 매칭
    whereClause += ' AND EXISTS (SELECT 1 FROM json_each(meta) WHERE key = ? AND value = ?)';
    whereValues.push(key, value as InValue);
  }

  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM docs WHERE ${whereClause}`,
    args: whereValues,
  });
  const total = Number((countResult.rows[0] as unknown as { count: number }).count);

  const rowsResult = await db.execute({
    sql: `SELECT id, project, name, title, tags, created_at
          FROM docs
          WHERE ${whereClause}
          ORDER BY updated_at DESC
          LIMIT ? OFFSET ?`,
    args: [...whereValues, limit, offset],
  });

  const docs: DocSummary[] = rowsResult.rows.map(row => {
    const r = row as unknown as { id: string; project: string; name: string | null; title: string; tags: string | null; created_at: string };
    return {
      id: r.id,
      project: r.project,
      name: r.name,
      title: r.title,
      tags: r.tags ? JSON.parse(r.tags) : null,
      created_at: r.created_at,
    };
  });

  return { docs, total };
}

export async function del(params: DeleteParams): Promise<DeleteResult> {
  const db = getDb();

  // 실수로 지우지 않도록 id로 지울 때도 name이 맞아야 한다
  let row: { id: string; name: string | null; title: string } | undefined;

  if (params.id) {
    const result = await db.execute({
      sql: 'SELECT id, name, title FROM docs WHERE id = ? AND name = ?',
      args: [params.id, params.name],
    });
    row = result.rows[0] as unknown as typeof row;
  } else {
    const project = params.project ?? '';
    const result = await db.execute({
      sql: 'SELECT id, name, title FROM docs WHERE project = ? AND name = ?',
      args: [project, params.name],
    });
    row = result.rows[0] as unknown as typeof row;
  }

  if (!row) {
    throw new Error('NOT_FOUND');
  }

  await db.execute({
    sql: 'DELETE FROM docs WHERE id = ?',
    args: [row.id],
  });

  return {
    success: true,
    id: row.id,
    name: row.name,
    title: row.title,
  };
}
