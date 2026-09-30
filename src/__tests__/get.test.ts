import { test, expect, beforeAll, afterAll, describe } from 'bun:test';
import { initDb, closeDb } from '../db/index.js';
import { save, get } from '../tools/docs.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';

const TEST_DB_PATH = join(tmpdir(), `docket-get-test-${Date.now()}.db`);

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

describe('get()', () => {
  test('id로 조회하면 본문과 tags/meta를 돌려준다', async () => {
    const created = await save({
      project: 'proj',
      name: 'spec',
      title: 'Spec',
      content: 'body',
      tags: ['a'],
      meta: { status: 'draft' },
    });

    const doc = await get({ id: created.id });
    expect(doc.content).toBe('body');
    expect(doc.tags).toEqual(['a']);
    expect(doc.meta).toEqual({ status: 'draft' });
  });

  test('project+name으로 조회', async () => {
    const doc = await get({ project: 'proj', name: 'spec' });
    expect(doc.title).toBe('Spec');
  });

  test('project를 생략하면 빈 문자열 프로젝트에서 찾는다', async () => {
    await expect(get({ name: 'spec' })).rejects.toThrow('NOT_FOUND');
  });

  test('id와 name이 모두 없으면 에러', async () => {
    await expect(get({})).rejects.toThrow('Either id or name is required');
  });
});
