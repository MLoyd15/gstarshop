import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addBookingPayment, deriveBookingFinancials, isCancelledBooking, moneyCents, snapshotCompletionRevenue, voidBookingPayment
} from './booking-financials.js';

test('completion captures the booking value as cents at completion time', () => {
  assert.deepEqual(snapshotCompletionRevenue({ amount: '125.40' }), { revenueAmount: 125.4, revenueSource: 'completion' });
  assert.throws(() => snapshotCompletionRevenue({ amount: '0' }), /greater than zero/);
  assert.equal(moneyCents('0.01'), 1);
});

test('payments derive the correct balances and unpaid, partial, paid, and overpaid states', () => {
  assert.deepEqual(deriveBookingFinancials({ amount: 100, payments: [] }), {
    paidAmount: 0, balance: 100, paymentStatus: 'unpaid', paymentLedgerVerified: false
  });
  assert.equal(deriveBookingFinancials({ amount: 100, payments: [{ amount: 25 }] }).paymentStatus, 'partial');
  assert.equal(deriveBookingFinancials({ amount: 100, payments: [{ amount: 100 }] }).paymentStatus, 'paid');
  assert.equal(deriveBookingFinancials({ amount: 100, payments: [{ amount: 110 }] }).paymentStatus, 'overpaid');
  assert.equal(deriveBookingFinancials({ amount: 100, paymentTrackingStartedAt: new Date() }).paymentLedgerVerified, true);
});

test('payment creation rejects overpayment and supports explicitly allowed overpayment', () => {
  const data = { amount: 100, payments: [{ id: 'p1', amount: 80, date: '2026-10-01', method: 'Cash', note: '', idempotencyKey: 'k1' }] };
  const input = { amount: '20.01', date: '2026-10-02', method: 'Cash', note: '', idempotencyKey: 'k2' };
  assert.throws(() => addBookingPayment(data, input), /exceed the booking balance/);
  const result = addBookingPayment(data, { ...input, allowOverpayment: true }, { idFactory: () => 'p2', now: () => new Date('2026-10-02T00:00:00Z') });
  assert.equal(result.payment.amount, 20.01);
  assert.equal(deriveBookingFinancials({ ...data, payments: result.payments }).paymentStatus, 'overpaid');
});

test('payment idempotency retries return the existing row and conflicting reuse is rejected', () => {
  const data = { amount: 100, payments: [] };
  const input = { amount: '25.00', date: '2026-10-02', method: 'Cash', note: 'Deposit', idempotencyKey: 'request-1' };
  const first = addBookingPayment(data, input, { idFactory: () => 'p1' });
  const retry = addBookingPayment({ ...data, payments: first.payments }, input, { idFactory: () => 'p2' });
  assert.equal(first.duplicate, false);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.payment.id, 'p1');
  assert.equal(retry.payments.length, 1);
  assert.throws(() => addBookingPayment({ ...data, payments: first.payments }, { ...input, amount: 26 }, { idFactory: () => 'p3' }), /different payment details/);
});

test('voiding a payment keeps its row and removes it from the derived balance', () => {
  const payment = { id: 'p1', amount: 40, date: '2026-10-02', method: 'Cash', note: '', idempotencyKey: 'k1', voidedAt: null };
  const data = { amount: 100, payments: [payment] };
  const result = voidBookingPayment(data, 'p1', 'Entered twice', { now: () => new Date('2026-10-03T00:00:00Z') });
  assert.equal(result.payments.length, 1);
  assert.equal(result.payment.voidReason, 'Entered twice');
  assert.equal(deriveBookingFinancials({ ...data, payments: result.payments }).paidAmount, 0);
  assert.equal(deriveBookingFinancials({ ...data, payments: result.payments }).balance, 100);
});

test('cancelled booking status is identified without guessing payment history', () => {
  assert.equal(isCancelledBooking({ status: 'Cancelled' }), true);
  assert.equal(isCancelledBooking({ status: 'Completed' }), false);
});
