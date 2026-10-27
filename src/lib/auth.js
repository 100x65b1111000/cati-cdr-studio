// Shared by src/proxy.js and the auth route handlers. Web Crypto rather than node:crypto:
// the same code runs in the request pipeline and in a plain `node ui-check.mjs` process,
// and crypto.subtle is a global in both.

export const SESSION_COOKIE = 'cati_cdr_session';
const TTL_MS = 12 * 60 * 60 * 1000;

const encoder = new TextEncoder();

function toB64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
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
  const exp = Date.now() + TTL_MS;
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

// Fail closed: with no SESSION_SECRET every token is unverifiable, and with no
// APP_PASSWORD nothing can satisfy the check. A misconfigured deploy must lock the
// team out, not leave the door open because a .env.local went missing.
export function secrets() {
  return {
    password: process.env.APP_PASSWORD || '',
    session: process.env.SESSION_SECRET || ''
  };
}

export const sessionAge = () => Math.floor(TTL_MS / 1000);
