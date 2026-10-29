import test from 'node:test';
import assert from 'node:assert/strict';
import { FinancialValidationError, validateFinancialEntry } from './financial.js';

const valid = { name: 'Vinyl order', category: 'Materials', amount: '120.50', date: '2026-10-22' };

test('financial entries normalize currency and trim labels', () => {
  assert.deepEqual(validateFinancialEntry({ ...valid, name: ' Vinyl order ', category: ' Materials ' }), {
    ...valid, name: 'Vinyl order', category: 'Materials', amount: 120.5
  });
});

test('financial entries reject zero, malformed, and excessive precision amounts', () => {
  for (const amount of ['0', '-1', '1.234', 'NaN', '']) {
    assert.throws(() => validateFinancialEntry({ ...valid, amount }), FinancialValidationError);
  }
});

test('financial entries require real calendar dates and non-empty categories', () => {
  for (const date of ['2026-02-30', '10/22/2026', '']) assert.throws(() => validateFinancialEntry({ ...valid, date }), FinancialValidationError);
  assert.throws(() => validateFinancialEntry({ ...valid, category: ' ' }), /category/);
});

test('manual entries cannot impersonate payroll-linked expense records', () => {
  assert.throws(() => validateFinancialEntry({ ...valid, payrollRunId: 'run-1' }), /Pay runs/);
});

test('manual expense entries reject Materials as an expense category to avoid double-counting', () => {
  assert.throws(
    () => validateFinancialEntry({ ...valid, category: 'Materials' }, { resource: 'expenses' }),
    /Materials cannot be entered manually as an expense category/
  );
  assert.throws(
    () => validateFinancialEntry({ ...valid, category: 'materials' }, { resource: 'expenses' }),
    /Materials cannot be entered manually as an expense category/
  );
});
