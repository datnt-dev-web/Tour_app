import { z } from 'zod';
import { AppError } from '@/shared/errors';

export interface GeminiSource {
  title: string;
  uri: string;
}

export interface PlaceSummary {
  pros: string[];
  cons: string[];
  priceNote: string | null;
  warnings: string[];
  sources: GeminiSource[];
  updatedAt: string;
}

export interface HotSuggestion {
  name: string;
  address: string;
  reason: string;
}

/** Số ý khen/chê tối đa giữ lại, và số quán gợi ý tối đa. */
export const MAX_POINTS = 4;
export const MAX_HOT = 8;

const unusable = () => new AppError('AI_UNUSABLE', 'AI chưa tóm tắt được, thử lại sau.');

const strings = z.array(z.string().trim().min(1)).default([]);
const summarySchema = z.object({
  pros: strings.transform((a) => a.slice(0, MAX_POINTS)),
  cons: strings.transform((a) => a.slice(0, MAX_POINTS)),
  priceNote: z
    .string()
    .nullish()
    .transform((s) => s?.trim() || null),
  warnings: strings,
});
const hotSchema = z.object({
  places: z.array(z.object({ name: z.string().trim().min(1), address: z.string().default(''), reason: z.string().default('') })),
});

/** Lấy JSON trong khối ```json đầu tiên rồi validate; mọi lỗi đều thành AI_UNUSABLE. */
function readJsonBlock<T>(text: string, schema: z.ZodType<T>): T {
  const raw = /```json\s*([\s\S]*?)```/i.exec(text)?.[1];
  if (!raw) throw unusable();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw unusable();
  }
  const result = schema.safeParse(data);
  if (!result.success) throw unusable();
  return result.data;
}

/** Không có nguồn thì tóm tắt không kiểm chứng được nên coi là không dùng được. */
export function parsePlaceSummary(text: string, sources: GeminiSource[], now: Date = new Date()): PlaceSummary {
  if (sources.length === 0) throw unusable();
  const parsed = readJsonBlock(text, summarySchema);
  return { ...parsed, sources, updatedAt: now.toISOString() };
}

export function parseHotPlaces(text: string): HotSuggestion[] {
  return readJsonBlock(text, hotSchema).places.slice(0, MAX_HOT);
}
