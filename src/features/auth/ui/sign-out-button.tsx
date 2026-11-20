'use client';

import { useQueryClient } from '@tanstack/react-query';
import { del } from 'idb-keyval';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { persistKey } from '@/shared/query/persister';
import { createBrowserSupabase } from '@/shared/supabase/browser';
import { Button } from '@/shared/ui/button';

/** Xóa cache lưu trên máy của user này trước khi rời đi, để thiết bị dùng chung không lộ dữ liệu nhóm. */
export function SignOutButton({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    await del(persistKey(userId)).catch(() => {});
    queryClient.clear();
    router.replace('/login');
  }

  return (
    <Button variant="ghost" onClick={signOut} className="px-3">
      <LogOut size={18} aria-hidden />
      Đăng xuất
    </Button>
  );
}
