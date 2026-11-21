import { Suspense } from 'react';
import { QueryProvider } from '@/shared/query/provider';
import { getSessionUser } from '@/shared/supabase/session';
import { AppFrame } from '@/shared/ui/app-frame';
import { BottomNav } from '@/shared/ui/bottom-nav';
import { CelebrateGif } from '@/shared/ui/celebrate';
import { OfflineBanner } from '@/shared/ui/offline-banner';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const user = await getSessionUser();

  return (
    <QueryProvider key={user?.id ?? 'anon'} userId={user?.id ?? null}>
      <AppFrame withNav>
        <OfflineBanner />
        {children}
        {/* BottomNav đọc ?view= nên cần Suspense */}
        <Suspense>
          <BottomNav />
        </Suspense>
        <CelebrateGif />
      </AppFrame>
    </QueryProvider>
  );
}
