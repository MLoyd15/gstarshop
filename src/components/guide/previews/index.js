import { createElement, lazy, Suspense } from 'react';
import { previewBadgeNumbers, previewLoaders } from '../registryMeta.js';

export { previewBadgeNumbers } from '../registryMeta.js';

export const registry = Object.fromEntries(
  Object.entries(previewLoaders).map(([key, load]) => [key, lazy(load)])
);

const warnedKeys = new Set();

function warnForCalloutDrift(preview) {
  if (!import.meta.env?.DEV || warnedKeys.has(preview.key)) return;
  warnedKeys.add(preview.key);
  const dataNumbers = (preview.callouts || []).map((callout) => callout.n);
  const badgeNumbers = previewBadgeNumbers[preview.key] || [];
  const missingBadges = dataNumbers.filter((number) => !badgeNumbers.includes(number));
  const missingData = badgeNumbers.filter((number) => !dataNumbers.includes(number));
  if (missingBadges.length) {
    console.warn(`Guide preview "${preview.key}" has callout data without a matching badge: ${missingBadges.join(', ')}.`);
  }
  if (missingData.length) {
    console.warn(`Guide preview "${preview.key}" has badge numbers without matching callout data: ${missingData.join(', ')}.`);
  }
}

function PreviewFallback() {
  return createElement('div', { className: 'guide-preview-inner-skeleton', 'aria-hidden': 'true' });
}

export default function PreviewRegistry({ preview }) {
  if (!preview || !Object.hasOwn(registry, preview.key)) return null;
  warnForCalloutDrift(preview);
  const Component = registry[preview.key];
  return createElement(Suspense, { fallback: createElement(PreviewFallback) }, createElement(Component));
}
