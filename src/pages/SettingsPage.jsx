import { useState } from 'react';
import { flowSteps } from '../data/flowSteps.js';
import '../styles/SettingsPage.css';
import { ConfirmDialog } from '../components/ui/alert-dialog.tsx';
const defaultAppearance={accent:'#0878b8',textScale:1.15,nightMode:true};
const accentPresets=[{label:'Cyan',value:'#0878b8'},{label:'Violet',value:'#6967d9'},{label:'Forest',value:'#26836b'},{label:'Coral',value:'#b94753'},{label:'Amber',value:'#a66a10'}];




const guideProgressKey = 'g4-sticker-guide-progress';

function readGuideProgress() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(guideProgressKey) || '[]');
    return Array.isArray(saved) ? saved.filter((id) => flowSteps.some((step) => step.id === id)).length : 0;
  } catch {
    return 0;
  }
}

export default function SettingsPage({ health, appearance, onAppearanceChange, appearanceError, onNavigate }) {
  const [guideProgress, setGuideProgress] = useState(readGuideProgress);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  function resetGuideProgress() {
    try {
      window.localStorage.setItem(guideProgressKey, '[]');
    } catch (error) {
      console.error('Could not reset guide progress:', error);
    }
    setGuideProgress(0);
    setResetConfirmOpen(false);
  }

  return <div className="records-page settings-page"><div className="welcome-row records-welcome"><div><div className="t-eyebrow"><span className="accent-line" />PREFERENCES</div><h1 className="t-page-title">Settings</h1><p>Manage your workspace and account preferences.</p></div></div>
    <section className="panel appearance-panel">
      <div className="appearance-heading"><div><div className="settings-symbol">✦</div><h2>Make it yours</h2><p>Personalize the look of G4 Sticker. Changes apply immediately and are saved on this device.</p></div>
        <button type="button" className="btn btn-secondary appearance-reset" onClick={() => onAppearanceChange(defaultAppearance)}>Reset to default</button>
      </div>
      {appearanceError && <p className="appearance-error" role="status">{appearanceError}</p>}
      <div className="appearance-options">
        <fieldset className="appearance-control theme-mode-control">
          <legend>Night mode</legend>
          <p>Use the dark glass appearance across the workspace.</p>
          <label className="theme-mode-toggle"><input type="checkbox" checked={appearance.nightMode}
            onChange={(event) => onAppearanceChange((current) => ({ ...current, nightMode: event.target.checked }))} />
            <span className="theme-mode-track" aria-hidden="true"><span /></span><strong>{appearance.nightMode ? 'On' : 'Off'}</strong>
          </label>
        </fieldset>
        <fieldset className="appearance-control">
          <legend>Accent color</legend>
          <p>Choose a color for buttons, highlights, and navigation.</p>
          <div className="accent-options">{accentPresets.map((preset) => (
            <button type="button" key={preset.value}
              className={`btn btn-secondary accent-swatch ${appearance.accent.toLowerCase() === preset.value ? 'selected' : ''}`}
              style={{ '--swatch-color': preset.value }}
              aria-label={`${preset.label} accent color`}
              aria-pressed={appearance.accent.toLowerCase() === preset.value}
              onClick={() => onAppearanceChange((current) => ({ ...current, accent: preset.value }))}>
              <span />{preset.label}
            </button>
          ))}
            <label className="custom-accent"><input type="color" aria-label="Choose a custom accent color" value={appearance.accent}
              onChange={(event) => onAppearanceChange((current) => ({ ...current, accent: event.target.value }))} /><span>Custom</span></label>
          </div>
        </fieldset>
        <fieldset className="appearance-control text-size-control">
          <legend>Text size</legend>
          <p>Adjust text size across the site to suit your preference.</p>
          <div className="text-size-slider"><span aria-hidden="true">A</span>
            <input type="range" min="0.9" max="1.4" step="0.05" value={appearance.textScale}
              aria-label="Text size" aria-valuetext={`${Math.round(appearance.textScale / defaultAppearance.textScale * 100)}%`}
              onChange={(event) => onAppearanceChange((current) => ({ ...current, textScale: Number(event.target.value) }))} />
            <strong>A</strong><output>{Math.round(appearance.textScale / defaultAppearance.textScale * 100)}%</output>
          </div>
        </fieldset>
      </div>
    </section>
    <div className="settings-grid"><section className="panel settings-card"><div className="settings-symbol">◈</div><h2>Workspace</h2><p>G4 Sticker</p><div className="settings-detail"><span>Database</span><strong className={health === 'connected' ? 'connected-text' : 'disconnected-text'}>{health === 'connected' ? 'Connected' : health === 'checking' ? 'Checking…' : 'Not connected'}</strong></div></section>
    <section className="panel settings-card"><div className="settings-symbol lavender">♙</div><h2>Your profile</h2><p>G4 Sticker admin</p><div className="settings-detail"><span>Account</span><strong>Personal workspace</strong></div></section>
    <section className="panel settings-card guide-settings-card"><div className="settings-symbol">↗</div><h2>Learn the flow</h2><p className="guide-settings-progress" aria-live="polite">{guideProgress} of {flowSteps.length} steps viewed</p><div className="guide-settings-actions"><button className="btn btn-secondary" type="button" onClick={() => onNavigate('guide')}>Open the guide</button><button className="btn btn-secondary" type="button" onClick={() => setResetConfirmOpen(true)}>Reset guide progress</button></div></section></div>
    <ConfirmDialog open={resetConfirmOpen} title="Reset your Learn the flow progress?" description="" confirmLabel="Reset progress" onConfirm={resetGuideProgress} onCancel={() => setResetConfirmOpen(false)} />
  </div>;
}
