// Мінімальний клієнт Gemini API з function calling — без SDK, щоб було видно, що відбувається.
// Документація: https://ai.google.dev/gemini-api/docs/function-calling

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

function toGeminiContents(messages) {
  return messages.map((m) => {
    if (m.role === 'user') return { role: 'user', parts: [{ text: m.text }] };
    if (m.role === 'assistant') {
      // Повертаємо відповідь моделі без змін: у ній можуть бути службові поля (наприклад, thoughtSignature).
      if (m.raw) return m.raw;
      const parts = [];
      if (m.text) parts.push({ text: m.text });
      for (const call of m.toolCalls ?? []) parts.push({ functionCall: { name: call.name, args: call.args } });
      return { role: 'model', parts };
    }
    if (m.role === 'tool') {
      return {
        role: 'user',
        parts: m.results.map((r) => ({ functionResponse: { name: r.name, response: { result: r.result } } })),
      };
    }
    throw new Error(`Невідома роль повідомлення: ${m.role}`);
  });
}

export function createGeminiLlm({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite' } = {}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY не задано');

  return {
    name: `gemini (${model})`,
    async complete({ system, messages, tools }) {
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: toGeminiContents(messages),
        generationConfig: { temperature: 0 },
      };
      if (tools.length) {
        body.tools = [{
          functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
        }];
      }

      const res = await fetch(`${API}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(`Gemini API ${res.status}: ${data.error?.message ?? JSON.stringify(data)}`);
      }

      const content = data.candidates?.[0]?.content ?? { role: 'model', parts: [] };
      const parts = content.parts ?? [];
      const toolCalls = parts.filter((p) => p.functionCall).map((p) => ({
        name: p.functionCall.name,
        args: p.functionCall.args ?? {},
      }));
      const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('').trim();
      return { text, toolCalls, raw: content };
    },
  };
}
