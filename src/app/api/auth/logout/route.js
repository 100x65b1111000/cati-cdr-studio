import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../lib/auth';

export async function POST(request) {
  const out = NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  out.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return out;
}
