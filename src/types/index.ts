export interface Doc {
  id: string;
  project: string;
  name: string | null;
  title: string;
  content: string;
  tags: string[] | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DocSummary {
  id: string;
  project: string;
  name: string | null;
  title: string;
  tags: string[] | null;
  created_at: string;
}

export interface LinkedDoc {
  id: string;
  title: string;
}

export interface SaveParams {
  id?: string;
  project?: string;
  name?: string;
  title?: string;
  content?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
  meta_merge?: boolean;
  upsert?: boolean;
}

export interface SaveResult {
  id: string;
  project: string;
  name: string | null;
  title: string;
  created: boolean;
  created_at: string;
  updated_at: string;
}

export interface GetParams {
  id?: string;
  project?: string;
  name?: string;
  include_links?: boolean;
}

export interface GetResult extends Doc {
  links?: {
    outgoing: LinkedDoc[];
    incoming: LinkedDoc[];
  };
}

export interface ListParams {
  project?: string;
  name?: string;
  tags?: string[];
  meta?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

export interface ListResult {
  docs: DocSummary[];
  total: number;
}

export interface DeleteParams {
  id?: string;
  project?: string;
  name: string;
}

export interface DeleteResult {
  success: boolean;
  id: string;
  name: string | null;
  title: string;
}

export interface LinkParams {
  action: 'add' | 'remove';
  from_id: string;
  to_id: string;
}

export interface LinkResult {
  success: boolean;
}
