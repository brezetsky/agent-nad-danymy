// Тести безпеки: перевіряють код інструментів, а не «добру волю» моделі.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seed, EMPLOYEES, CUSTOMERS } from '../data/seed.js';
import { getUser } from '../src/users.js';
import { createTools } from '../src/tools.js';
import { openDb } from '../src/db.js';
import { runAttacks } from '../attacks/run.js';

let dir;
let dbPath;

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'zerno-test-'));
  dbPath = seed(join(dir, 'company.db'));
  process.env.AUDIT_LOG = join(dir, 'audit.log');
  process.env.LLM = 'mock';
});

after(() => rmSync(dir, { recursive: true, force: true }));

function callAll(login, args = {}) {
  const { tools, close } = createTools({ user: getUser(login), dbPath });
  try {
    return Object.fromEntries(tools.map((t) => [t.name, t.run({ limit: 20, ...args })]));
  } finally {
    close();
  }
}

test('менеджер бачить лише свою філію, навіть якщо модель передасть іншу', () => {
  const out = callAll('olena', { branch: 'Львів', branch_id: 2, scope: null });
  const branches = new Set(Object.values(out).flat().map((row) => row.branch));
  assert.deepEqual([...branches], ['Київ']);
});

test('інструменти не повертають зарплат, email і телефонів', () => {
  const out = callAll('olena');
  const rows = Object.values(out).flat();
  const values = rows.flatMap((row) => Object.values(row));
  for (const e of EMPLOYEES) assert.ok(!values.includes(e.salary), `зарплата ${e.salary}`);
  const json = JSON.stringify(out);
  for (const c of CUSTOMERS) {
    assert.ok(!json.includes(c.email), `email ${c.email}`);
    assert.ok(!json.includes(c.phone), `телефон ${c.phone}`);
  }
  const keys = new Set(rows.flatMap((row) => Object.keys(row)));
  for (const forbidden of ['salary', 'email', 'phone']) assert.ok(!keys.has(forbidden), `поле ${forbidden}`);
});

test('директор бачить усі філії', () => {
  const revenue = callAll('director').get_revenue;
  assert.deepEqual(revenue.map((r) => r.branch), ['Київ', 'Львів', 'Одеса']);
});

test('некоректні аргументи відхиляються', () => {
  const { tools, close } = createTools({ user: getUser('olena'), dbPath });
  try {
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
    assert.throws(() => byName.get_orders.run({ limit: 1000 }), /limit/);
    assert.throws(() => byName.get_orders.run({ status: "paid' OR 1=1 --" }), /status/);
    assert.throws(() => byName.get_revenue.run({ from: '2026-01-01; DROP TABLE orders' }), /from/);
  } finally {
    close();
  }
});

test('підключення до бази — лише на читання', () => {
  const db = openDb(dbPath, { readOnly: true });
  try {
    assert.throws(() => db.exec("DELETE FROM orders WHERE status = 'cancelled'"), /readonly/);
  } finally {
    db.close();
  }
});

test('кожен виклик інструмента потрапляє в журнал аудиту', () => {
  callAll('petro');
  const lines = readFileSync(process.env.AUDIT_LOG, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(lines.some((l) => l.user === 'petro' && l.tool === 'get_revenue'));
});

for (const rules of ['on', 'off']) {
  test(`атаки (mock): 0 витоків, правила в промпті: ${rules}`, async () => {
    process.env.PROMPT_RULES = rules;
    const { results } = await runAttacks({ log: () => {} });
    const leaks = results.filter((r) => r.violations.length).map((r) => `${r.attack.id}: ${r.violations}`);
    assert.deepEqual(leaks, []);
  });
}
