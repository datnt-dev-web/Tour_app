'use client';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useState, type ReactNode } from 'react';
import { createQueryPersister, PERSIST_BUSTER, PERSIST_MAX_AGE } from './persister';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, gcTime: PERSIST_MAX_AGE, refetchOnWindowFocus: true },
        },
      }),
  );
  const [persister] = useState(createQueryPersister);

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister, maxAge: PERSIST_MAX_AGE, buster: PERSIST_BUSTER }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
