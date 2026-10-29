import { OAuth2Client } from 'google-auth-library';

const clients = new Map();

export async function verifyGoogleIdToken(token, clientId) {
  if (!clientId) throw new Error('Google sign-in is not configured.');
  if (typeof token !== 'string' || token.length > 12000) return null;
  try {
    let client = clients.get(clientId);
    if (!client) {
      client = new OAuth2Client(clientId);
      clients.set(clientId, client);
    }
    const ticket = await client.verifyIdToken({ idToken: token, audience: clientId });
    const payload = ticket.getPayload();
    const email = String(payload?.email || '').toLowerCase();
    const googleEmail = payload?.email_verified === true && (email.endsWith('@gmail.com') || Boolean(payload?.hd));
    if (!payload?.sub || !googleEmail) return null;
    return { sub: payload.sub, email, name: String(payload.name || email).slice(0, 100) };
  } catch { return null; }
}
