import test from 'node:test';
import assert from 'node:assert/strict';
import { flowSteps } from '../../data/flowSteps.js';
import { previewBadgeNumbers, registry } from './previews/index.js';

test('every guide preview key exists in the registry', () => {
  for (const step of flowSteps) {
    for (const preview of step.previews || []) {
      assert.ok(Object.hasOwn(registry, preview.key), `Unknown preview key "${preview.key}" on step "${step.id}".`);
    }
  }
});

test('preview callout numbers are unique and sequential from one', () => {
  for (const step of flowSteps) {
    for (const preview of step.previews || []) {
      const numbers = preview.callouts.map(({ n }) => n);
      assert.deepEqual(numbers, numbers.map((_number, index) => index + 1), `Callouts for "${preview.key}" must be unique and sequential.`);
      assert.deepEqual(numbers, previewBadgeNumbers[preview.key], `Callout badges for "${preview.key}" must match the preview component.`);
    }
  }
});
