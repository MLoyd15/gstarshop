import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardSummary } from './dashboard.js';

const record = (resource, data, id = `${resource}-1`, createdAt = '2026-10-01T00:00:00.000Z') => ({
  _id: { toString: () => id }, resource, data, createdAt, updatedAt: createdAt
});

test('dashboard returns zero activity and labels unsupported accounting figures', () => {
  const result = buildDashboardSummary([], '2026-10', new Date('2026-10-22T00:00:00.000Z'));
  assert.equal(result.period, '2026-10');
  assert.deepEqual(result.totals, {
    income: 0, expenses: 0, payrollPaid: 0, materialCosts: 0, salesRevenue: 0, cashCollected: 0, grossMargin: 0,
    receivables: 0, receivableCount: 0, unpaidBookings: [], receivablesVerified: true, allTime: { salesRevenue: 0, materialCosts: 0, grossMargin: 0, cashCollected: 0 }, expenseCategories: {},
    incomeEntries: 0, expenseEntries: 0, clients: 0, materials: 0,
    lowStockMaterials: 0, suppliers: 0, products: 0, bookings: 0
  });
  assert.equal(result.months.length, 6);
  assert.equal(result.payroll.outstandingFinalized, 0);
  assert.deepEqual(result.financialLimits, {
    salesRevenueTrackedSeparately: true,
    customerReceivablesTracked: true,
    profitReliable: false
  });
});

test('dashboard keeps manual income, sales revenue, and customer cash separate', () => {
  const entries = [
    record('income', { amount: 80, date: '2026-10-05', name: 'Manual service income' }, 'manual-income'),
    record('bookings', { name: 'Completed job', client: 'A', amount: 100, paymentTrackingStartedAt: '2026-01-01', completion: { status: 'completed', completionDate: '2026-10-06', revenueAmount: 100, revenueSource: 'completion', materialCost: 30 }, payments: [
      { id: 'pay-1', idempotencyKey: 'key-1', date: '2026-10-09', amount: 40 },
      { id: 'pay-void', date: '2026-10-10', amount: 20, voidedAt: '2026-10-11', voidReason: 'Duplicate' }
    ] }, 'booking-complete'),
    record('bookings', { name: 'Unpaid job', client: 'B', amount: 60, paymentTrackingStartedAt: '2026-01-01', payments: [] }, 'booking-unpaid'),
    record('bookings', { name: 'Cancelled job', amount: 70, status: 'cancelled', paymentTrackingStartedAt: '2026-01-01', payments: [] }, 'booking-cancelled'),
    record('bookings', { name: 'Reversed job', amount: 90, paymentTrackingStartedAt: '2026-01-01', completion: { status: 'reversed', completionDate: '2026-10-03', revenueAmount: 90, revenueSource: 'completion', materialCost: 10 }, payments: [] }, 'booking-reversed')
  ];
  const result = buildDashboardSummary(entries, '2026-10', new Date('2026-10-22T00:00:00.000Z'));
  assert.equal(result.totals.income, 80);
  assert.equal(result.totals.salesRevenue, 100);
  assert.equal(result.totals.cashCollected, 40);
  assert.equal(result.totals.receivables, 210);
  assert.equal(result.totals.receivableCount, 3);
  assert.equal(result.totals.grossMargin, 70);
  assert.equal(result.totals.allTime.grossMargin, 70);
  assert.equal(result.months.find((month) => month.key === '2026-10').salesRevenue, 100);
  assert.equal(result.months.find((month) => month.key === '2026-10').cashCollected, 40);
  assert.equal(result.months.find((month) => month.key === '2026-10').grossMargin, 70);
  assert.equal(result.financialLimits.salesRevenueTrackedSeparately, true);
  assert.equal(result.financialLimits.customerReceivablesTracked, true);
});

