import { NextResponse } from 'next/server';
import { SESSION_COOKIE, checkPassword, createSession, secrets, sessionAge } from '../../../../lib/auth';

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const password = String(form?.get('password') ?? '');
  const { password: real, session: secret } = secrets();

  const back = (path) => NextResponse.redirect(new URL(path, request.url), { status: 303 });

  // No secret configured is a broken deploy, not a wrong guess — say so rather than
  // reporting a bad password forever.
  if (!secret) throw new Error('SESSION_SECRET is not set; the session cookie cannot be signed.');

  if (!real || !(await checkPassword(password, real))) return back('/login?error=1');

  const home = NextResponse.redirect(new URL('/', request.url), { status: 303 });
  home.cookies.set(SESSION_COOKIE, await createSession(secret), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionAge()
  });
  return home;
}
