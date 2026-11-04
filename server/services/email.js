const BREVO_EMAILS_URL = 'https://api.brevo.com/v3/smtp/email';

export function isEmailConfigured() {
  return Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

export async function sendPasswordResetCode(email, code) {
  if (!isEmailConfigured()) {
    throw new Error('Password reset email is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in the server environment.');
  }

  const response = await fetch(BREVO_EMAILS_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'G4 Sticker', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email }],
      subject: 'Your G4 Sticker password reset code',
      textContent: `Your G4 Sticker password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      htmlContent: `<p>Your G4 Sticker password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`
    })
  });

  if (!response.ok) {
    const error = new Error(`Password reset email provider returned HTTP ${response.status}.`);
    error.code = 'BREVO_API_ERROR';
    error.responseCode = response.status;
    error.command = 'HTTPS API';
    throw error;
  }
}
