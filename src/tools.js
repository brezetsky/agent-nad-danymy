// Інструменти, які агент може викликати.
// Кожен інструмент: { name, description, parameters (JSON Schema), run(args) }.
//
// TODO (крок 1): додайте інструмент run_sql, який виконує SQL-запит,
// написаний моделлю, і повертає рядки результату.
import { openDb } from './db.js';

export function createTools({ user, dbPath } = {}) {
  const db = openDb(dbPath);

  const tools = [];

  return { tools, close: () => db.close() };
}
