// Shared by src/proxy.js and the auth route handlers. Web Crypto rather than node:crypto:
// the same code runs in the request pipeline and in a plain `node ui-check.mjs` process,
// and crypto.subtle is a global in both.

import { readFileSync } from 'node:fs';
import path from 'node:path';

export const SESSION_COOKIE = 'cati_cdr_session';
// Same path instrumentation.js writes at boot; the two constants live apart because
// that file is compiled for the edge runtime too and must not import this module.
const SESSION_BOOT_FILE = path.join('data', '.session-boot');
export const SESSION_TTL_S = 12 * 60 * 60;

const encoder = new TextEncoder();

function toB64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

// `===` is not constant time, but both sides here are fixed-length HMAC digests, never
// the secret or the password, so early exit leaks nothing an attacker can act on.
export async function createSession(secret) {
  const exp = Date.now() + SESSION_TTL_S * 1000;
  return `${exp}.${toB64Url(await hmac(secret, String(exp)))}`;
}

export async function verifySession(secret, token) {
  if (typeof token !== 'string' || !token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = toB64Url(await hmac(secret, exp));
  return expected.length === sig.length && expected === sig;
}

// Hash-then-compare so the plaintext never reaches a timing-sensitive path. Length is
// the only thing a probe could infer, which is not worth a constant-time shim for one
// shared office password.
export async function checkPassword(candidate, real) {
  if (!real) return false;
  const digest = async (s) => toB64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s))));
  return (await digest(candidate)) === (await digest(real));
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
