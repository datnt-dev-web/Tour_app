import { QueryProvider } from '@/shared/query/provider';
import { createServerSupabase } from '@/shared/supabase/server';
import { AppFrame } from '@/shared/ui/app-frame';
import { BottomNav } from '@/shared/ui/bottom-nav';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();

  return (
    <QueryProvider key={data.user?.id ?? 'anon'} userId={data.user?.id ?? null}>
      <AppFrame withNav>
        {children}
        <BottomNav />
      </AppFrame>
    </QueryProvider>
  );
}
