import { test, expect, beforeAll, afterAll, describe } from 'bun:test';
import { initDb, closeDb } from '../db/index.js';
import { save, get } from '../tools/docs.js';
import { link } from '../tools/links.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';

const TEST_DB_PATH = join(tmpdir(), `docket-link-test-${Date.now()}.db`);

let a: string;
let b: string;

beforeAll(async () => {
  await initDb(TEST_DB_PATH);
  a = (await save({ title: 'A', content: 'a' })).id;
  b = (await save({ title: 'B', content: 'b' })).id;
});

afterAll(() => {
  closeDb();
  try {
    unlinkSync(TEST_DB_PATH);
    unlinkSync(TEST_DB_PATH + '-wal');
    unlinkSync(TEST_DB_PATH + '-shm');
  } catch {}
});

describe('link()', () => {
  test('add하면 양쪽 문서에서 방향대로 보인다', async () => {
    await link({ action: 'add', from_id: a, to_id: b });

    const fromDoc = await get({ id: a, include_links: true });
    const toDoc = await get({ id: b, include_links: true });
    expect(fromDoc.links).toEqual({ outgoing: [{ id: b, title: 'B' }], incoming: [] });
    expect(toDoc.links).toEqual({ outgoing: [], incoming: [{ id: a, title: 'A' }] });
  });

  test('같은 연결을 다시 add해도 하나만 남는다', async () => {
    await link({ action: 'add', from_id: a, to_id: b });

    const doc = await get({ id: a, include_links: true });
    expect(doc.links?.outgoing).toHaveLength(1);
  });

  test('없는 문서와는 연결할 수 없다', async () => {
    await expect(link({ action: 'add', from_id: a, to_id: 'missing' })).rejects.toThrow('NOT_FOUND');
  });

  test('remove하면 연결이 사라진다', async () => {
    await link({ action: 'remove', from_id: a, to_id: b });

    const doc = await get({ id: a, include_links: true });
    expect(doc.links?.outgoing).toEqual([]);
  });
});
