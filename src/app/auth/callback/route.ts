import { NextResponse, type NextRequest } from 'next/server';
import { canAccess } from '@/features/auth/services/access-service';
import { INVITE_COOKIE } from '@/features/groups/constants';
import { createInvitesRepo } from '@/features/groups/repositories/invites-repo';
import { acceptInvite } from '@/features/groups/services/invite-service';
import { env } from '@/shared/config/env';
import { AppError } from '@/shared/errors';
import { createAdminSupabase } from '@/shared/supabase/admin';
import { createServerSupabase } from '@/shared/supabase/server';

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const toLogin = (error?: string) => NextResponse.redirect(`${origin}/login${error ? `?error=${error}` : ''}`);

  const code = searchParams.get('code');
  if (!code) return toLogin();

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return toLogin();

  const repo = createInvitesRepo(createAdminSupabase());
  const token = request.cookies.get(INVITE_COOKIE)?.value;
  const access = await canAccess(repo, { id: data.user.id, email: data.user.email }, env.BOOTSTRAP_OWNER_EMAILS, token);
  if (access === 'denied') {
    await supabase.auth.signOut();
    return toLogin('not-invited');
  }

  if (access === 'invite' && token) {
    try {
      await acceptInvite(repo, token, data.user.id);
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      // Token bị người khác dùng giữa lúc canAccess và acceptInvite: coi như không có lời mời.
      await supabase.auth.signOut();
      const res = toLogin('not-invited');
      res.cookies.delete(INVITE_COOKIE);
      return res;
    }
  }

  const response = NextResponse.redirect(`${origin}/`);
  response.cookies.delete(INVITE_COOKIE);
  return response;
}
