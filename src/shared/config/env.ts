import { z } from 'zod';

const num = (def: number) => z.coerce.number().int().positive().default(def);

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GOOGLE_PLACES_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  AI_DAILY_LIMIT_PER_GROUP: num(10),
  AI_MONTHLY_CAP: num(300),
  RANK_PRIOR_M: num(50),
  EXPLORE_MIN_REVIEWS: num(20),
  PLACES_TTL_SEC: num(86400),
  GEOCODE_TTL_SEC: num(2592000),
  AI_SUMMARY_TTL_SEC: num(1209600),
  AI_HOT_TTL_SEC: num(604800),
  BOOTSTRAP_OWNER_EMAILS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
});

// Giá trị giữ chỗ trong .env.example / .env.local; coi như chưa cấu hình để khỏi gọi Google vô ích.
const PLACEHOLDER_KEY = /^(your-|dummy)/i;

/** Khóa Google Places có dùng được không (có và không phải giá trị giữ chỗ). */
export function isGooglePlacesConfigured(key: string | undefined): boolean {
  return !!key && !PLACEHOLDER_KEY.test(key);
}

export type Env = z.infer<typeof schema>;

/** Validate env thô; throw lỗi nêu rõ khóa thiếu/sai. Thuần, không đọc process.env. */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Cấu hình môi trường không hợp lệ: ${detail}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Parse process.env lần đầu được gọi (lười), nên import module không throw khi thiếu env. */
export function getEnv(): Env {
  return (cached ??= parseEnv(process.env));
}

/** Truy cập kiểu `env.GEMINI_MODEL`; chỉ validate khi đọc khóa đầu tiên. */
export const env: Env = new Proxy({} as Env, {
  get: (_t, key) => getEnv()[key as keyof Env],
});
