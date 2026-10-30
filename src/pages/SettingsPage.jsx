import { useEffect, useState } from 'react';
import { AppIcon, UserRound, ExternalLink, Sparkles, ShieldCheck, Eye, EyeOff, Check } from '../components/icons.jsx';
import { flowSteps } from '../data/flowSteps.js';
import '../styles/SettingsPage.css';
import { ConfirmDialog } from '../components/ui/alert-dialog.tsx';

const defaultAppearance = { accent: '#0878b8', textScale: 1.15, nightMode: true };
const accentPresets = [
  { label: 'Cyan', value: '#0878b8' }, { label: 'Violet', value: '#6967d9' },
  { label: 'Forest', value: '#26836b' }, { label: 'Coral', value: '#b94753' }, { label: 'Amber', value: '#a66a10' }
];
const sections = [
  { id: 'appearance', label: 'Appearance', icon: Sparkles }
];
const guideProgressKey = 'g4-sticker-guide-progress';
function readGuideProgress() {
  try { const saved = JSON.parse(window.localStorage.getItem(guideProgressKey) || '[]'); return Array.isArray(saved) ? saved.filter((id) => flowSteps.some((step) => step.id === id)).length : 0; }
  catch { return 0; }
}
function IconTile({ icon: Icon }) { return <div className="settings-symbol"><AppIcon icon={Icon} /></div>; }

