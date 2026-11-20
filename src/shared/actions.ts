import type { z } from 'zod';
import { AppError } from './errors';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

const RLS_VIOLATION = '42501';

function isPostgrestError(e: unknown): e is { code: string; message: string } {
  return typeof e === 'object' && e !== null && 'code' in e && 'details' in e && 'hint' in e;
}

/** Chạy một server action: AppError và lỗi Postgres thành kết quả lỗi sạch (không lộ text DB), lỗi lạ ném tiếp để Next ghi log. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: { code: e.code, message: e.message } };
    if (isPostgrestError(e)) {
      console.error('[action] lỗi DB', e);
      return e.code === RLS_VIOLATION
        ? { ok: false, error: { code: 'FORBIDDEN', message: 'Bạn không có quyền với dữ liệu này.' } }
        : { ok: false, error: { code: 'DB_ERROR', message: 'Có lỗi khi lưu dữ liệu, thử lại sau.' } };
    }
    throw e;
  }
}

/** Phía client: lấy data hoặc ném AppError để useMutation đi vào onError. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new AppError(result.error.code, result.error.message);
  return result.data;
}

/** Validate input của action; sai thì INVALID_INPUT (không lộ chi tiết schema). */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new AppError('INVALID_INPUT', 'Dữ liệu không hợp lệ.');
  return r.data;
}
