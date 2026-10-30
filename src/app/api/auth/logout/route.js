import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../lib/auth';
import { revokeSession } from '../../../../lib/db';

export async function POST(request) {
  // Clearing the cookie only forgets it here; revoking it stops the same value working
  // from anywhere else it was kept.
  revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
  // Relative for the same reason as the login redirect: `request.url` carries the dev
  // server's own localhost origin, and an absolute Location would hand a LAN browser a
  // link to its own machine.
  const out = new NextResponse(null, { status: 303, headers: { location: '/login' } });
  out.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return out;
}
