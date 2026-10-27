import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession, secrets } from './lib/auth';
import { isRevoked } from './lib/db';

// Next 16 renamed this convention from "middleware" to "proxy"; same signature, and
// middleware.js now warns on every boot. Unlike middleware it runs on the Node runtime,
// which is why the revocation table can live in SQLite and be checked here rather than
// only in the route handlers.
export default async function proxy(request) {
  const { session } = secrets();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const ok = session && token && !isRevoked(token) && (await verifySession(session, token));
  const { pathname } = request.nextUrl;
  if (ok) return NextResponse.next();

  // An API caller wants a status, not a login page it will never render.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  if (pathname === '/login') return NextResponse.next();

  // Always back to the root rather than a ?next= deep link: honouring a caller-supplied
  // path is an open redirect, and this app has one screen behind the gate.
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  // Everything, minus the login screen, the auth endpoints that establish it, and the
  // static assets the login screen itself needs.
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)']
};
