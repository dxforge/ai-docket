import { test, expect, beforeAll, afterAll, describe } from 'bun:test';
import { initDb, closeDb } from '../db/index.js';
import { save, get } from '../tools/docs.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';

const TEST_DB_PATH = join(tmpdir(), `docket-save-test-${Date.now()}.db`);

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

describe('save() upsert', () => {
  test('name으로 새 문서 생성', async () => {
    const result = await save({
      project: 'test-proj',
      name: 'upsert-doc',
      title: 'Original Title',
      content: 'Original Content',
    });

    expect(result.created).toBe(true);
    expect(result.name).toBe('upsert-doc');
  });

  test('name 중복 시 upsert: false (기본값)면 에러', async () => {
    await expect(
      save({
        project: 'test-proj',
        name: 'upsert-doc',
        title: 'Duplicate',
        content: 'Content',
      })
    ).rejects.toThrow('DUPLICATE_NAME');
  });

  test('name 중복 시 upsert: true면 업데이트', async () => {
    const result = await save({
      project: 'test-proj',
      name: 'upsert-doc',
      content: 'Updated Content',
      upsert: true,
    });

    expect(result.created).toBe(false);
    expect(result.title).toBe('Original Title'); // PATCH: title 유지

    const doc = await get({ project: 'test-proj', name: 'upsert-doc' });
    expect(doc.content).toBe('Updated Content');
  });

  test('다른 project는 별개 문서', async () => {
    const result = await save({
      project: 'other-proj',
      name: 'upsert-doc',
      title: 'Other Project Doc',
      content: 'Other Content',
    });

    expect(result.created).toBe(true);
    expect(result.project).toBe('other-proj');
  });

  test('id로 update - 기존 동작 유지', async () => {
    const created = await save({
      title: 'ID Update Test',
      content: 'Original',
    });

    const updated = await save({
      id: created.id,
      content: 'Updated by ID',
    });

    expect(updated.created).toBe(false);
    expect(updated.id).toBe(created.id);

    const doc = await get({ id: created.id });
    expect(doc.content).toBe('Updated by ID');
  });

  test('존재하지 않는 id는 에러', async () => {
    await expect(
      save({ id: 'non-existent-id', content: 'test' })
    ).rejects.toThrow('NOT_FOUND');
  });
});
