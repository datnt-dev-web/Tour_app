import { AppError } from './errors';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

/** Chạy một server action: AppError thành kết quả lỗi sạch, lỗi lạ ném tiếp để Next ghi log. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: { code: e.code, message: e.message } };
    throw e;
  }
}

/** Phía client: lấy data hoặc ném AppError để useMutation đi vào onError. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new AppError(result.error.code, result.error.message);
  return result.data;
}
