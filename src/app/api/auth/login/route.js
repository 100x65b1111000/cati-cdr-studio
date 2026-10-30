import { NextResponse } from 'next/server';
import { SESSION_COOKIE, checkPassword, createSession, secrets, sessionAge } from '../../../../lib/auth';

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const password = String(form?.get('password') ?? '');
  const { password: real, session: secret } = secrets();

  // Relative, not `NextResponse.redirect(new URL(path, request.url))`: a route handler
  // reports `request.url` with the dev server's own localhost origin, so an absolute
  // Location sends a browser that came in over the LAN back to its own machine — and
  // the session cookie it just received is scoped to the host it signed in on, so the
  // login silently fails. A relative Location keeps the browser where it already is.
  const back = (path) => new NextResponse(null, { status: 303, headers: { location: path } });

  // No secret configured is a broken deploy, not a wrong guess — say so rather than
  // reporting a bad password forever.
  if (!secret) throw new Error('SESSION_SECRET is not set; the session cookie cannot be signed.');

  if (!real || !(await checkPassword(password, real))) return back('/login?error=1');

  const home = back('/');
  home.cookies.set(SESSION_COOKIE, await createSession(secret), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionAge()
  });
  return home;
}
