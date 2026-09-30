import { test, expect, beforeAll, afterAll, describe } from 'bun:test';
import { initDb, closeDb, getDb } from '../db/index.js';
import { save, get, del } from '../tools/docs.js';
import { link } from '../tools/links.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';

const TEST_DB_PATH = join(tmpdir(), `docket-delete-test-${Date.now()}.db`);

beforeAll(async () => {
  await initDb(TEST_DB_PATH);
});

afterAll(() => {
  closeDb();
  try {
    unlinkSync(TEST_DB_PATH);
    unlinkSync(TEST_DB_PATH + '-wal');
    unlinkSync(TEST_DB_PATH + '-shm');
  } catch {}
});

describe('del()', () => {
  test('project+name으로 삭제', async () => {
    await save({ project: 'proj', name: 'by-name', title: 'T', content: 'c' });

    const result = await del({ project: 'proj', name: 'by-name' });
    expect(result.name).toBe('by-name');
    await expect(get({ project: 'proj', name: 'by-name' })).rejects.toThrow('NOT_FOUND');
  });

  test('id로 지울 때 name이 다르면 지우지 않는다', async () => {
    const created = await save({ project: 'proj', name: 'guarded', title: 'T', content: 'c' });

    await expect(del({ id: created.id, name: 'wrong-name' })).rejects.toThrow('NOT_FOUND');
    const doc = await get({ id: created.id });
    expect(doc.name).toBe('guarded');
  });

  test('id+name이 맞으면 삭제', async () => {
    const created = await save({ project: 'proj', name: 'by-id', title: 'T', content: 'c' });

    await del({ id: created.id, name: 'by-id' });
    await expect(get({ id: created.id })).rejects.toThrow('NOT_FOUND');
  });

  test('문서를 지우면 연결도 함께 지워진다', async () => {
    const from = await save({ project: 'proj', name: 'from', title: 'From', content: 'c' });
    const to = await save({ project: 'proj', name: 'to', title: 'To', content: 'c' });
    await link({ action: 'add', from_id: from.id, to_id: to.id });

    await del({ project: 'proj', name: 'from' });
    // get은 링크를 docs와 JOIN해 남은 링크가 가려지므로 doc_links를 직접 확인한다
    const rows = await getDb().execute({ sql: 'SELECT * FROM doc_links WHERE from_id = ?', args: [from.id] });
    expect(rows.rows).toHaveLength(0);
  });
});
