import { Router } from 'express';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import User from '../models/user.js';
import { clearSessionCookie, createSession, hashPassword, readSession, sessionCookie, verifyPassword } from '../services/auth.js';
import { verifyGoogleIdToken } from '../services/google-auth.js';
import { isEmailConfigured, sendPasswordResetCode } from '../services/email.js';

function publicUser(user) { return { id: user._id.toString(), name: user.name, email: user.email, role: user.role }; }
function currentUser(request) {
  const token = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('gstarshop_session='))?.slice('gstarshop_session='.length);
  return readSession(token);
}

export function requireAuth(request, response, next) {
  const session = currentUser(request);
  if (!session) return response.status(401).json({ error: 'Please sign in to continue.' });
  User.findById(session.sub).select('sessionVersion').then((user) => {
    if (!user || (session.ver ?? -1) !== (user.sessionVersion || 0)) return response.status(401).json({ error: 'Please sign in to continue.' });
    request.authUserId = session.sub;
    next();
  }).catch(next);
}

const resetRequestsByAddress = new Map();
function codeDigest(email, code) {
  return createHmac('sha256', process.env.SESSION_SECRET).update(`${email}:${code}`).digest();
}
function matchesCode(email, code, storedHash) {
  if (!storedHash) return false;
  const expected = Buffer.from(storedHash, 'hex');
  const actual = codeDigest(email, code);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createAuthRouter() {
  const router = Router();
  router.post('/forgot-password', async (request, response, next) => {
    try {
      if (!isEmailConfigured()) return response.status(503).json({ error: 'Password reset email is not configured. Add MAIL_USER and MAIL_APP_PASSWORD to .env, then restart the server.' });
      const email = String(request.body?.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Enter a valid email address.' });
      const requestKey = request.ip || request.socket.remoteAddress || 'unknown';
      const now = Date.now();
      const recentRequests = (resetRequestsByAddress.get(requestKey) || []).filter((time) => now - time < 10 * 60 * 1000);
      if (recentRequests.length >= 3) return response.status(429).json({ error: 'Too many reset requests. Please wait 10 minutes and try again.' });
      recentRequests.push(now);
      resetRequestsByAddress.set(requestKey, recentRequests);

      const user = await User.findOne({ email }).select('+resetCodeHash +resetCodeExpiresAt +resetCodeAttempts +resetCodeSentAt');
      if (user && (!user.resetCodeSentAt || now - user.resetCodeSentAt.getTime() >= 60 * 1000)) {
        const code = String(randomInt(0, 1000000)).padStart(6, '0');
        user.resetCodeHash = codeDigest(email, code).toString('hex');
        user.resetCodeExpiresAt = new Date(now + 10 * 60 * 1000);
        user.resetCodeAttempts = 0;
        user.resetCodeSentAt = new Date(now);
        await user.save();
        try { await sendPasswordResetCode(email, code); }
        catch (error) {
          user.resetCodeHash = undefined; user.resetCodeExpiresAt = undefined; user.resetCodeAttempts = 0; user.resetCodeSentAt = undefined;
          await user.save();
          if (error.message.startsWith('Password reset email is not configured')) return response.status(503).json({ error: error.message });
          return response.status(503).json({ error: 'Could not send the reset email. Check the Gmail mail settings and try again.' });
        }
      }
      response.json({ message: 'If an account exists for that email, a reset code has been sent.' });
    } catch (error) { next(error); }
  });
  router.post('/reset-password', async (request, response, next) => {
    try {
      const email = String(request.body?.email || '').trim().toLowerCase();
      const code = String(request.body?.code || '').trim();
      const newPassword = request.body?.newPassword;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) return response.status(400).json({ error: 'Enter the email address and six-digit code from the reset email.' });
      if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 200) return response.status(400).json({ error: 'Password must be between 12 and 200 characters.' });
      const user = await User.findOne({ email }).select('+resetCodeHash +resetCodeExpiresAt +resetCodeAttempts');
      if (!user?.resetCodeHash || !user.resetCodeExpiresAt || user.resetCodeExpiresAt.getTime() <= Date.now() || user.resetCodeAttempts >= 5) {
        return response.status(400).json({ error: 'That code is invalid or expired. Request a new one and try again.' });
      }
      if (!matchesCode(email, code, user.resetCodeHash)) {
        user.resetCodeAttempts += 1;
        if (user.resetCodeAttempts >= 5) { user.resetCodeHash = undefined; user.resetCodeExpiresAt = undefined; }
        await user.save();
        return response.status(400).json({ error: 'That code is invalid or expired. Request a new one and try again.' });
      }
      user.passwordHash = await hashPassword(newPassword);
      user.sessionVersion = (user.sessionVersion || 0) + 1;
      user.resetCodeHash = undefined; user.resetCodeExpiresAt = undefined; user.resetCodeAttempts = 0; user.resetCodeSentAt = undefined;
      await user.save();
      response.json({ ok: true, message: 'Password reset. You can now sign in.' });
    } catch (error) {
      if (error.status === 400) return response.status(400).json({ error: error.message });
      next(error);
    }
  });
  router.post('/register', async (request, response, next) => {
    try {
      const name = String(request.body?.name || '').trim();
      const email = String(request.body?.email || '').trim().toLowerCase();
      if (!name || name.length > 100) return response.status(400).json({ error: 'Enter your name (up to 100 characters).' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Enter a valid email address.' });
      const passwordHash = await hashPassword(request.body?.password);
      const user = await User.create({ name, email, passwordHash, role: 'member' });
      response.setHeader('Set-Cookie', sessionCookie(createSession(user._id.toString(), user.sessionVersion || 0)));
      response.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 11000) return response.status(409).json({ error: 'An account with that email already exists.' });
      if (error.status === 400) return response.status(400).json({ error: error.message });
      next(error);
    }
  });
  router.post('/google', async (request, response, next) => {
    try {
      const identity = await verifyGoogleIdToken(request.body?.credential, process.env.GOOGLE_CLIENT_ID);
      if (!identity) return response.status(401).json({ error: 'Google could not verify this sign-in. Please try again.' });
      let user = await User.findOne({ googleId: identity.sub });
      if (!user) {
        user = await User.findOne({ email: identity.email });
        if (user) {
          user.googleId = identity.sub;
          await user.save();
        } else {
          user = await User.create({ name: identity.name, email: identity.email, googleId: identity.sub, role: 'member' });
        }
      }
      response.setHeader('Set-Cookie', sessionCookie(createSession(user._id.toString(), user.sessionVersion || 0)));
      response.json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 11000) return response.status(409).json({ error: 'This Google account is already linked to another profile.' });
      if (error.message === 'Google sign-in is not configured.') return response.status(503).json({ error: 'Google sign-in is not configured on the server.' });
      if (error.message === 'Google sign-in verification is temporarily unavailable.') return response.status(503).json({ error: error.message });
      next(error);
    }
  });
  router.post('/login', async (request, response, next) => {
    try {
      const email = String(request.body?.email || '').trim().toLowerCase();
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user || !(await verifyPassword(request.body?.password, user.passwordHash))) {
        return response.status(401).json({ error: 'Email or password is incorrect.' });
      }
      response.setHeader('Set-Cookie', sessionCookie(createSession(user._id.toString(), user.sessionVersion || 0)));
      response.json({ user: publicUser(user) });
    } catch (error) { next(error); }
  });
  router.get('/me', async (request, response, next) => {
    try {
      const session = currentUser(request);
      if (!session) return response.status(401).json({ error: 'Please sign in to continue.' });
      const user = await User.findById(session.sub);
      if (!user || (session.ver ?? -1) !== (user.sessionVersion || 0)) return response.status(401).json({ error: 'Please sign in to continue.' });
      response.json({ user: publicUser(user) });
    } catch (error) { next(error); }
  });
  router.post('/logout', (_request, response) => {
    response.setHeader('Set-Cookie', clearSessionCookie());
    response.status(204).end();
  });
  router.patch('/profile', requireAuth, async (request, response, next) => {
    try {
      const name = String(request.body?.name || '').trim();
      const email = String(request.body?.email || '').trim().toLowerCase();
      if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Enter a name and valid email address.' });
      const user = await User.findByIdAndUpdate(request.authUserId, { name, email }, { new: true, runValidators: true });
      response.json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 11000) return response.status(409).json({ error: 'That email address is already in use.' });
      next(error);
    }
  });
  router.patch('/password', requireAuth, async (request, response, next) => {
    try {
      const user = await User.findById(request.authUserId).select('+passwordHash');
      if (!(await verifyPassword(request.body?.currentPassword, user.passwordHash))) return response.status(400).json({ error: 'Current password is incorrect.' });
      user.passwordHash = await hashPassword(request.body?.newPassword);
      user.sessionVersion = (user.sessionVersion || 0) + 1;
      await user.save();
      response.json({ ok: true });
    } catch (error) { if (error.status === 400) return response.status(400).json({ error: error.message }); next(error); }
  });
  return router;
}
