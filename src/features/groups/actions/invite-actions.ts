'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { AppError } from '@/shared/errors';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { authed } from '@/shared/supabase/authed';
import { createAdminSupabase } from '@/shared/supabase/admin';
import { createGroupsRepo } from '../repositories/groups-repo';
import { createInvitesRepo } from '../repositories/invites-repo';
import { createInvite } from '../services/invite-service';

const schema = z.object({ groupId: z.uuid() });

export async function createInviteAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const { groupId } = parse(schema, input);
    const { db, userId } = await authed();
    // Kiểm tra thành viên bằng client theo phiên (RLS) trước khi dùng admin để ghi invites.
    const groups = await createGroupsRepo(db).listGroups(userId);
    if (!groups.some((g) => g.id === groupId)) throw new AppError('FORBIDDEN', 'Bạn không ở trong nhóm này.');
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const proto = h.get('x-forwarded-proto') ?? 'https';
    return createInvite(createInvitesRepo(createAdminSupabase()), { groupId, createdBy: userId, origin: `${proto}://${host}` });
  });
}
