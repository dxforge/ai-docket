import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initDb, closeDb } from './db/index.js';
import { createServer } from './server.js';

async function main() {
  await initDb();

  const server = createServer();
  const transport = new StdioServerTransport();

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      closeDb();
      process.exit(0);
    });
  }

  await server.connect(transport);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Failed to start server:', message);
  process.exit(1);
});
