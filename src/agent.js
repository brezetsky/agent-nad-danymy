// Цикл агента: LLM вирішує, який інструмент викликати, ми його виконуємо
// й повертаємо результат, доки LLM не дасть фінальну текстову відповідь.
//
// Формат повідомлень в історії:
//   { role: 'user', text }
//   { role: 'assistant', text, toolCalls: [{ name, args }], raw }
//   { role: 'tool', results: [{ name, result }] }

export async function runAgent({ question, llm, tools, system, history = [], maxSteps = 5, onStep }) {
  const messages = [...history, { role: 'user', text: question }];
  const steps = [];

  for (let i = 0; i < maxSteps; i++) {
    const reply = await llm.complete({ system, messages, tools });
    messages.push({ role: 'assistant', text: reply.text, toolCalls: reply.toolCalls, raw: reply.raw });

    if (!reply.toolCalls?.length) {
      return { answer: reply.text || '(порожня відповідь)', steps, messages };
    }

    const results = [];
    for (const call of reply.toolCalls) {
      const tool = tools.find((t) => t.name === call.name);
      let result;
      try {
        result = tool ? await tool.run(call.args ?? {}) : { error: `Невідомий інструмент: ${call.name}` };
      } catch (err) {
        result = { error: err.message };
      }
      const step = { name: call.name, args: call.args ?? {}, result };
      steps.push(step);
      onStep?.(step);
      results.push({ name: call.name, result });
    }
    messages.push({ role: 'tool', results });
  }

  return { answer: 'Не вдалося отримати відповідь за допустиму кількість кроків.', steps, messages };
}
