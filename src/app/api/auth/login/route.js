import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_TTL_S, checkPassword, createSession, secrets } from '../../../../lib/auth';

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

  // `Secure` from the protocol the request actually arrived on, never from NODE_ENV: this
  // runs as `next start` over plain http on a LAN, and a browser will not store a Secure
  // cookie from an origin that is not trustworthy. NODE_ENV said production, so the peer
  // machine's cookie was dropped on arrival and every request came back unauthenticated,
  // while the same sign-in worked on the host because http://localhost IS trustworthy.
  const secure = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim() === 'https';
  const home = back('/');
  home.cookies.set(SESSION_COOKIE, await createSession(secret), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: SESSION_TTL_S
  });
  return home;
}
