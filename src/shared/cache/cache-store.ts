export interface CacheStore {
  /** Trả null khi không có/hết hạn; vì vậy giá trị lưu phải khác null. */
  get<T>(k: string): Promise<T | null>;
  set<T>(k: string, v: T, ttlSec: number): Promise<void>;
  /** Tăng 1 nguyên tử; TTL chỉ đặt khi khóa mới được tạo (giá trị = 1). */
  incr(k: string, ttlSec: number): Promise<number>;
  decr(k: string): Promise<number>;
}
