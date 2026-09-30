import { test, expect, afterEach, describe } from 'bun:test';
import { initDb, closeDb } from '../db/index.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, rmSync } from 'fs';

const SECRET = 'eyJhbGciOiJFZERTQSJ9.secret-token-value';
const TEST_DIR = join(tmpdir(), `docket-db-test-${Date.now()}`);
const savedEnv = { ...process.env };

afterEach(() => {
  closeDb();
  process.env = { ...savedEnv };
  rmSync(TEST_DIR, { recursive: true, force: true });
});

async function expectRejected(value: string) {
  process.env.AI_DOCKET_DB = value;
  const error = await initDb().then(() => null, (e: Error) => e);
  expect(error).toBeInstanceOf(Error);
  // 설정값에 토큰이 섞여 있을 수 있으므로 에러 메시지에 값이 나오면 안 된다
  expect(error!.message).not.toContain(SECRET);
  return error!;
}

describe('initDb', () => {
  test('인자로 받은 경로가 AI_DOCKET_DB보다 우선한다', async () => {
    process.env.AI_DOCKET_DB = 'libsql://should-not-connect.invalid';
    const path = join(TEST_DIR, 'arg.db');
    await initDb(path);
    expect(existsSync(path)).toBe(true);
  });

  test('AI_DOCKET_DB 절대 경로에 DB를 만든다', async () => {
    const path = join(TEST_DIR, 'plain.db');
    process.env.AI_DOCKET_DB = path;
    await initDb();
    expect(existsSync(path)).toBe(true);
  });

  test('file: 접두사를 허용한다', async () => {
    const path = join(TEST_DIR, 'prefixed.db');
    process.env.AI_DOCKET_DB = `file:${path}`;
    await initDb();
    expect(existsSync(path)).toBe(true);
  });

  test('원격 주소에 authToken이 들어 있으면 거절한다', async () => {
    const error = await expectRejected(`libsql://my-db.turso.io?authToken=${SECRET}`);
    expect(error.message).toContain('AI_DOCKET_AUTH_TOKEN');
  });

  test('토큰처럼 스킴 없는 값은 거절한다', async () => {
    await expectRejected(SECRET);
  });

  test('상대 경로는 거절한다', async () => {
    await expectRejected('data/docket.db');
  });
});
