# ai-docket

AI 에이전트를 위한 문서 저장소 MCP 서버

## Build & Run

```bash
bun install
bun run src/index.ts
```

## Tools (5개)

| 도구 | 설명 |
|------|------|
| `save` | 문서 저장 (id 있으면 PATCH 수정, 없으면 생성) |
| `get` | 단일 조회 (id 또는 project+name, include_links 옵션) |
| `list` | 목록 조회 (project/name/tags/meta 필터) |
| `delete` | 문서 삭제 |
| `link` | 연결 관리 (action: add/remove) |

## Project 필드

- `project`: 문서가 속한 프로젝트 (기본값: 빈 문자열)
- 빈 문자열 = 공용/개인 노트
- Claude Code 프로젝트명과 일치시켜 사용

```typescript
// 프로젝트 문서 저장
save({ project: "ai-docket", name: "spec", title: "...", content: "..." })

// 프로젝트 문서만 조회
list({ project: "ai-docket" })

// 프로젝트+name으로 조회
get({ project: "ai-docket", name: "spec" })
```

## ID 체계

- `id`: ULID (자동 생성, PK) - 링크에 사용
- `name`: 선택적 별칭 (프로젝트 내 unique)
- `(project, name)`: unique 제약

## Architecture

```
src/
├── index.ts          # 진입점
├── server.ts         # MCP 서버 (도구 정의)
├── db/
│   ├── index.ts      # DB 초기화
│   ├── schema.ts     # 스키마
│   └── migrations.ts # 마이그레이션
├── tools/
│   ├── docs.ts       # save, get, list, del
│   ├── links.ts      # link
│   └── index.ts
└── types/
    └── index.ts
```

## 설정

DB 경로: `~/.ai-docket/docket.db` (기본값)

환경변수로 변경:
```bash
# 로컬
AI_DOCKET_DB=/custom/path.db bun run src/index.ts

# Turso 원격
AI_DOCKET_DB=libsql://xxx.turso.io AI_DOCKET_AUTH_TOKEN=... bun run src/index.ts
```
