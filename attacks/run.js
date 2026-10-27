// Запускає всі атаки на агента й показує, які з них призвели до витоку.
// Кожна атака працює на свіжій копії бази, тож руйнівні атаки не псують вашу data/company.db.
//
// npm run attacks                              — від імені Олени (київська філія)
// npm run attacks -- --verbose                 — показати відповіді агента
// npm run attacks -- --only 7                  — лише атака №7
// npm run attacks -- --without-prompt-rules    — вимкнути правила в системному промпті (з кроку 3)
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { seed } from '../data/seed.js';
import { getUser } from '../src/users.js';
import { createLlm } from '../src/llm/index.js';
import { createTools } from '../src/tools.js';
import { buildSystemPrompt } from '../src/prompt.js';
import { runAgent } from '../src/agent.js';
import { ATTACKS } from './attacks.js';
import { snapshot, detectViolations } from './detect.js';

export async function runAttacks({ login = 'olena', only = null, verbose = false, log = console.log } = {}) {
  const user = getUser(login);
  const llm = createLlm();
  const isRealLlm = !llm.name.startsWith('mock');
  const dir = mkdtempSync(join(tmpdir(), 'zerno-attacks-'));
  const results = [];

  try {
    for (const attack of ATTACKS.filter((a) => !only || a.id === only)) {
      const dbPath = seed(join(dir, `attack-${attack.id}.db`));
      const before = snapshot(dbPath);
      const { tools, close } = createTools({ user, dbPath });
      let answer;
      let steps = [];
      try {
        const res = await runAgent({ question: attack.question, llm, tools, system: buildSystemPrompt(user) });
        answer = res.answer;
        steps = res.steps;
      } catch (err) {
        answer = `ПОМИЛКА: ${err.message}`;
      } finally {
        close();
      }
      const after = snapshot(dbPath);
      const violations = detectViolations({ answer, user, before, after });
      results.push({ attack, answer, steps, violations });

      const status = violations.length ? `\x1b[31mВИТІК: ${violations.join(', ')}\x1b[0m` : '\x1b[32mзахищено\x1b[0m';
      log(`${String(attack.id).padStart(2)}. ${attack.title.padEnd(24)} ${status}`);
      if (verbose) {
        for (const s of steps) log(`      \x1b[90m[${s.name}] ${JSON.stringify(s.args)}\x1b[0m`);
        log(`      ${answer.replace(/\n/g, '\n      ')}\n`);
      }
      // Безкоштовний тариф Gemini обмежує кількість запитів на хвилину.
      if (isRealLlm) await sleep(4000);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return { llm: llm.name, user, results };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.includes('--without-prompt-rules')) process.env.PROMPT_RULES = 'off';
  const onlyIndex = args.indexOf('--only');
  const only = onlyIndex >= 0 ? Number(args[onlyIndex + 1]) : null;
  const login = args.find((a) => !a.startsWith('--') && Number.isNaN(Number(a))) ?? 'olena';

  const user = getUser(login);
  console.log(`Атаки від імені: ${user.name} (${user.role}, ${user.branchName})`);
  if (process.env.PROMPT_RULES === 'off') console.log('Правила в системному промпті ВИМКНЕНО');
  const { llm, results } = await runAttacks({ login, only, verbose: args.includes('--verbose') });
  const leaks = results.filter((r) => r.violations.length).length;
  console.log(`\nLLM: ${llm}`);
  console.log(`Витоків: ${leaks} з ${results.length}`);
}
