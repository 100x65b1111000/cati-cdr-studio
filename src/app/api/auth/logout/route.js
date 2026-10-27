import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../lib/auth';
import { revokeSession } from '../../../../lib/db';

export async function POST(request) {
  // Clearing the cookie only forgets it here; revoking it stops the same value working
  // from anywhere else it was kept.
  revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
  const out = NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  out.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return out;
}
