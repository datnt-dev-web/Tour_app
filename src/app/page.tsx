import { AppFrame } from '@/shared/ui/app-frame';
import { BottomNav } from '@/shared/ui/bottom-nav';

export default function Home() {
  return (
    <AppFrame withNav>
      <main className="p-4">
        <h1 className="text-xl font-extrabold">Chuyến đi</h1>
      </main>
      <BottomNav />
    </AppFrame>
  );
}
