import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { AppError } from '@/shared/errors';
import { createServerSupabase } from '@/shared/supabase/server';
import { getSessionUser } from '@/shared/supabase/session';
import { createGroupsRepo, type Group } from '../repositories/groups-repo';
import { getCurrentGroup, GROUP_COOKIE } from '../services/groups-service';

/**
 * Người dùng + nhóm của request hiện tại, cho Server Component. group null nghĩa là chưa ở nhóm nào; null cả cục là chưa đăng nhập.
 * React.cache: nhiều nơi trong cùng request gọi thì chỉ truy vấn một lần.
 */
export const getRequestGroup = cache(async (): Promise<{ userId: string; group: Group | null } | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const preferred = (await cookies()).get(GROUP_COOKIE)?.value;
  try {
    return { userId: user.id, group: await getCurrentGroup(createGroupsRepo(await createServerSupabase()), user.id, preferred) };
  } catch (e) {
    if (e instanceof AppError && e.code === 'NO_GROUP') return { userId: user.id, group: null };
    throw e;
  }
});
