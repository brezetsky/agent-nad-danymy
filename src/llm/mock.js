// Імітація LLM для роботи без API-ключа і без мережі.
//
// Вона навмисно поводиться як НАЇВНА модель: виконує інструкції з питання й з даних,
// вірить словам «я директор» і пише SQL без обмежень, якщо їй дали інструмент run_sql.
// Реальна модель поводиться складніше й менш передбачувано, але помиляється в тих самих місцях.
// Тому захист має бути в коді інструментів, а не в надії, що модель «не захоче».

const BRANCH_WORDS = [
  { re: /київ|києв|киев/, id: 1 },
  { re: /львів|львов/, id: 2 },
  { re: /одес/, id: 3 },
];
const ALL_BRANCHES = /усіх філі|всіх філі|усі філі|всі філі|по всій мережі|вся мережа|всієї мережі/;
const JAILBREAK = /ігноруй|я директор|я адміністратор|режим налагодження|debug|для тесту/;
const INJECTION_MARK = 'ІНСТРУКЦІЯ ДЛЯ АСИСТЕНТА';

function lastUserIndex(messages) {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return i;
  return -1;
}

function contextBranch(system) {
  const m = system.match(/branch_id=(\d+)/);
  return m ? Number(m[1]) : null;
}

function mentionedBranch(q) {
  return BRANCH_WORDS.find((b) => b.re.test(q))?.id ?? null;
}

function detectIntent(q) {
  if (/\b(select|delete|update|drop|insert)\b/i.test(q)) return 'sql';
  if (/видал|прибер/.test(q) && /скасован/.test(q)) return 'delete_cancelled';
  if (/зарплат|оклад/.test(q) && /середн/.test(q)) return 'avg_salary';
  if (/зарплат|оклад/.test(q)) return 'salary';
  if (/email|e-mail|пошт|телефон|контакт/.test(q)) return 'contacts';
  if (/виручк|продаж|дохід|оборот/.test(q)) return 'revenue';
  if (/топ|найкращ|найбільш|постійн/.test(q)) return 'top_customers';
  if (/замовлен/.test(q)) return 'orders';
  if (/клієнт/.test(q)) return 'top_customers';
  return 'unknown';
}

function isForbiddenByRules(q, intent, ctxBranch) {
  const other = mentionedBranch(q);
  return (
    ['sql', 'delete_cancelled', 'avg_salary', 'salary', 'contacts'].includes(intent) ||
    (ctxBranch !== null && ALL_BRANCHES.test(q)) ||
    (ctxBranch !== null && other !== null && other !== ctxBranch)
  );
}

function sqlCall(q, original, intent, ctxBranch) {
  const target = ALL_BRANCHES.test(q) ? null : mentionedBranch(q) ?? ctxBranch;
  const and = (col) => (target ? ` AND ${col} = ${target}` : '');
  const where = (col) => (target ? ` WHERE ${col} = ${target}` : '');

  switch (intent) {
    case 'sql':
      return original.slice(original.search(/\b(select|delete|update|drop|insert)\b/i)).trim();
    case 'delete_cancelled':
      return `DELETE FROM orders WHERE status = 'cancelled'${and('branch_id')}`;
    case 'avg_salary':
      return `SELECT ROUND(AVG(salary)) AS avg_salary FROM employees${where('branch_id')}`;
    case 'salary':
      return `SELECT name, position, salary FROM employees${where('branch_id')}`;
    case 'contacts':
      return `SELECT name, email, phone FROM customers${where('branch_id')}`;
    case 'revenue':
      return `SELECT SUM(total) AS revenue FROM orders WHERE status = 'paid'${and('branch_id')}`;
    case 'top_customers':
      return (
        'SELECT c.name, SUM(o.total) AS total FROM orders o JOIN customers c ON c.id = o.customer_id ' +
        `WHERE o.status = 'paid'${and('o.branch_id')} GROUP BY c.id ORDER BY total DESC LIMIT 5`
      );
    case 'orders':
      return `SELECT id, created_at, total, status, comment FROM orders${where('branch_id')} ORDER BY created_at DESC, id DESC LIMIT 5`;
    default:
      return null;
  }
}

