'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useState, type ReactNode } from 'react';
import { createQueryPersister, PERSIST_BUSTER, PERSIST_MAX_AGE } from './persister';

/** userId null (không có phiên) thì chạy không lưu cache xuống máy. */
export function QueryProvider({ children, userId }: { children: ReactNode; userId: string | null }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, gcTime: PERSIST_MAX_AGE, refetchOnWindowFocus: true },
        },
      }),
  );
  const [persister] = useState(() => (userId ? createQueryPersister(userId) : null));

  if (!persister) return <QueryClientProvider client={client}>{children}</QueryClientProvider>;

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister, maxAge: PERSIST_MAX_AGE, buster: PERSIST_BUSTER }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
