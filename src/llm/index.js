import { createGeminiLlm } from './gemini.js';
import { createMockLlm } from './mock.js';

// Є ключ — працюємо зі справжньою Gemini. Немає ключа або LLM=mock — з імітацією.
export function createLlm() {
  if (process.env.LLM === 'mock' || !process.env.GEMINI_API_KEY) return createMockLlm();
  return createGeminiLlm();
}
