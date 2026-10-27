// Журнал аудиту: хто, коли, який інструмент і з якими аргументами викликав.
// Без нього ви не дізнаєтеся, що агент уже комусь щось «розповів».
import { appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG = join(__dirname, '..', 'data', 'audit.log');

export function withAudit(tool, user, logFile = process.env.AUDIT_LOG || DEFAULT_LOG) {
  return {
    ...tool,
    run(args) {
      const entry = { time: new Date().toISOString(), user: user.login, role: user.role, tool: tool.name, args };
      try {
        const result = tool.run(args);
        entry.rows = Array.isArray(result) ? result.length : undefined;
        return result;
      } catch (err) {
        entry.error = err.message;
        throw err;
      } finally {
        appendFileSync(logFile, JSON.stringify(entry) + '\n');
      }
    },
  };
}
