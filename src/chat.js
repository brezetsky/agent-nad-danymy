// Консольний чат з агентом.
// Запуск: npm run chat            — як Олена, менеджерка київської філії
//         npm run chat -- petro   — як Петро, менеджер львівської філії
//         npm run chat -- director
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getUser } from './users.js';
import { createLlm } from './llm/index.js';
import { createTools } from './tools.js';
import { buildSystemPrompt } from './prompt.js';
import { runAgent } from './agent.js';

const gray = (s) => `\x1b[90m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

const user = getUser(process.argv[2]);
const llm = createLlm();
const { tools, close } = createTools({ user });
const system = buildSystemPrompt(user);

console.log(cyan(`Агент мережі кав'ярень «Зерно»`));
console.log(gray(`Користувач: ${user.name} (${user.role}, ${user.branchName})`));
console.log(gray(`LLM: ${llm.name}`));
console.log(gray(`Інструменти: ${tools.map((t) => t.name).join(', ') || 'немає'}`));
console.log(gray('Порожній рядок або «вихід» — завершити.\n'));

const rl = createInterface({ input, output, prompt: '> ' });
let history = [];

try {
  rl.prompt();
  for await (const line of rl) {
    const question = line.trim();
    if (!question || question === 'вихід' || question === 'exit') break;
    try {
      const result = await runAgent({
        question,
        llm,
        tools,
        system,
        history,
        onStep: (step) => console.log(gray(`  [${step.name}] ${JSON.stringify(step.args)}`)),
      });
      history = result.messages;
      console.log(`\n${result.answer}\n`);
    } catch (err) {
      console.error(`Помилка: ${err.message}\n`);
    }
    rl.prompt();
  }
} finally {
  rl.close();
  close();
}
