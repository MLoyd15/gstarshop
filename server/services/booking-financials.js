import { randomUUID } from 'node:crypto';
import { InventoryValidationError, validateBusinessDate } from './inventory.js';

const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const canceledStatuses = new Set(['cancelled', 'canceled', 'void', 'refunded']);

export function moneyCents(value, label = 'Amount', { positive = false } = {}) {
  const text = String(value ?? '').trim();
  if (!MONEY_PATTERN.test(text)) throw new InventoryValidationError(`${label} must be a valid amount with no more than two decimal places.`);
  const cents = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(cents) || (positive && cents <= 0)) {
    throw new InventoryValidationError(`${label} must be greater than zero and within the supported range.`);
  }
  return cents;
}

const amountInCents = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
};

export function deriveBookingFinancials(data = {}) {
  const payments = Array.isArray(data.payments) ? data.payments : [];
  const paidCents = payments.filter((payment) => !payment.voidedAt)
    .reduce((sum, payment) => sum + amountInCents(payment.amount), 0);
  const bookingCents = amountInCents(data.amount);
  const balanceCents = bookingCents - paidCents;
  const paymentStatus = paidCents > bookingCents ? 'overpaid'
    : paidCents === 0 ? 'unpaid'
      : balanceCents === 0 ? 'paid' : 'partial';
  return {
    paidAmount: paidCents / 100,
    balance: balanceCents / 100,
    paymentStatus,
    paymentLedgerVerified: Boolean(data.paymentTrackingStartedAt)
  };
}

export function snapshotCompletionRevenue(data) {
  const revenueCents = moneyCents(data.amount, 'Booking amount', { positive: true });
  return { revenueAmount: revenueCents / 100, revenueSource: 'completion' };
}

function samePayment(payment, normalized) {
  return payment.date === normalized.date
    && amountInCents(payment.amount) === normalized.amountCents
    && String(payment.method || '') === normalized.method
    && String(payment.note || '') === normalized.note;
}

export function addBookingPayment(data, input, { idFactory = randomUUID, now = () => new Date() } = {}) {
  const amountCents = moneyCents(input.amount, 'Payment amount', { positive: true });
  const date = validateBusinessDate(input.date);
  const method = String(input.method || '').trim();
  if (!method || method.length > 80) throw new InventoryValidationError('Enter a payment method up to 80 characters.');
  const note = String(input.note || '').trim();
  if (note.length > 500) throw new InventoryValidationError('Payment note must be 500 characters or fewer.');
  const idempotencyKey = String(input.idempotencyKey || '').trim() || idFactory();
  if (idempotencyKey.length > 120) throw new InventoryValidationError('Idempotency key must be 120 characters or fewer.');
  const normalized = { date, amountCents, method, note };
  const payments = Array.isArray(data.payments) ? [...data.payments] : [];
  const prior = payments.find((payment) => payment.idempotencyKey === idempotencyKey);
  if (prior) {
    if (!samePayment(prior, normalized)) throw new InventoryValidationError('This payment key was already used with different payment details.', 409);
    return { payments, payment: prior, duplicate: true };
  }

  const bookingCents = moneyCents(data.amount, 'Booking amount', { positive: true });
  const paidCents = payments.filter((payment) => !payment.voidedAt).reduce((sum, payment) => sum + amountInCents(payment.amount), 0);
  if (paidCents + amountCents > bookingCents && input.allowOverpayment !== true) {
    throw new InventoryValidationError('This payment would exceed the booking balance. Explicitly allow overpayment to continue.', 409);
  }
  const payment = {
    id: idFactory(), date, amount: amountCents / 100, method, note, idempotencyKey,
    createdAt: now(), voidedAt: null, voidReason: ''
  };
  payments.push(payment);
  return { payments, payment, duplicate: false };
}

export function voidBookingPayment(data, paymentId, reason, { now = () => new Date() } = {}) {
  const cleanReason = String(reason || '').trim();
  if (!cleanReason || cleanReason.length > 500) throw new InventoryValidationError('Enter a void reason up to 500 characters.');
  const payments = Array.isArray(data.payments) ? data.payments.map((payment) => ({ ...payment })) : [];
  const index = payments.findIndex((payment) => payment.id === paymentId);
  if (index < 0) throw new InventoryValidationError('Payment not found.', 404);
  if (!payments[index].voidedAt) payments[index] = { ...payments[index], voidedAt: now(), voidReason: cleanReason };
  return { payments, payment: payments[index] };
}

export function confirmBookingPaymentHistory(data, { now = () => new Date() } = {}) {
  return {
    ...data,
    payments: Array.isArray(data.payments) ? data.payments : [],
    paymentTrackingStartedAt: data.paymentTrackingStartedAt || now()
  };
}

export function isCancelledBooking(data = {}) {
  return canceledStatuses.has(String(data.status || '').trim().toLowerCase());
}
