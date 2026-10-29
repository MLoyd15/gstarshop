import { useRef, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import logo from '../../assets/logo.png';
import GoogleSignInButton from './GoogleSignInButton.jsx';
import AuthStickerPlayground from './AuthStickerPlayground.jsx';

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
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const cursorGlow = useRef(null);
  function moveCursor(event) {
    if (event.pointerType === 'mouse' && cursorGlow.current) cursorGlow.current.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  }
  const handleGoogleCredential = async (credential) => {
    setError(''); setBusy(true);
    try { await googleLogin(credential); }
    catch (googleError) { setError(googleError.message); }
    finally { setBusy(false); }
  };
  const handleGoogleError = (message) => setError(message);
  if (checking) return <div className="auth-loading" role="status">Loading your workspace…</div>;
  if (user) return children;
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (resetMode && !resetCodeSent) {
        const response = await fetch('/api/auth/forgot-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not send a reset code.');
        setResetCodeSent(true); setSuccess(result.message || 'If an account exists for that email, a reset code has been sent.');
      } else if (resetMode) {
        if (newPassword !== confirmPassword) throw new Error('The passwords do not match.');
        const response = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code: resetCode, newPassword }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not reset your password.');
        setResetMode(false); setResetCodeSent(false); setResetCode(''); setNewPassword(''); setConfirmPassword(''); setPassword('');
        setSuccess('Your password was reset. Sign in with your new password.');
      } else {
        await login(email, password, registering ? name : undefined);
      }
    }
    catch (loginError) { setError(loginError.message); }
    finally { setBusy(false); }
  }
  const heading = resetMode ? (resetCodeSent ? 'Choose a new password' : 'Reset your password') : registering ? 'Create your account' : 'Welcome back';
  const subtitle = resetMode ? (resetCodeSent ? 'Enter the six-digit code from your email.' : 'We’ll email you a one-time reset code.') : registering ? 'Register to access the G4 Sticker workspace.' : 'Sign in to manage your business.';
  return <main className="auth-page" onPointerMove={moveCursor}><div className="auth-cursor-glow" ref={cursorGlow} aria-hidden="true"/><div className="auth-shell"><aside className="auth-story" aria-label="G4 Sticker workspace"><div className="auth-brand"><img src={logo} alt=""/><span>G4 <b>Sticker</b></span></div><div className="auth-story-copy"><span className="auth-story-kicker"><Sparkles size={14}/> YOUR BUSINESS, IN MOTION</span><h2>Make every<br/>detail <em>count.</em></h2><p>One clear workspace for your bookings, inventory, team and growth.</p><AuthStickerPlayground/></div><div className="auth-story-foot"><ShieldCheck size={16}/> A secure space for your business</div></aside><section className="auth-card"><div className="auth-card-brand"><img src={logo} alt=""/><span>G4 <b>Sticker</b></span></div><p className="auth-eyebrow">{resetMode ? 'ACCOUNT RECOVERY' : registering ? 'GET STARTED' : 'BUSINESS WORKSPACE'}</p><h1>{heading}</h1><p className="auth-subtitle">{subtitle}</p><form onSubmit={submit} className="auth-form">
    {!resetMode && registering && <label>Your name<input className="input" type="text" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} autoFocus /></label>}
    <label>Email address<span className="auth-input-wrap"><Mail size={17} aria-hidden="true"/><input className="input" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required readOnly={resetMode && resetCodeSent} autoFocus={!registering} /></span></label>
    {resetMode && resetCodeSent ? <>
      <label>Six-digit code<input className="input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={resetCode} onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required /></label>
      <label>New password<span className="auth-input-wrap"><LockKeyhole size={17} aria-hidden="true"/><input className="input" type={showResetPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={200} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required/><button className="auth-password-toggle" type="button" onClick={() => setShowResetPassword((visible) => !visible)} aria-label={showResetPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showResetPassword}>{showResetPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
      <label>Confirm new password<span className="auth-input-wrap"><LockKeyhole size={17} aria-hidden="true"/><input className="input" type={showConfirmPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} maxLength={200} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required/><button className="auth-password-toggle" type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword}>{showConfirmPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label>
    </> : resetMode ? null : <label>Password<span className="auth-input-wrap"><LockKeyhole size={17} aria-hidden="true"/><input className="input" type={showPassword ? 'text' : 'password'} autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={registering ? 12 : undefined} /><button className="auth-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span>{registering && <span className="auth-field-note">Use at least 12 characters.</span>}</label>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {success && <p className="auth-success" role="status">{success}</p>}
    <button className="btn btn-primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : resetMode ? (resetCodeSent ? 'Reset password' : 'Send reset code') : registering ? 'Create account' : 'Sign in'}</button>
  </form>{!resetMode && <><div className="auth-divider"><span>or continue with</span></div><GoogleSignInButton onCredential={handleGoogleCredential} onError={handleGoogleError} /></>}
  <p className="auth-switch">{resetMode ? 'Remembered it?' : registering ? 'Already have an account?' : 'New to G4 Sticker?'} <button type="button" onClick={() => { setResetMode(false); setResetCodeSent(false); setResetCode(''); setNewPassword(''); setConfirmPassword(''); setError(''); setSuccess(''); setRegistering((current) => resetMode ? false : !current); }}>{resetMode ? 'Back to sign in' : registering ? 'Sign in' : 'Create an account'}</button></p>
  {!registering && !resetMode && <p className="auth-switch"><button type="button" onClick={() => { setResetMode(true); setResetCodeSent(false); setError(''); setSuccess(''); }}>Forgot password?</button></p>}
  <p className="auth-footer"><ShieldCheck size={14}/> Secure access to your G4 Sticker workspace</p></section></div></main>;
}
