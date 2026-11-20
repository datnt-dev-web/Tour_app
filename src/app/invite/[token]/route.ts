import { NextResponse, type NextRequest } from 'next/server';
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE_SEC } from '@/features/groups/constants';

/** Lưu token vào cookie để /auth/callback dùng sau khi đăng nhập, rồi sang /login. */
export async function GET(request: NextRequest, ctx: RouteContext<'/invite/[token]'>) {
  const { token } = await ctx.params;
  const response = NextResponse.redirect(new URL('/login', request.nextUrl.origin));
  response.cookies.set(INVITE_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:', path: '/', maxAge: INVITE_COOKIE_MAX_AGE_SEC });
  return response;
}
