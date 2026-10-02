import { describe, it, expect } from 'vitest';
import { filterUsers, filterCounts, relativeDay, usersToCsv, hasCreated } from './userList';

const rows = [
  { name: 'João Silva', email: 'joao@ufpe.br', scenes: 2, stories: 1, published: 1, views: 10 },
  { name: 'Maria', email: 'maria@example.com', scenes: 1, stories: 0, published: 0, views: 0 },
  { name: '', email: 'vazio@example.com', scenes: 0, stories: 0, published: 0, views: 0 },
];

describe('filterUsers', () => {
  it('searches name and email without caring about accents or case', () => {
    expect(filterUsers(rows, { query: 'joao' }).map((r) => r.email)).toEqual(['joao@ufpe.br']);
    expect(filterUsers(rows, { query: 'SILVA' })).toHaveLength(1);
    expect(filterUsers(rows, { query: 'example.com' })).toHaveLength(2);
  });

  it('splits who made something from who did not', () => {
    expect(filterUsers(rows, { filter: 'created' })).toHaveLength(2);
    expect(filterUsers(rows, { filter: 'published' })).toHaveLength(1);
    expect(filterUsers(rows, { filter: 'empty' }).map((r) => r.email)).toEqual(['vazio@example.com']);
    expect(hasCreated(rows[1])).toBe(true);
  });

  it('counts every filter for the chips', () => {
    expect(filterCounts(rows)).toEqual({ all: 3, created: 2, published: 1, empty: 1 });
  });
});

describe('relativeDay', () => {
  const now = Date.parse('2026-10-02T12:00:00Z');
  it('speaks the viewer language', () => {
    expect(relativeDay('2026-10-01T12:00:00Z', 'pt', now)).toBe('ontem');
    expect(relativeDay('2026-09-29T12:00:00Z', 'en', now)).toBe('3 days ago');
  });
  it('is empty when there is no date', () => {
    expect(relativeDay(null, 'pt', now)).toBe('');
  });
});

describe('usersToCsv', () => {
  it('writes a header and quotes what needs quoting', () => {
    const csv = usersToCsv([{ name: 'Silva, João', email: 'j@x.com', scenes: 1 }]);
    const [header, line] = csv.split('\r\n');
    expect(header).toBe('name,email,verified,createdAt,lastActiveAt,scenes,stories,published,views');
    expect(line.startsWith('"Silva, João",j@x.com,')).toBe(true);
  });

  it('defuses a name that a spreadsheet would run as a formula', () => {
    const line = usersToCsv([{ name: '=HYPERLINK("x")', email: 'a@b.c' }]).split('\r\n')[1];
    expect(line.startsWith(`"'=HYPERLINK(""x"")"`)).toBe(true);
  });
});
