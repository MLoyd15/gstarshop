import test from 'node:test';
import assert from 'node:assert/strict';
import { isEmailConfigured, sendPasswordResetCode } from './email.js';

function withEnvironment(values, work) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve()
    .then(work)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test('email configuration requires both Resend API key and verified sender', async () => {
  await withEnvironment({ RESEND_API_KEY: undefined, MAIL_FROM: undefined }, async () => {
    assert.equal(isEmailConfigured(), false);
  });
  await withEnvironment({ RESEND_API_KEY: 'test-key', MAIL_FROM: 'G4 <noreply@example.com>' }, async () => {
    assert.equal(isEmailConfigured(), true);
  });
});

test('password reset code is sent through Resend HTTPS API', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200 };
  };

  try {
    await withEnvironment({
      RESEND_API_KEY: 'test-key',
      MAIL_FROM: 'G4 <noreply@example.com>'
    }, () => sendPasswordResetCode('customer@example.com', '123456'));

    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.Authorization, 'Bearer test-key');
    assert.deepEqual(JSON.parse(request.options.body), {
      from: 'G4 <noreply@example.com>',
      to: ['customer@example.com'],
      subject: 'Your G4 Sticker password reset code',
      text: 'Your G4 Sticker password reset code is 123456. It expires in 10 minutes. If you did not request this, you can ignore this email.',
      html: '<p>Your G4 Sticker password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:8px">123456</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>'
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Resend API rejection exposes a safe status code for server diagnostics', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 403 });

  try {
    await withEnvironment({
      RESEND_API_KEY: 'test-key',
      MAIL_FROM: 'G4 <noreply@example.com>'
    }, async () => {
      await assert.rejects(sendPasswordResetCode('customer@example.com', '123456'), (error) => {
        assert.equal(error.code, 'RESEND_API_ERROR');
        assert.equal(error.responseCode, 403);
        assert.equal(error.command, 'HTTPS API');
        return true;
      });
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
