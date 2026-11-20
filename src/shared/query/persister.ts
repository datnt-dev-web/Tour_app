import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';
import pkg from '../../../package.json';

export const PERSIST_KEY = 'ft-query-cache';
export const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000;

/** Đổi bản build thì cache cũ bị bỏ; dev/local rơi về version trong package.json. */
export const PERSIST_BUSTER = process.env.NEXT_PUBLIC_BUILD_ID || pkg.version;

export function createQueryPersister() {
  return createAsyncStoragePersister({
    key: PERSIST_KEY,
    storage: {
      getItem: (k) => get<string>(k).then((v) => v ?? null),
      setItem: (k, v) => set(k, v),
      removeItem: (k) => del(k),
    },
  });
}
