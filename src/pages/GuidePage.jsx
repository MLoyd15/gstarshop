import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { flowSteps, glossary } from '../data/flowSteps.js';
import { previewBadgeNumbers } from '../components/guide/registryMeta.js';
import '../styles/GuidePage.css';

const PreviewRegistry = lazy(() => import('../components/guide/previews/index.js'));

const progressKey = 'g4-sticker-guide-progress';
const tracks = [
  { id: 'inventory', label: 'Inventory flow' },
  { id: 'payroll', label: 'Payroll flow' }
];

function readProgress() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(progressKey) || '[]');
    return Array.isArray(saved) ? saved.filter((id) => flowSteps.some((step) => step.id === id)) : [];
  } catch (error) {
    console.error('Could not read guide progress:', error);
    return [];
  }
}

function saveProgress(progress) {
  try {
    window.localStorage.setItem(progressKey, JSON.stringify(progress));
  } catch (error) {
    console.error('Could not save guide progress:', error);
  }
}

function GuidePage({ onNavigate }) {
  const [track, setTrack] = useState('inventory');
  const [selectedId, setSelectedId] = useState('setup');
  const [viewed, setViewed] = useState(readProgress);
  const steps = useMemo(() => flowSteps.filter((step) => step.track === track), [track]);
  const selected = steps.find((step) => step.id === selectedId) || steps[0];

  useEffect(() => {
    if (!selected || viewed.includes(selected.id)) return;
    const next = [...viewed, selected.id];
    setViewed(next);
    saveProgress(next);
  }, [selected, viewed]);

  function changeTrack(nextTrack) {
    setTrack(nextTrack);
    setSelectedId(flowSteps.find((step) => step.track === nextTrack)?.id || '');
  }

  function resetProgress() {
    setViewed([]);
    saveProgress([]);
  }

  return (
    <main className="guide-page">
      <header className="guide-heading">
        <div>
          <div className="t-eyebrow">STAFF QUICK GUIDE</div>
          <h1 className="t-page-title">Learn the flow</h1>
          <p>Follow how work moves through G4 Sticker, from supplies to finished jobs and pay runs.</p>
        </div>
        <div className="guide-progress" aria-live="polite">
          <span>{viewed.filter((id) => steps.some((step) => step.id === id)).length} of {steps.length} steps viewed</span>
          <button type="button" className="btn guide-reset btn-secondary" onClick={resetProgress}>Reset progress</button>
        </div>
      </header>

      <div className="guide-track-switcher" role="group" aria-label="Choose a guide">
        {tracks.map((item) => (
          <button type="button" key={item.id} aria-pressed={track === item.id}
            className={`btn btn-secondary${track === item.id ? ' guide-track-active' : ''}`} onClick={() => changeTrack(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <section className="guide-flow" aria-label={`${tracks.find((item) => item.id === track)?.label} steps`}>
        <ol className="guide-stepper">
          {steps.map((step) => (
            <li key={step.id}>
              <button type="button" className={`btn guide-step btn-secondary${selected.id === step.id ? ' guide-step-selected' : ''}`}
                aria-current={selected.id === step.id ? 'step' : undefined}
                aria-label={`Step ${step.number}: ${step.title}${viewed.includes(step.id) ? ', viewed' : ''}`}
                onClick={() => setSelectedId(step.id)}>
                <span className="guide-step-number">{step.number}</span>
                <span className="guide-step-title">{step.title}</span>
                {viewed.includes(step.id) && <span className="guide-viewed" aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="guide-detail" aria-live="polite" aria-labelledby="guide-detail-title">
        <div className="guide-detail-top">
          <div>
            <div className="guide-detail-kicker">STEP {selected.number} · {track === 'inventory' ? 'INVENTORY FLOW' : 'PAYROLL FLOW'}</div>
            <h2 id="guide-detail-title">{selected.title}</h2>
            <p className="guide-summary">{selected.summary}</p>
          </div>
          <button type="button" className="btn guide-go btn-secondary" onClick={() => onNavigate(selected.goTo)}>
            Go to {selected.goToLabel} <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="guide-detail-columns">
          <section>
            <h3>What happens in the system</h3>
            <ol>{selected.whatHappens.map((item) => <li key={item}>{item}</li>)}</ol>
          </section>
          <section className="guide-mistakes">
            <h3>Common mistakes</h3>
            <ul>{selected.commonMistakes.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
        {selected.previews?.map((preview) => {
          if (!Object.hasOwn(previewBadgeNumbers, preview.key)) return null;
          return (
            <section className="guide-preview-section" key={preview.key} aria-label={`${selected.title} preview`}>
              <div className="guide-preview-pair">
                <div className="guide-preview-main">
                  <Suspense fallback={<div className="guide-preview-skeleton" aria-hidden="true"><span /></div>}>
                    <PreviewRegistry preview={preview} />
                  </Suspense>
                  <p className="guide-preview-caption">{preview.caption}</p>
                  <button type="button" className="btn guide-preview-open btn-secondary" onClick={() => onNavigate(selected.goTo)}>
                    Open the real page <span aria-hidden="true">→</span>
                  </button>
                </div>
                <ol className="guide-preview-callouts" aria-label="Preview instructions">
                  {preview.callouts.map((callout) => <li key={callout.n}><span>{callout.n}</span><p>{callout.label}</p></li>)}
                </ol>
              </div>
            </section>
          );
        })}
      </section>

      <section className="guide-glossary">
        <div className="guide-section-heading">
          <div><div className="t-eyebrow">QUICK ANSWERS</div><h2>Helpful to know</h2></div>
        </div>
        <div className="guide-accordion">
          {glossary.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

export default GuidePage;
