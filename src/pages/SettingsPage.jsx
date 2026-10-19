import '../styles/SettingsPage.css';
const defaultAppearance={accent:'#6967d9',textScale:1.15};
const accentPresets=[{label:'Violet',value:'#6967d9'},{label:'Ocean',value:'#2878c7'},{label:'Forest',value:'#26836b'},{label:'Coral',value:'#d46a70'},{label:'Amber',value:'#bd7d28'}];




export default function SettingsPage({ health, appearance, onAppearanceChange, appearanceError }) {
  return <div className="records-page settings-page"><div className="welcome-row records-welcome"><div><div className="eyebrow"><span className="eyebrow-line" />PREFERENCES</div><h1>Settings</h1><p>Manage your workspace and account preferences.</p></div></div>
    <section className="panel appearance-panel">
      <div className="appearance-heading"><div><div className="settings-symbol">✦</div><h2>Make it yours</h2><p>Personalize the look of G4 Sticker. Changes apply immediately and are saved on this device.</p></div>
        <button type="button" className="appearance-reset" onClick={() => onAppearanceChange(defaultAppearance)}>Reset to default</button>
      </div>
      {appearanceError && <p className="appearance-error" role="status">{appearanceError}</p>}
      <div className="appearance-options">
        <fieldset className="appearance-control">
          <legend>Accent color</legend>
          <p>Choose a color for buttons, highlights, and navigation.</p>
          <div className="accent-options">{accentPresets.map((preset) => (
            <button type="button" key={preset.value}
              className={`accent-swatch ${appearance.accent.toLowerCase() === preset.value ? 'selected' : ''}`}
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
    <div className="settings-grid"><section className="panel settings-card"><div className="settings-symbol">◈</div><h2>Workspace</h2><p>G4 Sticker</p><div className="settings-detail"><span>Plan</span><strong>Business plan</strong></div><div className="settings-detail"><span>Database</span><strong className={health === 'connected' ? 'connected-text' : 'disconnected-text'}>{health === 'connected' ? 'Connected' : health === 'checking' ? 'Checking…' : 'Not connected'}</strong></div></section>
    <section className="panel settings-card"><div className="settings-symbol lavender">♙</div><h2>Your profile</h2><p>Jamie Davis · Workspace admin</p><div className="settings-detail"><span>Account</span><strong>Personal workspace</strong></div><div className="settings-detail"><span>Notifications</span><strong>Enabled</strong></div></section></div>
  </div>;
}
