// Цикл агента. Реалізуємо разом на кроці 1.
//
// Ідея:
// 1. Додаємо питання користувача до історії повідомлень.
// 2. Надсилаємо в LLM: системний промпт + історію + опис інструментів.
// 3. Якщо LLM відповіла текстом — це фінальна відповідь.
// 4. Якщо LLM попросила викликати інструмент (toolCalls) — виконуємо його,
//    додаємо результат в історію і повертаємося до кроку 2.
// 5. Обмежуємо кількість кроків, щоб агент не зациклився.
//
// Формат повідомлень в історії:
//   { role: 'user', text }
//   { role: 'assistant', text, toolCalls: [{ name, args }], raw }
//   { role: 'tool', results: [{ name, result }] }

export async function runAgent({ question, llm, tools, system, history = [], maxSteps = 5, onStep }) {
  const messages = [...history, { role: 'user', text: question }];

  // TODO (крок 1): реалізуйте цикл агента.

  return {
    answer: 'Агент ще не реалізований — це завдання кроку 1.',
    steps: [],
    messages,
  };
}
