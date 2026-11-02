const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendPasswordResetCode(email, code) {
  if (!isEmailConfigured()) {
    throw new Error('Password reset email is not configured. Set RESEND_API_KEY and MAIL_FROM in the server environment.');
  }

  const response = await fetch(RESEND_EMAILS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: [email],
      subject: 'Your G4 Sticker password reset code',
      text: `Your G4 Sticker password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Your G4 Sticker password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`
    })
  });

  if (!response.ok) {
    const error = new Error(`Password reset email provider returned HTTP ${response.status}.`);
    error.code = 'RESEND_API_ERROR';
    error.responseCode = response.status;
    error.command = 'HTTPS API';
    throw error;
  }
}
