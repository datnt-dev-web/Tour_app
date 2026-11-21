'use server';

import { z } from 'zod';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { AppError } from '@/shared/errors';
import { authed } from '@/shared/supabase/authed';
import { generateShareToken, shareExpiry } from '../services/share';

const schema = z.object({ tripId: z.uuid() });

/** Tạo (hoặc làm mới) link chỉ xem; ghi bằng client người dùng nên RLS bảo đảm chỉ thành viên nhóm làm được. */
export async function createShareLinkAction(input: z.input<typeof schema>): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  return runAction(async () => {
    const { db } = await authed();
    const { tripId } = parse(schema, input);
    const token = generateShareToken();
    const expiresAt = shareExpiry().toISOString();
    const { data, error } = await db.from('trips').update({ share_token: token, share_expires_at: expiresAt }).eq('id', tripId).select('id');
    if (error) throw error;
    if (data.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy chuyến đi.');
    return { token, expiresAt };
  });
}

export async function revokeShareLinkAction(input: z.input<typeof schema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    const { error } = await db.from('trips').update({ share_token: null, share_expires_at: null }).eq('id', parse(schema, input).tripId);
    if (error) throw error;
    return null;
  });
}
