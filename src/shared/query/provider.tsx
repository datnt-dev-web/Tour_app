'use client';

import { defaultShouldDehydrateQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useState, type ReactNode } from 'react';
import { createQueryPersister, PERSIST_BUSTER, PERSIST_MAX_AGE } from './persister';
import { HYDRATING_KEY } from './use-query';

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
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        buster: PERSIST_BUSTER,
        // Key tạm của lần render hydrate (useQuery dùng chung) không phải dữ liệu thật: không lưu xuống máy.
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.queryKey[0] !== HYDRATING_KEY && defaultShouldDehydrateQuery(q) },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
