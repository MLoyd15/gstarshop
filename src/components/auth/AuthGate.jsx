import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Hash, LockKeyhole, Mail, User } from 'lucide-react';
import GoogleSignInButton from './GoogleSignInButton.jsx';
import AuthStickerPlayground from './AuthStickerPlayground.jsx';

const ALERT_ICON = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    aria-hidden="true"
    style={{ flex: 'none', marginTop: '2px' }}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6M12 16.5v.5" />
  </svg>
);

export default function AuthGate({ checking, user, login, googleLogin, children }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [shaking, setShaking] = useState(false);

  const nameInputRef = useRef(null);
  const emailInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const codeInputRef = useRef(null);
  const newPasswordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  // Local device time in the top bar
  const [localTime, setLocalTime] = useState('');
  useEffect(() => {
    function tick() {
      const d = new Date();
      const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      setLocalTime(`${dateStr} · ${timeStr}`);
    }
    tick();
    const interval = setInterval(tick, 15000);
    return () => clearInterval(interval);
  }, []);

  // Light / dark theme toggle with system preference fallback and storage sync
  const [isDark, setIsDark] = useState(() => {
    if (typeof document !== 'undefined' && document.documentElement.dataset.theme) {
      return document.documentElement.dataset.theme === 'dark';
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    const nextTheme = isDark ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    try {
      const saved = JSON.parse(localStorage.getItem('g4-sticker-appearance') || '{}');
      saved.nightMode = isDark;
      localStorage.setItem('g4-sticker-appearance', JSON.stringify(saved));
    } catch (_) {}
  }, [isDark]);

  function triggerShake() {
    setShaking(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setShaking(true));
    });
  }

  function clearField(field) {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: '' }));
    }
    if (error) setError('');
    if (success) setSuccess('');
  }

  function clearFeedback() {
    setError('');
    setSuccess('');
    setFieldErrors({});
  }

  function handleCheckCapsLock(event) {
    if (event.getModifierState) {
      setCapsLockOn(event.getModifierState('CapsLock'));
    }
  }

  const handleGoogleCredential = async (credential) => {
    if (busy) return;
    clearFeedback();
    setBusy(true);
    try {
      await googleLogin(credential);
    } catch (googleError) {
      setError(googleError.message);
      triggerShake();
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleError = (message) => {
    if (!busy) {
      setError(message);
      triggerShake();
    }
  };

  async function requestResetCode() {
    const cleanEmail = email.trim().toLowerCase();
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not send a reset code.');
    setResetCodeSent(true);
    setSuccess(result.message || 'If an account exists for that email, a reset code has been sent.');
  }

  async function resendResetCode() {
    if (busy) return;
    clearFeedback();
    setBusy(true);
    try {
      await requestResetCode();
    } catch (resetError) {
      setError(resetError.message);
      triggerShake();
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="auth-loading" role="status">
        Loading your workspace…
      </div>
    );
  }

  if (user) return children;

  async function submit(event) {
    event.preventDefault();
    if (busy) return; // Prevent double submit

    clearFeedback();
    const cleanEmail = email.trim().toLowerCase();
    const errors = {};
    let firstErrorField = null;

    if (!resetMode && registering) {
      const cleanName = name.trim();
      if (!cleanName) {
        errors.name = 'Enter your name.';
        if (!firstErrorField) firstErrorField = nameInputRef.current;
      }
    }

    if (!cleanEmail) {
      errors.email = 'Enter your email.';
      if (!firstErrorField) firstErrorField = emailInputRef.current;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Enter a valid email address.';
      if (!firstErrorField) firstErrorField = emailInputRef.current;
    }

    if (resetMode) {
      if (resetCodeSent) {
        if (!resetCode || resetCode.length !== 6) {
          errors.code = 'Enter the six-digit code from your email.';
          if (!firstErrorField) firstErrorField = codeInputRef.current;
        }
        if (!newPassword) {
          errors.newPassword = 'Enter a new password.';
          if (!firstErrorField) firstErrorField = newPasswordInputRef.current;
        } else if (newPassword.length < 12) {
          errors.newPassword = 'Password must be at least 12 characters.';
          if (!firstErrorField) firstErrorField = newPasswordInputRef.current;
        }
        if (!confirmPassword) {
          errors.confirmPassword = 'Confirm your new password.';
          if (!firstErrorField) firstErrorField = confirmPasswordInputRef.current;
        } else if (newPassword && newPassword !== confirmPassword) {
          errors.confirmPassword = 'The passwords do not match.';
          if (!firstErrorField) firstErrorField = confirmPasswordInputRef.current;
        }
      }
    } else {
      if (!password) {
        errors.password = 'Enter your password.';
        if (!firstErrorField) firstErrorField = passwordInputRef.current;
      } else if (registering && password.length < 12) {
        errors.password = 'Password must be at least 12 characters.';
        if (!firstErrorField) firstErrorField = passwordInputRef.current;
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      triggerShake();
      firstErrorField?.focus();
      return;
    }

    setBusy(true);
    try {
      if (resetMode && !resetCodeSent) {
        await requestResetCode();
      } else if (resetMode) {
        if (newPassword !== confirmPassword) throw new Error('The passwords do not match.');
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, code: resetCode, newPassword }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not reset your password.');
        setResetMode(false);
        setResetCodeSent(false);
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
        setPassword('');
        setSuccess('Your password was reset. Sign in with your new password.');
      } else {
        await login(cleanEmail, password, registering ? name.trim() : undefined);
      }
    } catch (loginError) {
      setError(loginError.message);
      triggerShake();
    } finally {
      setBusy(false);
    }
  }

  const heading = resetMode
    ? resetCodeSent
      ? 'Choose a new password'
      : 'Reset your password'
    : registering
    ? 'Create your account'
    : 'Welcome back';

  const subtitle = resetMode
    ? resetCodeSent
      ? 'Enter the six-digit code from your email.'
      : 'We’ll email you a one-time reset code.'
    : registering
    ? 'Register to access the G4 Sticker workspace.'
    : 'Sign in to manage bookings, stock and payroll.';

  return (
    <main className="auth-page">
      <div className="auth-bar">
        {localTime && (
          <span className="auth-pill" aria-label="Local time">
            {localTime}
          </span>
        )}
        <button
          className="auth-pill"
          type="button"
          onClick={() => setIsDark((prev) => !prev)}
        >
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
      </div>

      <AuthStickerPlayground />

      <div className="auth-wrap">
        <div
          className={`auth-card${shaking ? ' shake' : ''}`}
          onAnimationEnd={() => setShaking(false)}
        >
          <div className="auth-cmyk" aria-hidden="true">
            <i style={{ background: '#00AEEF' }} />
            <i style={{ background: '#EC008C' }} />
            <i style={{ background: '#FFD500' }} />
            <i style={{ background: '#14121F' }} />
          </div>

          <div className="auth-body">
            <div className="auth-brand">
              <div className="auth-mark" aria-hidden="true">
                G4
              </div>
              <div>
                <b>G4 Sticker</b>
                <span>Decals, tarpaulin and signage</span>
              </div>
            </div>

            <h1>{heading}</h1>
            <p className="auth-sub">{subtitle}</p>

            <form onSubmit={submit} noValidate>
              {!resetMode && registering && (
                <div className="auth-field">
                  <label className="auth-label" htmlFor="auth-name">
                    Your name
                  </label>
                  <div className="auth-ctl">
                    <User className="auth-ic" aria-hidden="true" />
                    <input
                      ref={nameInputRef}
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      maxLength={100}
                      disabled={busy}
                      aria-invalid={!!fieldErrors.name}
                      aria-describedby={fieldErrors.name ? 'auth-name-err' : undefined}
                      onChange={(event) => {
                        setName(event.target.value);
                        clearField('name');
                      }}
                    />
                  </div>
                  {fieldErrors.name && (
                    <p className="auth-msg auth-err" id="auth-name-err" aria-live="polite">
                      {ALERT_ICON}
                      <span>{fieldErrors.name}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-email">
                  Email
                </label>
                <div className="auth-ctl">
                  <Mail className="auth-ic" aria-hidden="true" />
                  <input
                    ref={emailInputRef}
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    readOnly={resetMode && resetCodeSent}
                    disabled={busy}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? 'auth-email-err' : undefined}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      clearField('email');
                    }}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="auth-msg auth-err" id="auth-email-err" aria-live="polite">
                    {ALERT_ICON}
                    <span>{fieldErrors.email}</span>
                  </p>
                )}
              </div>

              {resetMode && resetCodeSent ? (
                <>
                  <div className="auth-field">
                    <label className="auth-label" htmlFor="auth-code">
                      Six-digit code
                    </label>
                    <div className="auth-ctl">
                      <Hash className="auth-ic" aria-hidden="true" />
                      <input
                        ref={codeInputRef}
                        id="auth-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={resetCode}
                        disabled={busy}
                        aria-invalid={!!fieldErrors.code}
                        aria-describedby={fieldErrors.code ? 'auth-code-err' : undefined}
                        onChange={(event) => {
                          setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                          clearField('code');
                        }}
                      />
                    </div>
                    {fieldErrors.code && (
                      <p className="auth-msg auth-err" id="auth-code-err" aria-live="polite">
                        {ALERT_ICON}
                        <span>{fieldErrors.code}</span>
                      </p>
                    )}
                  </div>

                  <div className="auth-inline-actions">
                    <button type="button" disabled={busy} onClick={resendResetCode}>
                      {busy ? 'Sending…' : 'Resend code'}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setResetCodeSent(false);
                        setResetCode('');
                        clearFeedback();
                      }}
                    >
                      Use a different email
                    </button>
                  </div>

                  <div className="auth-field">
                    <label className="auth-label" htmlFor="auth-new-password">
                      New password
                    </label>
                    <div className="auth-ctl auth-pw">
                      <LockKeyhole className="auth-ic" aria-hidden="true" />
                      <input
                        ref={newPasswordInputRef}
                        id="auth-new-password"
                        type={showResetPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={12}
                        maxLength={200}
                        value={newPassword}
                        disabled={busy}
                        aria-invalid={!!fieldErrors.newPassword}
                        aria-describedby={fieldErrors.newPassword ? 'auth-new-pw-err' : undefined}
                        onChange={(event) => {
                          setNewPassword(event.target.value);
                          clearField('newPassword');
                        }}
                        onKeyDown={handleCheckCapsLock}
                        onKeyUp={handleCheckCapsLock}
                        onBlur={() => setCapsLockOn(false)}
                      />
                      <button
                        className="auth-eye"
                        type="button"
                        disabled={busy}
                        onClick={() => setShowResetPassword((v) => !v)}
                        aria-label={showResetPassword ? 'Hide new password' : 'Show new password'}
                        aria-pressed={showResetPassword}
                      >
                        {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {fieldErrors.newPassword && (
                      <p className="auth-msg auth-err" id="auth-new-pw-err" aria-live="polite">
                        {ALERT_ICON}
                        <span>{fieldErrors.newPassword}</span>
                      </p>
                    )}
                  </div>

                  <div className="auth-field">
                    <label className="auth-label" htmlFor="auth-confirm-password">
                      Confirm new password
                    </label>
                    <div className="auth-ctl auth-pw">
                      <LockKeyhole className="auth-ic" aria-hidden="true" />
                      <input
                        ref={confirmPasswordInputRef}
                        id="auth-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={12}
                        maxLength={200}
                        value={confirmPassword}
                        disabled={busy}
                        aria-invalid={!!fieldErrors.confirmPassword}
                        aria-describedby={fieldErrors.confirmPassword ? 'auth-confirm-pw-err' : undefined}
                        onChange={(event) => {
                          setConfirmPassword(event.target.value);
                          clearField('confirmPassword');
                        }}
                        onKeyDown={handleCheckCapsLock}
                        onKeyUp={handleCheckCapsLock}
                        onBlur={() => setCapsLockOn(false)}
                      />
                      <button
                        className="auth-eye"
                        type="button"
                        disabled={busy}
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                        aria-pressed={showConfirmPassword}
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && (
                      <p className="auth-msg auth-err" id="auth-confirm-pw-err" aria-live="polite">
                        {ALERT_ICON}
                        <span>{fieldErrors.confirmPassword}</span>
                      </p>
                    )}
                  </div>
                </>
              ) : resetMode ? null : (
                <div className="auth-field">
                  <label className="auth-label" htmlFor="auth-password">
                    Password
                  </label>
                  <div className="auth-ctl auth-pw">
                    <LockKeyhole className="auth-ic" aria-hidden="true" />
                    <input
                      ref={passwordInputRef}
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={registering ? 'new-password' : 'current-password'}
                      value={password}
                      disabled={busy}
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={
                        fieldErrors.password
                          ? 'auth-password-err'
                          : capsLockOn
                          ? 'auth-caps-lock'
                          : undefined
                      }
                      onChange={(event) => {
                        setPassword(event.target.value);
                        clearField('password');
                      }}
                      onKeyDown={handleCheckCapsLock}
                      onKeyUp={handleCheckCapsLock}
                      onBlur={() => setCapsLockOn(false)}
                    />
                    <button
                      className="auth-eye"
                      type="button"
                      disabled={busy}
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {capsLockOn && (
                    <p className="auth-msg auth-caps" id="auth-caps-lock">
                      Caps Lock is on.
                    </p>
                  )}
                  {registering && (
                    <span className="auth-field-note">Use at least 12 characters.</span>
                  )}
                  {fieldErrors.password && (
                    <p className="auth-msg auth-err" id="auth-password-err" aria-live="polite">
                      {ALERT_ICON}
                      <span>{fieldErrors.password}</span>
                    </p>
                  )}
                </div>
              )}

              {!registering && !resetMode && (
                <div className="auth-row">
                  <button
                    type="button"
                    className="auth-linkbtn"
                    disabled={busy}
                    onClick={() => {
                      setResetMode(true);
                      setResetCodeSent(false);
                      clearFeedback();
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button className="auth-go" type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <span className="auth-spin" aria-hidden="true" />
                    <span>
                      {resetMode
                        ? resetCodeSent
                          ? 'Resetting…'
                          : 'Sending…'
                        : registering
                        ? 'Creating account…'
                        : 'Signing in…'}
                    </span>
                  </>
                ) : resetMode ? (
                  resetCodeSent ? (
                    'Reset password'
                  ) : (
                    'Send reset code'
                  )
                ) : registering ? (
                  'Create account'
                ) : (
                  'Sign in'
                )}
              </button>

              {error && (
                <p className="auth-status-alert auth-status-err" role="alert" aria-live="polite">
                  {ALERT_ICON}
                  <span>{error}</span>
                </p>
              )}

              {success && (
                <p className="auth-status-alert auth-status-ok" role="status" aria-live="polite">
                  <span>{success}</span>
                </p>
              )}
            </form>

            {!resetMode && (
              <>
                <div className="auth-divider">
                  <span>or continue with</span>
                </div>
                <GoogleSignInButton
                  onCredential={handleGoogleCredential}
                  onError={handleGoogleError}
                />
              </>
            )}

            <p className="auth-switch">
              {resetMode
                ? 'Remembered your password?'
                : registering
                ? 'Already have an account?'
                : 'New to G4 Sticker?'}{' '}
              <button
                type="button"
                className="auth-linkbtn"
                disabled={busy}
                onClick={() => {
                  setResetMode(false);
                  setResetCodeSent(false);
                  setResetCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                  clearFeedback();
                  setRegistering((current) => (resetMode ? false : !current));
                }}
              >
                {resetMode ? 'Back to sign in' : registering ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
