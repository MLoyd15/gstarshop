import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) {
    throw Object.assign(new Error('Password must be between 12 and 200 characters.'), { status: 400 });
  }
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, salt, stored] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !stored) return false;
  const actual = await scrypt(String(password || ''), salt, 64);
  const expected = Buffer.from(stored, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function signingSecret() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters.');
  }
  return process.env.SESSION_SECRET;
}

export function createSession(userId, sessionVersion = 0) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, ver: sessionVersion, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE })).toString('base64url');
  const signature = createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readSession(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = createHmac('sha256', signingSecret()).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return session.exp > Math.floor(Date.now() / 1000) ? session : null;
  } catch { return null; }
}

export function sessionCookie(token, secure = process.env.COOKIE_SECURE === 'true') {
  return `gstarshop_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie(secure = process.env.COOKIE_SECURE === 'true') {
  return `gstarshop_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}
