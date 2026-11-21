'use server';

import { z } from 'zod';
import { createMembersRepo } from '@/features/groups/repositories/members-repo';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { createAdminSupabase } from '@/shared/supabase/admin';
import { authed } from '@/shared/supabase/authed';
import { createServerSupabase } from '@/shared/supabase/server';
import { createAccountsRepo } from '../repositories/accounts-repo';
import { changePin, signInWithPin } from '../services/username-login-service';

const loginSchema = z.object({ username: z.string().max(64), pin: z.string().max(16) });
const changePinSchema = z.object({ current: z.string().max(16), next: z.string().max(16) });

/**
 * Đăng nhập bằng username + PIN do admin cấp. Admin client chỉ để tra username → email;
 * phiên được tạo bằng signInWithPassword của chính người dùng (ghi vào cookie qua client server).
 */
export async function signInWithUsernameAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { username, pin } = parse(loginSchema, input);
    const admin = createAdminSupabase();
    const session = await createServerSupabase();
    await signInWithPin(
      {
        accounts: createAccountsRepo(admin),
        groups: createMembersRepo(admin),
        findEmail: async (userId) => (await admin.auth.admin.getUserById(userId)).data.user?.email ?? null,
        signIn: async (email, password) => !(await session.auth.signInWithPassword({ email, password })).error,
      },
      username,
      pin,
    );
    return null;
  });
}

/** Đổi PIN của người đang đăng nhập; kiểm PIN hiện tại bằng cách đăng nhập lại chính tài khoản đó. */
export async function changePinAction(input: unknown): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    const { data } = await db.auth.getUser();
    const email = data.user?.email;
    await changePin(
      {
        verify: async (pin) => !!email && !(await db.auth.signInWithPassword({ email, password: pin })).error,
        update: async (pin) => {
          const { error } = await db.auth.updateUser({ password: pin });
          if (error) throw error;
        },
      },
      parse(changePinSchema, input),
    );
    return null;
  });
}
