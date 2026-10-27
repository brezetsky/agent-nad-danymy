import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seed, INJECTED_COMMENT } from '../data/seed.js';

test('seed створює навчальну базу з трьома філіями', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zerno-'));
  try {
    const path = seed(join(dir, 'company.db'));
    const db = new DatabaseSync(path, { readOnly: true });
    const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
    assert.equal(count('branches'), 3);
    assert.equal(count('employees'), 9);
    assert.equal(count('customers'), 12);
    assert.ok(count('orders') > 50);
    const injected = db.prepare('SELECT branch_id FROM orders WHERE comment = ?').get(INJECTED_COMMENT);
    assert.equal(injected.branch_id, 1, 'отруєний коментар має бути в київській філії');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