test('dashboard flags legacy or migrated revenue and unverified receivables as unreliable', () => {
  const entries = [
    record('bookings', { name: 'Migrated amount', amount: 100, status: 'Completed', completion: { status: 'completed', completionDate: '2026-10-08', revenueAmount: 100, revenueSource: 'migration-current-booking-amount', materialCost: 25 } }, 'booking-migrated'),
    record('bookings', { name: 'Legacy balance', amount: 50, status: 'Completed', payments: [] }, 'booking-legacy')
  ];
  const result = buildDashboardSummary(entries, '2026-10', new Date('2026-10-22T00:00:00.000Z'));
  assert.equal(result.totals.salesRevenue, 100);
  assert.equal(result.totals.grossMargin, 75);
  assert.equal(result.totals.receivables, 150);
  assert.equal(result.financialLimits.salesRevenueTrackedSeparately, false);
  assert.equal(result.financialLimits.customerReceivablesTracked, false);
  assert.equal(result.totals.unpaidBookings.find((booking) => booking.name === 'Legacy balance').paymentLedgerVerified, false);
});

test('dashboard uses the completion revenue snapshot after booking amount edits and excludes reversals', () => {
  const data = { name: 'Snapshot job', amount: 100, paymentTrackingStartedAt: '2026-10-01', completion: { status: 'completed', completionDate: '2026-10-08', revenueAmount: 100, revenueSource: 'completion', materialCost: 25 } };
  data.amount = 140;
  const active = buildDashboardSummary([record('bookings', data, 'snapshot-job')], '2026-10', new Date('2026-10-22T00:00:00.000Z'));
  assert.equal(active.totals.salesRevenue, 100);
  assert.equal(active.totals.grossMargin, 75);

  data.completion.status = 'reversed';
  data.completionHistory = [{ ...data.completion }];
  const reversed = buildDashboardSummary([record('bookings', data, 'snapshot-job')], '2026-10', new Date('2026-10-22T00:00:00.000Z'));
  assert.equal(reversed.totals.salesRevenue, 0);
  assert.equal(reversed.totals.grossMargin, 0);
});

test('dashboard uses inclusive calendar-month boundaries and previous-month comparisons', () => {
  const entries = [
    record('income', { amount: 100, date: '2026-09-30' }, 'income-september'),
    record('income', { amount: 250, date: '2026-10-01' }, 'income-october-start'),
    record('income', { amount: 50, date: '2026-10-31' }, 'income-october-end'),
    record('income', { amount: 900, date: '2026-11-01' }, 'income-november'),
    record('expenses', { amount: 30, date: '2026-10-31', category: 'Supplies' }, 'expense-october')
  ];
  const result = buildDashboardSummary(entries, '2026-10', new Date('2026-10-22T00:00:00.000Z'));

  assert.equal(result.totals.income, 300);
  assert.equal(result.totals.expenses, 30);
  assert.equal(result.comparison.previous.income, 100);
  assert.equal(result.months.find((item) => item.key === '2026-10').income, 300);
  assert.equal(result.months.find((item) => item.key === '2026-10').expenses, 30);
});

test('dashboard chart window can be set to three or twelve months and defaults safely to six', () => {
  const records = [record('income', { amount: 42, date: '2026-01-01' }, 'january')];
  const now = new Date('2026-10-22T00:00:00.000Z');
  const shortWindow = buildDashboardSummary(records, '2026-10', now, 3);
  const longWindow = buildDashboardSummary(records, '2026-10', now, 12);
  const invalidWindow = buildDashboardSummary(records, '2026-10', now, 4);
  assert.equal(shortWindow.months.length, 3);
  assert.deepEqual(shortWindow.months.map((item) => item.key), ['2026-08', '2026-09', '2026-10']);
  assert.equal(longWindow.months.length, 12);
  assert.equal(longWindow.months[0].key, '2025-11');
  assert.equal(longWindow.months.at(-1).key, '2026-10');
  assert.equal(longWindow.months.find((item) => item.key === '2026-01').income, 42);
  assert.equal(invalidWindow.months.length, 6);
});

