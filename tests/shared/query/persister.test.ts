import 'fake-indexeddb/auto';
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { get } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { createQueryPersister, persistKey, PERSIST_MAX_AGE } from '@/shared/query/persister';

const key = ['trips', 'g1'];

async function save(buster: string, userId = 'u1') {
  const client = new QueryClient();
  client.setQueryData(key, [{ id: 't1' }]);
  const persister = createQueryPersister(userId);
  await persistQueryClientSave({ queryClient: client, persister, buster });
  return persister;
}

async function restore(persister: ReturnType<typeof createQueryPersister>, buster: string) {
  const client = new QueryClient();
  await persistQueryClientRestore({ queryClient: client, persister, buster, maxAge: PERSIST_MAX_AGE });
  return client;
}

describe('createQueryPersister', () => {
  beforeEach(async () => {
    const { clear } = await import('idb-keyval');
    await clear();
  });

  it('ghi vào idb-keyval rồi khôi phục lại cache', async () => {
    const persister = await save('v1');
    expect(await get(persistKey('u1'))).toBeTruthy();
    expect((await restore(persister, 'v1')).getQueryData(key)).toEqual([{ id: 't1' }]);
  });

  it('không khôi phục khi buster khác', async () => {
    const persister = await save('v1');
    expect((await restore(persister, 'v2')).getQueryData(key)).toBeUndefined();
  });

  it('không khôi phục cache của người dùng khác', async () => {
    await save('v1', 'u1');
    const client = await restore(createQueryPersister('u2'), 'v1');
    expect(client.getQueryData(key)).toBeUndefined();
  });
});
