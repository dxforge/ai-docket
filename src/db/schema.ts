export const SCHEMA_VERSION = '1';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS docs (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL DEFAULT '',
    name TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT,
    meta TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doc_links (
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    PRIMARY KEY (from_id, to_id),
    FOREIGN KEY (from_id) REFERENCES docs(id) ON DELETE CASCADE,
    FOREIGN KEY (to_id) REFERENCES docs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_docs_project ON docs(project);
CREATE INDEX IF NOT EXISTS idx_docs_created ON docs(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_docs_project_name ON docs(project, name) WHERE name IS NOT NULL;
`;