test('dashboard separates job material costs and payroll payments from generic expenses', () => {
  const entries = [
    record('expenses', { amount: 500, date: '2026-10-03', payrollRunId: 'run-1', expenseKind: 'payroll-payment' }, 'payroll-expense'),
    record('expenses', { amount: 40, date: '2026-10-03', category: 'Utilities' }, 'ordinary-expense'),
    record('bookings', { status: 'Completed', completion: { status: 'completed', completionDate: '2026-10-12', materialCost: 70 } }, 'booking-complete'),
    record('bookings', { status: 'Active', amount: 800 }, 'booking-quote'),
    record('payroll-runs', { period: '2026-10', status: 'partially-paid', grossPay: 700, netPay: 600, amountPaid: 250, balance: 350, payments: [
      { id: 'pay-1', date: '2026-10-10', amount: 250 },
      { id: 'pay-1', date: '2026-10-10', amount: 250 }
    ] }, 'run-1')
  ];
  const result = buildDashboardSummary(entries, '2026-10', new Date('2026-10-22T00:00:00.000Z'));

  assert.equal(result.totals.expenses, 40);
  assert.equal(result.totals.payrollPaid, 250);
  assert.equal(result.totals.materialCosts, 70);
  assert.deepEqual(result.totals.expenseCategories, { Utilities: 40 });
  assert.equal(result.payroll.outstandingFinalized, 350);
  assert.equal(result.payroll.partiallyPaidCount, 1);
  assert.equal(result.months.find((item) => item.key === '2026-10').payrollPaid, 250);
});

test('dashboard excludes reversed income and payroll runs', () => {
  const entries = [
    record('income', { amount: 120, date: '2026-10-02', status: 'reversed' }, 'reversed-income'),
    record('payroll-runs', { period: '2026-10', status: 'reversed', grossPay: 900, netPay: 800, amountPaid: 0, balance: 800, payments: [] }, 'reversed-run')
  ];
  const result = buildDashboardSummary(entries, '2026-10');
  assert.equal(result.totals.income, 0);
  assert.equal(result.payroll.gross, 0);
  assert.equal(result.payroll.outstandingFinalized, 0);
});

test('dashboard attention uses booking dates, saved statuses, and the configured material reorder level', () => {
  const entries = [
    record('bookings', { name: 'Past booking', status: 'Active', date: '2026-10-21', materialPlan: [] }, 'booking-past'),
    record('bookings', { name: 'Upcoming booking', status: 'Active', date: '2026-10-25', materialPlan: [{ materialId: 'm1' }] }, 'booking-soon'),
    record('bookings', { name: 'Done booking', status: 'Completed', date: '2026-10-20', materialPlan: [], completion: { status: 'completed' } }, 'booking-done'),
    record('purchase-orders', { number: 'PO-1', status: 'ordered', expectedDate: '2026-10-20', subtotal: 50 }, 'po-open'),
    record('purchase-orders', { number: 'PO-2', status: 'received', subtotal: 120, paidAmount: 20 }, 'po-balance'),
    record('materials', { name: 'Low roll', quantity: 2, reorderLevel: 2, unit: 'm' }, 'material-low'),
    record('materials', { name: 'Healthy roll', quantity: 3, reorderLevel: 2, unit: 'm' }, 'material-ok'),
    record('payroll-runs', { period: '2026-10', status: 'draft', employeeRecordId: 'employee-1' }, 'run-draft'),
    record('payroll-runs', { period: '2026-10', status: 'paid', employeeRecordId: 'employee-2' }, 'run-paid')
  ];
  const result = buildDashboardSummary(entries, '2026-10', new Date('2026-10-22T00:00:00.000Z'));
  const keys = result.attention.map((item) => item.key);
  assert.ok(keys.some((key) => key.startsWith('booking-overdue-')));
  assert.ok(keys.some((key) => key.startsWith('booking-materials-')));
  assert.ok(keys.some((key) => key.startsWith('booking-upcoming-')));
  assert.ok(keys.some((key) => key.startsWith('purchase-receipt-')));
  assert.ok(keys.some((key) => key.startsWith('supplier-balance-')));
  assert.ok(keys.some((key) => key.startsWith('material-stock-')));
  assert.ok(keys.some((key) => key.startsWith('payroll-')));
  assert.equal(keys.filter((key) => key.startsWith('booking-')).length, 3);
  assert.equal(result.payroll.employeeCount, 2);
  assert.match(result.attention.find((item) => item.key.startsWith('supplier-balance-')).detail, /no payment due date is recorded/);
  assert.deepEqual(result.operationCharts.bookings, { active: 2, completed: 1 });
  assert.deepEqual(result.operationCharts.materials, { healthy: 1, low: 1, out: 0 });
  assert.deepEqual(result.operationCharts.purchasing, { awaitingReceipt: 1, balanceDue: 1 });
});
