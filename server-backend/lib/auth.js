// Shared by src/proxy.js and the auth route handlers. Web Crypto rather than node:crypto:
// the same code runs in the request pipeline and in a plain `node ui-check.mjs` process,
// and crypto.subtle is a global in both.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'cati_cdr_session';
// Same path instrumentation.js writes at boot; the two constants live apart because
// that file is compiled for the edge runtime too and must not import this module.
const SESSION_BOOT_FILE = path.join('data', '.session-boot');
export const SESSION_TTL_S = 12 * 60 * 60;

const encoder = new TextEncoder();

function toB64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Constant-time comparison to prevent timing attacks (CWE-208).
 */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

/**
 * Mints a cryptographically secure session token.
 * Injects a random UUID to ensure unpredictability and prevent session collisions (CWE-330).
 */
export async function createSession(secret) {
  const exp = Date.now() + SESSION_TTL_S * 1000;
  const nonce = crypto.randomUUID();
  const payload = `${exp}.${nonce}`;
  const sig = toB64Url(await hmac(secret, payload));
  return `${payload}.${sig}`;
}

export async function verifySession(secret, token) {
  if (typeof token !== 'string' || !token) return false;
  const parts = token.split('.');
  if (parts.length === 3) {
    const [exp, nonce, sig] = parts;
    if (!exp || !nonce || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
    const expected = toB64Url(await hmac(secret, `${exp}.${nonce}`));
    return safeEqual(sig, expected);
  }
  // Graceful fallback for legacy 2-part tokens during active rotation
  if (parts.length === 2) {
    const [exp, sig] = parts;
    if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
    const expected = toB64Url(await hmac(secret, exp));
    return safeEqual(sig, expected);
  }
  return false;
}

/**
 * Constant-time password verification using SHA-256 digest + timingSafeEqual (CWE-208).
 */
export async function checkPassword(candidate, real) {
  if (!real || typeof candidate !== 'string') return false;
  const digest = async (s) => Buffer.from(await crypto.subtle.digest('SHA-256', encoder.encode(s)));
  const candDigest = await digest(candidate);
  const realDigest = await digest(real);
  return timingSafeEqual(candDigest, realDigest);
}

// The nonce instrumentation.js rewrites at every server start. A missing file falls
// back to the env secret alone, so a build that never ran the boot hook still signs in
// rather than failing every request.
function bootNonce() {
  try {
    return readFileSync(SESSION_BOOT_FILE, 'utf8').trim();
  } catch {
    return '';
  }
}

// Fail closed: with no SESSION_SECRET every token is unverifiable, and with no
// APP_PASSWORD nothing can satisfy the check. A misconfigured deploy must lock the
// team out, not leave the door open because a .env.local went missing. The signing key
// is the env secret plus the boot nonce, so a restart retires every outstanding cookie.
export function secrets() {
  const session = process.env.SESSION_SECRET || '';
  return {
    password: process.env.APP_PASSWORD || '',
    session: session && `${session}:${bootNonce()}`
  };
}
