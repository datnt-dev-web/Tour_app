'use server';

import { z } from 'zod';
import { createMembersRepo } from '@/features/groups/repositories/members-repo';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { createAdminSupabase } from '@/shared/supabase/admin';
import { createServerSupabase } from '@/shared/supabase/server';
import { createAccountsRepo } from '../repositories/accounts-repo';
import { findLoginUser } from '../services/username-login-service';

const schema = z.object({ username: z.string().max(64) });

/**
 * Đăng nhập chỉ bằng username (theo yêu cầu: không mật khẩu). Admin tạo link magiclink cho user
 * rồi xác thực ngay ở server, nên phiên được ghi vào cookie mà không gửi email nào.
 */
export async function signInWithUsernameAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { username } = parse(schema, input);
    const admin = createAdminSupabase();
    const userId = await findLoginUser({ accounts: createAccountsRepo(admin), groups: createMembersRepo(admin) }, username);

    const { data: found, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !found.user.email) throw userError ?? new Error(`User ${userId} không có email.`);
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: found.user.email });
    if (linkError) throw linkError;

    const { error } = await (await createServerSupabase()).auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
    if (error) throw error;
    return null;
  });
}
