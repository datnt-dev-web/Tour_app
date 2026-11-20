import 'server-only';
import { AppError } from '@/shared/errors';
import { createServerSupabase } from './server';

/** Phiên người dùng + client theo phiên (RLS là chốt chặn cuối); chưa đăng nhập ném UNAUTHENTICATED. Tách khỏi actions.ts vì file đó cũng được client import. */
export async function authed() {
  const db = await createServerSupabase();
  const { data } = await db.auth.getUser();
  if (!data.user) throw new AppError('UNAUTHENTICATED', 'Bạn cần đăng nhập.');
  return { db, userId: data.user.id };
}