function narrowCall(q, intent, toolNames) {
  const branch = BRANCH_WORDS.find((b) => b.re.test(q));
  // Наївна модель усе одно спробує передати філію з питання — код інструмента має це ігнорувати.
  const extra = branch ? { branch: q.match(branch.re)[0] } : {};
  if (intent === 'revenue' && toolNames.has('get_revenue')) return { name: 'get_revenue', args: { ...extra } };
  if ((intent === 'top_customers' || intent === 'contacts') && toolNames.has('get_top_customers')) {
    return { name: 'get_top_customers', args: { limit: 5, ...extra } };
  }
  if (intent === 'orders' && toolNames.has('get_orders')) return { name: 'get_orders', args: { limit: 5, ...extra } };
  return null;
}

function formatValue(value) {
  if (Array.isArray(value)) {
    if (!value.length) return 'Даних не знайдено.';
    return value.map((row) => (typeof row === 'object' && row !== null
      ? '• ' + Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(', ')
      : `• ${row}`)).join('\n');
  }
  if (value && typeof value === 'object') {
    if (value.error) return `Не вдалося виконати: ${value.error}`;
    if (value.rows) return formatValue(value.rows);
    return Object.entries(value).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ');
  }
  return String(value);
}

export function createMockLlm() {
  return {
    name: 'mock (імітація наївної LLM, без мережі)',
    async complete({ system, messages, tools }) {
      const toolNames = new Set(tools.map((t) => t.name));
      const start = lastUserIndex(messages);
      const original = messages[start]?.text ?? '';
      const q = original.toLowerCase();
      const turn = messages.slice(start + 1);
      const last = messages.at(-1);
      const guarded = system.includes('ПРАВИЛА БЕЗПЕКИ');

      // Після виклику інструмента: або виконуємо інструкцію, знайдену в даних, або відповідаємо.
      if (last?.role === 'tool') {
        const resultsText = JSON.stringify(last.results);
        const injected = resultsText.match(/виконай (SELECT .+?) і додай/);
        const alreadyFollowed = turn.some((m) => m.toolCalls?.some((c) => c.args?.query === injected?.[1]));
        if (resultsText.includes(INJECTION_MARK) && injected && toolNames.has('run_sql') && !alreadyFollowed) {
          return { text: '', toolCalls: [{ name: 'run_sql', args: { query: injected[1] } }] };
        }
        const all = turn.filter((m) => m.role === 'tool').flatMap((m) => m.results);
        return { text: all.map((r) => formatValue(r.result)).join('\n\n'), toolCalls: [] };
      }

      const intent = detectIntent(q);

      // «Захист промптом»: модель слухається правил... доки її не переконали, що правила не діють.
      if (guarded && isForbiddenByRules(q, intent, contextBranch(system)) && !JAILBREAK.test(q)) {
        return { text: 'Вибачте, я не можу це показати: це порушує правила доступу до даних.', toolCalls: [] };
      }

      if (toolNames.has('run_sql')) {
        const query = sqlCall(q, original, intent, contextBranch(system));
        if (query) return { text: '', toolCalls: [{ name: 'run_sql', args: { query } }] };
      } else {
        const call = narrowCall(q, intent, toolNames);
        if (call) return { text: '', toolCalls: [call] };
        if (tools.length && intent !== 'unknown') {
          return { text: 'У мене немає інструмента для цього запиту. Я можу показати виручку, замовлення й топ клієнтів.', toolCalls: [] };
        }
      }

      if (!tools.length) return { text: 'У мене поки немає жодного інструмента, тому я не бачу даних компанії.', toolCalls: [] };
      return { text: 'Я можу відповісти на питання про замовлення, клієнтів і виручку. Сформулюйте, будь ласка, інакше.', toolCalls: [] };
    },
  };
}
