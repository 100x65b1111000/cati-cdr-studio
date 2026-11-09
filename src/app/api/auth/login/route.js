import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_TTL_S, checkPassword, createSession, secrets } from '../../../../lib/auth';

// In-memory brute-force rate limiter (CWE-307)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const failedAttempts = new Map();

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

function cleanExpiredEntries() {
  const now = Date.now();
  for (const [ip, record] of failedAttempts.entries()) {
    if (now - record.lastAttempt > LOCKOUT_WINDOW_MS) {
      failedAttempts.delete(ip);
    }
  }
}

export async function POST(request) {
  cleanExpiredEntries();
  const ip = getClientIp(request);
  const record = failedAttempts.get(ip);
  const now = Date.now();

  if (record && record.count >= MAX_FAILED_ATTEMPTS) {
    const elapsed = now - record.lastAttempt;
    if (elapsed < LOCKOUT_WINDOW_MS) {
      const waitSeconds = Math.ceil((LOCKOUT_WINDOW_MS - elapsed) / 1000);
      return new NextResponse(
        `Too many failed sign-in attempts. Please try again in ${waitSeconds} seconds.`,
        {
          status: 429,
          headers: {
            'Retry-After': String(waitSeconds),
            'Content-Type': 'text/plain'
          }
        }
      );
    }
    // Lockout expired, reset counter
    failedAttempts.delete(ip);
  }

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

  const isValid = real && (await checkPassword(password, real));

  if (!isValid) {
    const current = failedAttempts.get(ip) || { count: 0, lastAttempt: now };
    failedAttempts.set(ip, { count: current.count + 1, lastAttempt: now });
    return back('/login?error=1');
  }

  // Successful login clears any recorded failed attempts
  failedAttempts.delete(ip);

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
