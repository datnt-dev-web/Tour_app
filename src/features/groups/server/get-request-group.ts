import 'server-only';
import { cookies } from 'next/headers';
import { AppError } from '@/shared/errors';
import { createServerSupabase } from '@/shared/supabase/server';
import { createGroupsRepo, type Group } from '../repositories/groups-repo';
import { getCurrentGroup, GROUP_COOKIE } from '../services/groups-service';

/** Người dùng + nhóm của request hiện tại, cho Server Component. group null nghĩa là chưa ở nhóm nào; null cả cục là chưa đăng nhập. */
export async function getRequestGroup(): Promise<{ userId: string; group: Group | null } | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const preferred = (await cookies()).get(GROUP_COOKIE)?.value;
  try {
    return { userId: data.user.id, group: await getCurrentGroup(createGroupsRepo(supabase), data.user.id, preferred) };
  } catch (e) {
    if (e instanceof AppError && e.code === 'NO_GROUP') return { userId: data.user.id, group: null };
    throw e;
  }
}
