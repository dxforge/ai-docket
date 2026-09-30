# AI Docket

**AI 에이전트를 위한 문서 저장소 MCP 서버**

Claude Code, Codex 같은 AI 에이전트가 세션이 바뀌어도 스펙·아이디어·작업 메모를 프로젝트별로 저장하고 다시 꺼내 쓰게 해 주는 MCP 서버.

## 설치

[Bun](https://bun.sh)이 필요합니다.

```bash
git clone https://github.com/dxforge/ai-docket.git
cd ai-docket
bun install
```

아래 예시의 `/path/to/ai-docket`은 clone한 폴더의 절대 경로로 바꿔 주세요.

## Claude Code에 추가

### 전역 설정

모든 프로젝트에서 같은 로컬 DB(`~/.ai-docket/docket.db`)를 씁니다.

```bash
claude mcp add ai-docket --scope user -- bun /path/to/ai-docket/src/index.ts
```

### 프로젝트별 DB

특정 프로젝트에서만 다른 DB를 쓰려면 그 프로젝트 폴더에서 `local` scope로 등록합니다. 이 설정은 내 컴퓨터에만 저장되고 프로젝트 저장소에는 들어가지 않습니다.

```bash
cd /your/project
claude mcp add ai-docket \
  --scope local \
  -e AI_DOCKET_DB=$HOME/.ai-docket/my-project.db \
  -- bun /path/to/ai-docket/src/index.ts
```

### Turso 원격 DB

토큰은 작은따옴표로 감싼 `${...}`로 등록하면 설정 파일에는 변수 이름만 저장되고, Claude Code가 실행할 때 쉘 환경변수 값으로 바꿔 넘깁니다.

```bash
claude mcp add ai-docket --scope user \
  -e AI_DOCKET_DB=libsql://your-db.turso.io \
  -e 'AI_DOCKET_AUTH_TOKEN=${AI_DOCKET_AUTH_TOKEN}' \
  -- bun /path/to/ai-docket/src/index.ts
```

## Codex에 추가

```bash
codex mcp add ai-docket -- bun /path/to/ai-docket/src/index.ts
```

Turso 원격 DB를 쓰려면 `~/.codex/config.toml`을 직접 고칩니다. Codex는 `env`에 적은 값을 글자 그대로 넘기고 `${VAR}`를 바꿔 주지 않습니다. 주소는 `env`에 적고, 토큰은 쉘에서 export한 뒤 `env_vars`로 넘기세요.

```toml
# ~/.codex/config.toml
[mcp_servers.ai-docket]
command = "bun"
args = ["/path/to/ai-docket/src/index.ts"]
env = { AI_DOCKET_DB = "libsql://your-db.turso.io" }
env_vars = ["AI_DOCKET_AUTH_TOKEN"]
```

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `AI_DOCKET_DB` | DB 위치. 로컬 파일의 절대 경로, 또는 `libsql://`·`https://`로 시작하는 Turso 주소 | `~/.ai-docket/docket.db` |
| `AI_DOCKET_AUTH_TOKEN` | Turso 원격 DB 토큰 | |

```bash
# 로컬 (file: 접두사도 허용)
AI_DOCKET_DB=/path/to/docket.db

# Turso 원격
AI_DOCKET_DB=libsql://your-db.turso.io
AI_DOCKET_AUTH_TOKEN=your-token
```

- Turso 주소는 `turso db show --url <db>`, 토큰은 `turso db tokens create <db>`로 얻습니다.
- 토큰이 없거나 틀리면 서버가 시작하지 않습니다.
- 주소에 `?authToken=`을 넣으면 서버가 시작하지 않습니다. 토큰은 `AI_DOCKET_AUTH_TOKEN`으로 넘기세요.
- 상대 경로처럼 형식이 틀린 값도 거절하며, 에러 메시지에 값은 출력하지 않습니다.

`AI_DOCKET_DB`가 비어 있거나 변수 이름을 잘못 적으면 에러 없이 기본 로컬 DB를 씁니다. 원격에 붙었는지는 `list`로 기존 문서가 보이는지 확인하세요.

## 도구

모든 문서는 `project`에 속합니다. 생략하면 빈 문자열(공용)이 됩니다. `name`은 프로젝트 안에서 유일한 별칭이고, `id`(ULID)는 자동으로 붙습니다.

### save

문서를 저장합니다. 기존 문서를 찾으면 넘긴 필드만 바꾸고 나머지는 유지하며, 없으면 새로 만듭니다.

- 새로 만들 때는 `title`과 `content`가 필요합니다.
- 같은 `project`에 같은 `name`이 이미 있으면 `DUPLICATE_NAME` 에러가 납니다. 기존 문서를 수정하려면 `upsert: true`를 넘기세요.
- `meta`는 기존 값에 합쳐집니다. 통째로 바꾸려면 `meta_merge: false`를 넘기세요.

```typescript
// 새 문서 생성
save({
  project: "my-project",
  name: "ideas/feature-x",
  title: "Feature X 아이디어",
  content: "...",
  tags: ["idea"],
  meta: { priority: "high" }
})

// name으로 기존 문서 수정
save({
  project: "my-project",
  name: "ideas/feature-x",
  content: "수정된 내용",  // 바꿀 필드만
  upsert: true
})

// id로 기존 문서 수정
save({ id: "01KG...", title: "새 제목" })
```

### get

문서 하나를 본문까지 가져옵니다. `id` 또는 `project`+`name`으로 찾습니다.

```typescript
get({ id: "01KG..." })
get({ project: "my-project", name: "ideas/feature-x" })

// 연결된 문서 목록 포함
get({ id: "01KG...", include_links: true })
```

### list

문서 목록을 최근 수정 순으로 가져옵니다. 결과에는 본문(`content`)이 없으니 본문은 `get`으로 읽으세요.

| 옵션 | 설명 |
|------|------|
| `project` | 해당 프로젝트만. 생략하면 전체 |
| `name` | 이름이 정확히 같은 문서. `project`를 생략하면 모든 프로젝트에서 찾기 |
| `tags` | 지정한 태그를 모두 가진 문서 (AND) |
| `meta` | 키-값이 일치하는 문서 |
| `limit`, `offset` | 개수(기본 50)와 시작 위치. 결과의 `total`은 전체 개수 |

```typescript
list({ project: "my-project" })
list({ project: "my-project", tags: ["idea", "feature"] })
list({ name: "spec" })
list({ meta: { status: "active" } })
```

### delete

문서를 삭제합니다. 실수로 지우지 않도록 `name`을 반드시 함께 넘겨야 합니다. 그래서 이름 없이 저장한 문서는 지금은 삭제할 수 없습니다. 문서를 지우면 그 문서의 연결(`link`)도 함께 지워집니다.

```typescript
delete({ id: "01KG...", name: "ideas/feature-x" })
delete({ project: "my-project", name: "ideas/feature-x" })
```

### link

두 문서를 연결하거나 연결을 끊습니다. 연결에는 방향(`from_id` → `to_id`)이 있고, `get`의 `include_links`로 나가는 연결과 들어오는 연결을 모두 볼 수 있습니다.

```typescript
link({ action: "add", from_id: "01KG...", to_id: "01KH..." })
link({ action: "remove", from_id: "01KG...", to_id: "01KH..." })
```

## 스키마

```sql
docs (
  id TEXT PRIMARY KEY,      -- ULID, 자동 생성
  project TEXT NOT NULL,    -- 프로젝트명 (기본 '')
  name TEXT,                -- 별칭 (project 내 unique)
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT,                -- JSON array
  meta TEXT,                -- JSON object
  created_at, updated_at
)

doc_links (
  from_id, to_id            -- 문서 간 연결
)
```

## 개발

```bash
bun install
bun test        # 테스트
bun run dev     # 파일이 바뀌면 자동 재시작
```

## License

[MIT](LICENSE)
