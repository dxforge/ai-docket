import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { save, get, list, del, link } from './tools/index.js';

async function respond(run: () => Promise<unknown>) {
  try {
    const result = await run();
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
  }
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'ai-docket',
    version: '0.1.1',
  });

  server.registerTool(
    'save',
    {
      description: '문서를 저장합니다. id가 있으면 수정(PATCH), 없으면 새로 생성합니다.',
      inputSchema: {
        id: z.string().optional().describe('문서 ID (있으면 수정, 없으면 생성)'),
        project: z.string().optional().describe('프로젝트 (기본 빈 문자열)'),
        name: z.string().optional().describe('문서 별칭 (프로젝트 내 유일)'),
        title: z.string().optional().describe('문서 제목 (생성 시 필수)'),
        content: z.string().optional().describe('문서 내용 (생성 시 필수)'),
        tags: z.array(z.string()).optional().describe('태그 목록'),
        meta: z.record(z.string(), z.unknown()).optional().describe('메타데이터'),
        meta_merge: z.boolean().optional().describe('메타데이터 병합 여부 (기본 true)'),
        upsert: z.boolean().optional().describe('name 중복 시 업데이트 여부 (기본 false)'),
      },
    },
    (params) => respond(() => save(params))
  );

  server.registerTool(
    'get',
    {
      description: 'ID 또는 name으로 문서를 조회합니다.',
      inputSchema: {
        id: z.string().optional().describe('문서 ID (ULID)'),
        project: z.string().optional().describe('프로젝트 (name 조회 시, 기본 빈 문자열)'),
        name: z.string().optional().describe('문서 별칭'),
        include_links: z.boolean().optional().describe('링크 정보 포함 여부'),
      },
    },
    (params) => respond(() => get(params))
  );

  server.registerTool(
    'list',
    {
      description: '문서 목록을 조회합니다.',
      inputSchema: {
        project: z.string().optional().describe('프로젝트 필터 (미지정 시 전체)'),
        name: z.string().optional().describe('name 정확 매칭 (프로젝트 무관)'),
        tags: z.array(z.string()).optional().describe('태그 필터 (AND)'),
        meta: z.record(z.string(), z.unknown()).optional().describe('메타데이터 필터'),
        limit: z.number().optional().describe('조회 개수 (기본 50)'),
        offset: z.number().optional().describe('시작 위치'),
      },
    },
    (params) => respond(() => list(params))
  );

  server.registerTool(
    'delete',
    {
      description: '문서를 삭제합니다.',
      inputSchema: {
        id: z.string().optional().describe('문서 ID (name과 함께 검증)'),
        project: z.string().optional().describe('프로젝트 (기본 빈 문자열)'),
        name: z.string().describe('문서 별칭 (필수)'),
      },
    },
    (params) => respond(() => del(params))
  );

  server.registerTool(
    'link',
    {
      description: '두 문서를 연결하거나 연결을 해제합니다.',
      inputSchema: {
        action: z.enum(['add', 'remove']).describe('동작 (add: 연결, remove: 해제)'),
        from_id: z.string().describe('출발 문서 ID'),
        to_id: z.string().describe('도착 문서 ID'),
      },
    },
    (params) => respond(() => link(params))
  );

  return server;
}
