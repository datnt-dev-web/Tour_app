'use client';

import { useEffect, useState } from 'react';

/** Giá trị chỉ cập nhật sau khi `value` đứng yên `delayMs`, để gõ liên tục không gọi tìm kiếm mỗi phím. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
