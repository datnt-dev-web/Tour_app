import 'server-only';
import { GoogleGenAI } from '@google/genai';
import { AppError } from '@/shared/errors';
import type { GeminiSource } from './parse';

export interface GeminiClient {
  groundedJson(prompt: string): Promise<{ text: string; sources: GeminiSource[] }>;
}

/** Gemini + Google Search grounding. Không đặt responseSchema cùng googleSearch nên JSON do prompt yêu cầu và parse.ts đọc. */
export function createGeminiClient(apiKey: string, model: string): GeminiClient {
  const ai = new GoogleGenAI({ apiKey });
  return {
    async groundedJson(prompt) {
      try {
        const res = await ai.models.generateContent({ model, contents: prompt, config: { tools: [{ googleSearch: {} }] } });
        const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
        const sources = new Map<string, GeminiSource>();
        for (const c of chunks) {
          if (c.web?.uri && !sources.has(c.web.uri)) sources.set(c.web.uri, { uri: c.web.uri, title: c.web.title || c.web.uri });
        }
        return { text: res.text ?? '', sources: [...sources.values()] };
      } catch {
        throw new AppError('AI_UNAVAILABLE', 'AI đang bận, thử lại sau.');
      }
    },
  };
}
