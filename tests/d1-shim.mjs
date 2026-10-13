// Emulación mínima de la API de D1 sobre node:sqlite, solo para pruebas locales.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

class Statement {
  constructor(db, sql, params = []) { this.db = db; this.sql = sql; this.params = params; }
  bind(...params) { return new Statement(this.db, this.sql, params); }
  async first() { return this.db.prepare(this.sql).get(...this.params) ?? null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.params), success: true }; }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { success: true, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
  }
}

export function createTestDb({ seed = true, root = new URL('..', import.meta.url).pathname } = {}) {
  const db = new DatabaseSync(':memory:');
  const dir = join(root, 'database/migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) db.exec(readFileSync(join(dir, f), 'utf8'));
  if (seed) db.exec(readFileSync(join(root, 'tests/fixtures/test_data.sql'), 'utf8'));
  return { raw: db, prepare: (sql) => new Statement(db, sql) };
}