export default function SettingsPage({ health, appearance, onAppearanceChange, appearanceError, onNavigate, auth }) {
  const [guideProgress, setGuideProgress] = useState(readGuideProgress);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [accountError, setAccountError] = useState('');
  const [accountMessage, setAccountMessage] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [activeSection, setActiveSection] = useState('appearance');
  const [accountOpen, setAccountOpen] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordError, setPasswordError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const nodes = sections.map(({ id }) => document.getElementById(id)).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: '-20% 0px -65% 0px', threshold: [0, .2, .5] });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!accountOpen) return undefined;
    function closeOnEscape(event) { if (event.key === 'Escape') setAccountOpen(false); }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [accountOpen]);
  useEffect(() => { if (!toast) return undefined; const timer = window.setTimeout(() => setToast(''), 2600); return () => window.clearTimeout(timer); }, [toast]);

  async function saveAccount(event, endpoint) {
    event.preventDefault(); setAccountError(''); setAccountMessage(''); setPasswordError('');
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (endpoint.endsWith('password')) {
      if (!values.currentPassword || !values.newPassword || !values.confirmPassword) { setPasswordError('Complete all password fields to continue.'); return; }
      if (values.newPassword.length < 12) { setPasswordError('New password must be at least 12 characters.'); return; }
      if (values.newPassword !== values.confirmPassword) { setPasswordError('New password and confirmation do not match.'); return; }
    }
    delete values.confirmPassword;
    setSavingAccount(true);
    try {
      await auth.updateUser(values, endpoint);
      form.reset();
      const message = endpoint.endsWith('password') ? 'Password updated.' : 'Profile updated.';
      setAccountMessage(message); setToast(endpoint.endsWith('password') ? 'Password updated' : 'Profile saved');
    } catch (error) { setAccountError(error.message); }
    finally { setSavingAccount(false); }
  }
  function resetGuideProgress() {
    try { window.localStorage.setItem(guideProgressKey, '[]'); } catch (error) { console.error('Could not reset guide progress:', error); }
    setGuideProgress(0); setResetConfirmOpen(false); setToast('Progress reset');
  }
  function resetAppearance() { onAppearanceChange(defaultAppearance); setToast('Reset to default'); }
  function togglePassword(name) { setVisiblePasswords((current) => ({ ...current, [name]: !current[name] })); }
  function passwordField(label, name, autoComplete, minLength) {
    return <label className="settings-field" key={name}>{label}<span className="password-input-wrap"><input className="input" name={name} type={visiblePasswords[name] ? 'text' : 'password'} autoComplete={autoComplete} required minLength={minLength} onChange={name === 'newPassword' ? (event) => setPasswordStrength(event.target.value.length) : undefined} /><button type="button" className="password-visibility" aria-label={`${visiblePasswords[name] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => togglePassword(name)}><AppIcon icon={visiblePasswords[name] ? EyeOff : Eye} /></button></span></label>;
  }
  const strengthLevel = passwordStrength >= 12 ? 3 : passwordStrength >= 8 ? 2 : passwordStrength ? 1 : 0;
  const progress = Math.round((guideProgress / Math.max(flowSteps.length, 1)) * 100);
  const dbConnected = health === 'connected';

  return <div className="records-page settings-page">
    <header className="settings-header"><div><div className="t-eyebrow"><span className="accent-line" />PREFERENCES</div><h1 className="t-page-title">Settings</h1><p>Fine-tune your workspace, account, and experience.</p></div>
      <div className="settings-header-actions"><button type="button" className="settings-button secondary" onClick={resetAppearance}>Reset to default</button><button type="button" className="settings-button primary" disabled={savingAccount} onClick={() => setToast('Saved')}>{savingAccount ? 'Saving…' : 'Save changes'}</button></div>
    </header>
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">{sections.map(({ id, label, icon }) => <a key={id} href={`#${id}`} className={activeSection === id ? 'active' : ''} aria-current={activeSection === id ? 'location' : undefined}><AppIcon icon={icon} />{label}</a>)}<button type="button" onClick={() => onNavigate('guide')}><AppIcon icon={ExternalLink} />Learn the flow</button><button type="button" className={accountOpen ? 'active' : ''} onClick={() => setAccountOpen(true)} aria-haspopup="dialog"><AppIcon icon={UserRound} />Account</button></nav>
      <div className="settings-content">
        <section className="panel settings-panel settings-appearance" id="appearance"><div className="settings-card-heading"><IconTile icon={Sparkles} /><div><h2>Appearance</h2><p>Personalize the look and feel of G4 Sticker.</p></div></div>
          {appearanceError && <p className="appearance-error" role="status">{appearanceError}</p>}
          <div className="settings-control-row"><div><h3>Night mode</h3><p>Use the dark glass appearance across your workspace.</p></div><label className="settings-switch" aria-label="Night mode"><input type="checkbox" role="switch" aria-checked={appearance.nightMode} checked={appearance.nightMode} onChange={(event) => onAppearanceChange((current) => ({ ...current, nightMode: event.target.checked }))} /><span className="settings-switch-track"><span /></span><strong>{appearance.nightMode ? 'On' : 'Off'}</strong></label></div>
          <div className="settings-control-block"><div><h3>Accent color</h3><p>Choose a color for buttons, highlights, and navigation.</p></div><div className="accent-options">{accentPresets.map((preset) => <button type="button" key={preset.value} className={`accent-swatch ${appearance.accent.toLowerCase() === preset.value ? 'selected' : ''}`} style={{ '--swatch-color': preset.value }} aria-label={`${preset.label} accent color`} aria-pressed={appearance.accent.toLowerCase() === preset.value} onClick={() => onAppearanceChange((current) => ({ ...current, accent: preset.value }))}><span className="swatch-dot" />{preset.label}{appearance.accent.toLowerCase() === preset.value && <AppIcon icon={Check} />}</button>)}<label className={`accent-swatch custom-accent ${!accentPresets.some((item) => item.value === appearance.accent.toLowerCase()) ? 'selected' : ''}`}><input type="color" aria-label="Choose a custom accent color" value={appearance.accent} onChange={(event) => onAppearanceChange((current) => ({ ...current, accent: event.target.value }))} /><span className="swatch-dot" style={{ '--swatch-color': appearance.accent }} />Custom</label></div></div>
          <div className="settings-control-block text-size-block"><div><h3>Text size</h3><p>Adjust text size across the site to suit your preference.</p></div><div className="text-size-slider"><span className="text-size-small" aria-hidden="true">A</span><input type="range" min="0.9" max="1.4" step="0.05" style={{ '--range-progress': `${((appearance.textScale - 0.9) / 0.5) * 100}%` }} value={appearance.textScale} aria-label="Text size" aria-valuetext={`${Math.round(appearance.textScale / defaultAppearance.textScale * 100)}%`} onChange={(event) => onAppearanceChange((current) => ({ ...current, textScale: Number(event.target.value) }))} /><strong className="text-size-large">A</strong><output>{Math.round(appearance.textScale / defaultAppearance.textScale * 100)}%</output></div></div>
        </section>
        <section className="panel settings-panel" id="guided-tour"><div className="settings-card-heading"><IconTile icon={ExternalLink} /><div><h2>Guided tour</h2><p>Pick up where you left off and explore the workflow.</p></div></div><div className="guide-progress-line"><strong>{guideProgress} of {flowSteps.length} steps viewed</strong><span>{progress}%</span></div><div className="guide-progress-track"><span style={{ width: `${progress}%` }} /></div><div className="guide-settings-actions"><button type="button" className="settings-button primary" onClick={() => onNavigate('guide')}>Learn the flow</button><button type="button" className="settings-button secondary" onClick={() => setResetConfirmOpen(true)}>Reset progress</button></div></section>
      </div>
    </div>
    {accountOpen && <div className="account-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAccountOpen(false); }}>
      <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <header className="account-modal-header"><div><span className="account-modal-eyebrow">ACCOUNT SETTINGS</span><h2 id="account-modal-title">Profile & security</h2><p>Manage your personal details and sign-in credentials.</p></div><button type="button" className="account-modal-close" aria-label="Close account settings" autoFocus onClick={() => setAccountOpen(false)}>×</button></header>
        <div className="profile-summary"><span className="profile-avatar">{(auth?.user?.name || auth?.user?.email || 'G').charAt(0).toUpperCase()}</span><div><strong>{auth?.user?.name || 'Your account'}</strong><span>{auth?.user?.email || 'Add your account details below'}</span></div></div>
        {accountError && <p className="settings-error" role="alert">{accountError}</p>}{accountMessage && <p className="settings-success" role="status">{accountMessage}</p>}
        <div className="account-modal-columns">
          <section className="account-modal-section"><div className="settings-card-heading"><IconTile icon={UserRound} /><div><h3>Profile</h3><p>Update your name and email.</p></div></div>
            <form className="settings-form" onSubmit={(event) => saveAccount(event, '/api/auth/profile')}><label className="settings-field">Name<input className="input" name="name" defaultValue={auth?.user?.name || ''} required /></label><label className="settings-field">Email<input className="input" type="email" name="email" defaultValue={auth?.user?.email || ''} required /></label><button className="settings-button secondary" disabled={savingAccount}>Save profile</button></form>
          </section>
          <section className="account-modal-section"><div className="settings-card-heading"><IconTile icon={ShieldCheck} /><div><h3>Security</h3><p>Change your account password.</p></div></div>{passwordError && <p className="settings-error" role="alert">{passwordError}</p>}
            <form noValidate className="settings-form security-form" onSubmit={(event) => saveAccount(event, '/api/auth/password')}>{passwordField('Current password', 'currentPassword', 'current-password')}{passwordField('New password', 'newPassword', 'new-password', 12)}{passwordField('Confirm new password', 'confirmPassword', 'new-password', 12)}<div className="password-strength" aria-label={`Password strength ${strengthLevel} of 3`}><span className={`strength-${strengthLevel}`} /><span className={`strength-${strengthLevel}`} /><span className={`strength-${strengthLevel}`} /><small>{strengthLevel === 3 ? 'Strong password' : strengthLevel === 2 ? 'Getting stronger' : strengthLevel === 1 ? 'Keep going' : 'Use at least 12 characters'}</small></div><button className="settings-button primary" disabled={savingAccount}>{savingAccount ? 'Updating…' : 'Update password'}</button></form>
          </section>
        </div>
      </section>
    </div>}
    {toast && <div className="settings-toast" role="status"><AppIcon icon={Check} />{toast}</div>}
    <ConfirmDialog open={resetConfirmOpen} title="Reset your guided tour progress?" description="Your viewed steps will be cleared." confirmLabel="Reset progress" onConfirm={resetGuideProgress} onCancel={() => setResetConfirmOpen(false)} />
  </div>;
}
