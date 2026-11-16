import { test, expect, beforeAll, afterAll, describe } from 'bun:test';
import { initDb, closeDb } from '../db/index.js';
import { save, list } from '../tools/docs.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync } from 'fs';

const TEST_DB_PATH = join(tmpdir(), `docket-test-${Date.now()}.db`);

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

describe('list() 필터링', () => {
  test('project 필터', async () => {
    await save({ title: 'Doc A', content: 'content', project: 'proj1' });
    await save({ title: 'Doc B', content: 'content', project: 'proj2' });

    const result = await list({ project: 'proj1' });
    expect(result.docs.every(d => d.project === 'proj1')).toBe(true);
  });

  test('tags AND 필터', async () => {
    await save({ title: 'Tagged', content: 'content', tags: ['a', 'b', 'c'] });
    await save({ title: 'Partial', content: 'content', tags: ['a', 'b'] });

    const result = await list({ tags: ['a', 'b', 'c'] });
    expect(result.docs.some(d => d.title === 'Tagged')).toBe(true);
    expect(result.docs.some(d => d.title === 'Partial')).toBe(false);
  });

  test('meta 필터 - 기본', async () => {
    await save({ title: 'Meta Doc', content: 'content', meta: { type: 'spec', version: 1 } });
    await save({ title: 'Other Doc', content: 'content', meta: { type: 'note' } });

    const result = await list({ meta: { type: 'spec' } });
    expect(result.docs.some(d => d.title === 'Meta Doc')).toBe(true);
    expect(result.docs.some(d => d.title === 'Other Doc')).toBe(false);
  });

  test('meta 필터 - 한글 키', async () => {
    await save({ title: 'Korean Meta', content: 'content', meta: { '종류': '문서' } });

    const result = await list({ meta: { '종류': '문서' } });
    expect(result.docs.some(d => d.title === 'Korean Meta')).toBe(true);
  });

  test('meta 필터 - 특수문자 키 (SQL injection 방어)', async () => {
    await save({ title: 'Special Key', content: 'content', meta: { 'key"with"quotes': 'value' } });

    // SQL injection 시도가 아닌 정상 조회
    const result = await list({ meta: { 'key"with"quotes': 'value' } });
    expect(result.docs.some(d => d.title === 'Special Key')).toBe(true);
  });

  test('meta 필터 - SQL injection 시도', async () => {
    // 파라미터 방식으로 안전하게 처리 (에러 없이 빈 결과 반환)
    const result = await list({ meta: { "'); DROP TABLE docs; --": 'x' } });
    expect(result.docs.length).toBe(0); // 매칭되는 문서 없음

    // 테이블이 삭제되지 않았는지 확인
    const allDocs = await list({});
    expect(allDocs.total).toBeGreaterThan(0);
  });

  test('페이지네이션', async () => {
    // 충분한 문서 생성
    for (let i = 0; i < 5; i++) {
      await save({ title: `Page Doc ${i}`, content: 'content', project: 'pagination-test' });
    }

    const page1 = await list({ project: 'pagination-test', limit: 2, offset: 0 });
    const page2 = await list({ project: 'pagination-test', limit: 2, offset: 2 });

    expect(page1.docs.length).toBe(2);
    expect(page2.docs.length).toBe(2);
    expect(page1.total).toBe(5);
  });
});

describe('list() query 검색', () => {
  test('본문에 검색어가 있는 문서를 찾는다', async () => {
    await save({ title: 'Body Hit', content: '여기에 고래 이야기가 있다', project: 'q-body' });
    await save({ title: 'Body Miss', content: '아무 관련 없는 내용', project: 'q-body' });

    const result = await list({ project: 'q-body', query: '고래' });
    expect(result.docs.map(d => d.title)).toEqual(['Body Hit']);
    expect(result.total).toBe(1);
  });

  test('제목에 검색어가 있는 문서를 찾는다', async () => {
    await save({ title: '펭귄 관찰기', content: 'content', project: 'q-title' });
    await save({ title: '다른 제목', content: 'content', project: 'q-title' });

    const result = await list({ project: 'q-title', query: '펭귄' });
    expect(result.docs.map(d => d.title)).toEqual(['펭귄 관찰기']);
  });

  test('다른 필터와 AND로 묶인다', async () => {
    await save({ title: 'In Project', content: '수달', project: 'q-and-1' });
    await save({ title: 'No Match', content: '해달', project: 'q-and-1' });
    await save({ title: 'Other Project', content: '수달', project: 'q-and-2' });

    const result = await list({ project: 'q-and-1', query: '수달' });
    expect(result.docs.map(d => d.title)).toEqual(['In Project']);
  });

  test('% 와 _ 는 와일드카드가 아니라 글자로 찾는다', async () => {
    await save({ title: 'Percent', content: '달성률 100% 확인', project: 'q-escape' });
    await save({ title: 'Digits', content: '100점 만점', project: 'q-escape' });
    await save({ title: 'Underscore', content: 'snake_case 이름', project: 'q-escape' });
    await save({ title: 'Dash', content: 'snake-case 이름', project: 'q-escape' });

    const percent = await list({ project: 'q-escape', query: '100%' });
    expect(percent.docs.map(d => d.title)).toEqual(['Percent']);

    const underscore = await list({ project: 'q-escape', query: 'snake_case' });
    expect(underscore.docs.map(d => d.title)).toEqual(['Underscore']);
  });

  test('백슬래시가 들어간 검색어도 글자로 찾는다', async () => {
    await save({ title: 'Backslash', content: 'C:\\temp 경로', project: 'q-backslash' });
    await save({ title: 'No Backslash', content: 'C:/temp 경로', project: 'q-backslash' });

    const result = await list({ project: 'q-backslash', query: 'C:\\temp' });
    expect(result.docs.map(d => d.title)).toEqual(['Backslash']);
  });

  test('영문은 대소문자를 구분하지 않는다', async () => {
    await save({ title: 'Upper', content: 'Embedded Replica 설명', project: 'q-case' });
    await save({ title: 'Other', content: 'remote only', project: 'q-case' });

    const result = await list({ project: 'q-case', query: 'embedded replica' });
    expect(result.docs.map(d => d.title)).toEqual(['Upper']);
  });

  test('1000자를 넘는 검색어는 거절한다', async () => {
    await expect(list({ query: 'a'.repeat(1001) })).rejects.toThrow('query must be at most 1000 characters');
    await expect(list({ query: 'a'.repeat(1000) })).resolves.toBeDefined();
  });
});
