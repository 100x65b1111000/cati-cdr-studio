import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession, secrets } from './lib/auth';

// Next 16 renamed this convention from "middleware" to "proxy"; same signature, and
// middleware.js now warns on every boot.
export default async function proxy(request) {
  const { session } = secrets();
  const { pathname } = request.nextUrl;
  const ok = session ? await verifySession(session, request.cookies.get(SESSION_COOKIE)?.value) : false;
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
