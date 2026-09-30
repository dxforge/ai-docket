import type { Client } from '@libsql/client';

// 버전 → 그 버전으로 올릴 때 실행할 SQL
const migrations: Record<string, string[]> = {};

export async function migrate(client: Client, currentVersion: string, targetVersion: string): Promise<void> {
  const current = parseInt(currentVersion, 10);
  const target = parseInt(targetVersion, 10);

  for (let v = current + 1; v <= target; v++) {
    const migration = migrations[v.toString()];
    if (migration) {
      // stdout은 MCP stdio 채널이므로 로그는 stderr로
      console.error(`Migrating to v${v}...`);
      for (const sql of migration) {
        await client.execute(sql);
      }
    }
    await client.execute({
      sql: 'UPDATE schema_meta SET value = ? WHERE key = ?',
      args: [v.toString(), 'version'],
    });
  }
}
