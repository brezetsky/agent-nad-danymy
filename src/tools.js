// Інструменти, які агент може викликати.
// Кожен інструмент: { name, description, parameters (JSON Schema), run(args) }.
//
// Крок 1: найпростіший і найпоширеніший підхід — дати моделі виконувати будь-який SQL.
// Це працює чудово на демо. На кроці 2 ми подивимося, що з цим не так.
import { openDb } from './db.js';

export function createTools({ user, dbPath } = {}) {
  const db = openDb(dbPath);

  const runSql = {
    name: 'run_sql',
    description: 'Виконує SQL-запит до бази SQLite мережі кав\'ярень і повертає результат.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'SQL-запит для SQLite' },
      },
      required: ['query'],
    },
    run({ query }) {
      const stmt = db.prepare(query);
      if (/^\s*(select|with)\b/i.test(query)) {
        return { rows: stmt.all().slice(0, 50) };
      }
      const info = stmt.run();
      return { changes: Number(info.changes) };
    },
  };

  return { tools: [runSql], close: () => db.close() };
}
