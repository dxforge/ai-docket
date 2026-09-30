import { createClient, type Client } from '@libsql/client';
import { mkdirSync } from 'fs';
import { dirname, isAbsolute, join } from 'path';
import { homedir } from 'os';
import { SCHEMA, SCHEMA_VERSION } from './schema.js';
import { migrate } from './migrations.js';

const DEFAULT_DB_PATH = join(homedir(), '.ai-docket', 'docket.db');

let client: Client | null = null;

export async function initDb(dbPath?: string): Promise<Client> {
  // 인자(테스트)가 환경변수보다 우선이라 셸에 원격 설정이 있어도 테스트가 실제 DB를 건드리지 않는다
  const target = dbPath || process.env.AI_DOCKET_DB || DEFAULT_DB_PATH;

  // 에러 메시지에는 값을 넣지 않는다 (토큰이 섞여 있을 수 있고, stderr는 MCP 클라이언트 로그 파일로 남는다)
  if (/^(libsql|https):\/\//.test(target)) {
    if (target.includes('authToken=')) {
      throw new Error('AI_DOCKET_DB must not contain authToken; set AI_DOCKET_AUTH_TOKEN instead');
    }
    client = createClient({ url: target, authToken: process.env.AI_DOCKET_AUTH_TOKEN });
  } else {
    const path = target.replace(/^file:/, '');
    // 상대 경로나 토큰 같은 값으로 엉뚱한 곳에 파일을 만들지 않도록 거절
    if (!isAbsolute(path)) {
      throw new Error('AI_DOCKET_DB must be an absolute path or a libsql:// / https:// URL');
    }
    mkdirSync(dirname(path), { recursive: true });
    client = createClient({ url: `file:${path}` });
    await client.execute('PRAGMA journal_mode = WAL');
  }

  // 버전을 읽어야 전체 스키마 실행 여부를 정할 수 있으므로 버전 테이블만 먼저 만든다
  await client.execute('CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT)');

  const versionResult = await client.execute({
    sql: 'SELECT value FROM schema_meta WHERE key = ?',
    args: ['version'],
  });
  const versionRow = versionResult.rows[0] as unknown as { value: string } | undefined;

  if (!versionRow) {
    await client.executeMultiple(SCHEMA);
    await client.execute({
      sql: 'INSERT INTO schema_meta (key, value) VALUES (?, ?)',
      args: ['version', SCHEMA_VERSION],
    });
  } else if (versionRow.value !== SCHEMA_VERSION) {
    // 새 스키마의 인덱스가 마이그레이션으로 추가될 컬럼을 참조할 수 있어 마이그레이션을 먼저 실행한다
    await migrate(client, versionRow.value, SCHEMA_VERSION);
    await client.executeMultiple(SCHEMA);
  }

  return client;
}

export function getDb(): Client {
  if (!client) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return client;
}

export function closeDb(): void {
  if (client) {
    client.close();
    client = null;
  }
}
