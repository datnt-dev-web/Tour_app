import { LoginForm } from '@/features/auth/ui/login-form';
import { AppFrame } from '@/shared/ui/app-frame';

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { error } = await searchParams;
  return (
    <AppFrame>
      <main className="animate-enter flex min-h-dvh flex-col justify-center gap-8 p-6">
        <header>
          <h1 className="text-2xl font-extrabold">Food Tour nhóm</h1>
          <p className="mt-1 text-sm text-muted">Cùng nhóm bạn chọn quán ăn cho mỗi chuyến đi.</p>
        </header>
        <LoginForm error={typeof error === 'string' ? error : undefined} />
      </main>
    </AppFrame>
  );
}
