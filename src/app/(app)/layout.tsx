import { QueryProvider } from '@/shared/query/provider';
import { AppFrame } from '@/shared/ui/app-frame';
import { BottomNav } from '@/shared/ui/bottom-nav';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <QueryProvider>
      <AppFrame withNav>
        {children}
        <BottomNav />
      </AppFrame>
    </QueryProvider>
  );
}
