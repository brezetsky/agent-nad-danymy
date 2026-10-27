import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAgent } from '../src/agent.js';

// Підставна LLM: спочатку просить інструмент, потім відповідає текстом.
function scriptedLlm(replies) {
  let i = 0;
  return { name: 'scripted', complete: async () => replies[i++] };
}

test('агент викликає інструмент і повертає фінальну відповідь', async () => {
  const calls = [];
  const tools = [{ name: 'echo', description: '', parameters: { type: 'object' }, run: (args) => { calls.push(args); return { ok: true }; } }];
  const llm = scriptedLlm([
    { text: '', toolCalls: [{ name: 'echo', args: { x: 1 } }] },
    { text: 'Готово', toolCalls: [] },
  ]);
  const result = await runAgent({ question: 'тест', llm, tools, system: '' });
  assert.equal(result.answer, 'Готово');
  assert.deepEqual(calls, [{ x: 1 }]);
  assert.equal(result.steps.length, 1);
});

test('помилка інструмента не валить агента, а повертається моделі', async () => {
  const tools = [{ name: 'boom', description: '', parameters: { type: 'object' }, run: () => { throw new Error('бах'); } }];
  const llm = scriptedLlm([
    { text: '', toolCalls: [{ name: 'boom', args: {} }] },
    { text: 'Сталася помилка', toolCalls: [] },
  ]);
  const result = await runAgent({ question: 'тест', llm, tools, system: '' });
  assert.deepEqual(result.steps[0].result, { error: 'бах' });
});

test('агент зупиняється після maxSteps', async () => {
  const tools = [{ name: 'loop', description: '', parameters: { type: 'object' }, run: () => ({}) }];
  const llm = { name: 'loop', complete: async () => ({ text: '', toolCalls: [{ name: 'loop', args: {} }] }) };
  const result = await runAgent({ question: 'тест', llm, tools, system: '', maxSteps: 3 });
  assert.equal(result.steps.length, 3);
  assert.match(result.answer, /кількість кроків/);
});
