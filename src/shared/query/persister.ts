import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';
import pkg from '../../../package.json';

const PERSIST_KEY_PREFIX = 'ft-query-cache';
/** Mỗi user một khóa riêng để thiết bị dùng chung không lộ dữ liệu nhóm của người trước. */
export const persistKey = (userId: string) => `${PERSIST_KEY_PREFIX}:${userId}`;
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Đổi bản build thì cache cũ bị bỏ (dữ liệu API đổi dạng mà vẫn đọc cache cũ sẽ làm vỡ màn hình).
 * Vercel tự cấp mã commit mỗi lần deploy; dev/local rơi về version trong package.json (đổi dạng dữ liệu thì nâng version).
 */
export const PERSIST_BUSTER = process.env.NEXT_PUBLIC_BUILD_ID || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || pkg.version;

export function createQueryPersister(userId: string) {
  return createAsyncStoragePersister({
    key: persistKey(userId),
    storage: {
      getItem: (k) => get<string>(k).then((v) => v ?? null),
      setItem: (k, v) => set(k, v),
      removeItem: (k) => del(k),
    },
  });
}
