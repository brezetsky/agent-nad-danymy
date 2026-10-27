import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DB = join(__dirname, '..', 'data', 'company.db');

export function openDb(path = process.env.DB_FILE || DEFAULT_DB, { readOnly = false } = {}) {
  if (!existsSync(path)) {
    throw new Error(`База не знайдена: ${path}. Спочатку виконайте: npm run setup`);
  }
  return new DatabaseSync(path, { readOnly });
}
