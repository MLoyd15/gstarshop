import nodemailer from 'nodemailer';

export function isEmailConfigured() {
  return Boolean(process.env.MAIL_USER && process.env.MAIL_APP_PASSWORD);
}

export async function sendPasswordResetCode(email, code) {
  if (!isEmailConfigured()) throw new Error('Password reset email is not configured. Add MAIL_USER and MAIL_APP_PASSWORD to .env.');
  const user = process.env.MAIL_USER;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass: process.env.MAIL_APP_PASSWORD.replace(/\s/g, '') }
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || `G4 Sticker <${user}>`,
    to: email,
    subject: 'Your G4 Sticker password reset code',
    text: `Your password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<p>Your G4 Sticker password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">${code}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`
  });
}
