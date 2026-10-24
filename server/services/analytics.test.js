import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnalyticsSummary } from './analytics.js';

const record = (resource, data, id = 'id') => ({ _id: id, resource, data, createdAt: new Date() });

test('analytics handles empty records gracefully with zeroes and safe empty arrays', () => {
  const result = buildAnalyticsSummary([], '2026-10', new Date('2026-10-15T00:00:00Z'), 6);
  assert.equal(result.period, '2026-10');
  assert.equal(result.chartMonths, 6);
  assert.equal(result.monthlyComparison.months.length, 6);
  assert.equal(result.monthlyComparison.peakMonth.value, 0);
  assert.equal(result.expensesByCategory.categories.length, 0);
  assert.equal(result.expensesByCategory.totalAmount, 0);
  assert.equal(result.funnel.booked.count, 0);
  assert.equal(result.funnel.completed.count, 0);
  assert.equal(result.funnel.paid.count, 0);
  assert.equal(result.unpaidBalances.items.length, 0);
  assert.equal(result.unpaidBalances.totalBalance, 0);
  assert.equal(result.productRevenue.supported, false);
});

test('analytics excludes cancelled and reversed bookings from funnel and margin', () => {
  const records = [
    record('bookings', {
      name: 'Valid Completed',
      amount: 1000,
      completion: {
        status: 'completed',
        completionDate: '2026-10-10',
        revenueAmount: 1000,
        revenueSource: 'completion',
        materialCost: 300
      },
      payments: [{ id: 'p1', date: '2026-10-11', amount: 1000 }]
    }, 'b1'),
    record('bookings', {
      name: 'Cancelled Booking',
      status: 'Cancelled',
      amount: 500,
      completion: { status: 'completed', completionDate: '2026-10-10', revenueAmount: 500, materialCost: 150 }
    }, 'b2'),
    record('bookings', {
      name: 'Reversed Completion',
      amount: 800,
      completion: { status: 'reversed', completionDate: '2026-10-10', revenueAmount: 800, materialCost: 200 }
    }, 'b3')
  ];

  const result = buildAnalyticsSummary(records, '2026-10', new Date('2026-10-15T00:00:00Z'), 6);
  assert.equal(result.funnel.booked.count, 2); // b1 and b3 (b2 is cancelled)
  assert.equal(result.funnel.completed.count, 1); // only b1 is active completed
  assert.equal(result.funnel.paid.count, 1); // b1 has 1000 paid

  const oct = result.grossMargin.months.find((m) => m.key === '2026-10');
  assert.equal(oct.salesRevenue, 1000);
  assert.equal(oct.materialCost, 300);
  assert.equal(oct.grossMargin, 700);
  assert.equal(oct.hasEstimated, false);
});

test('analytics distinguishes estimated/migrated revenue from actual snapshots', () => {
  const records = [
    record('bookings', {
      name: 'Migrated Revenue',
      amount: 600,
      completion: {
        status: 'completed',
        completionDate: '2026-10-05',
        revenueAmount: 600,
        revenueSource: 'migration-current-booking-amount',
        materialCost: 200
      }
    }, 'b-migrated')
  ];

  const result = buildAnalyticsSummary(records, '2026-10', new Date('2026-10-15T00:00:00Z'), 6);
  const oct = result.grossMargin.months.find((m) => m.key === '2026-10');
  assert.equal(oct.salesRevenue, 600);
  assert.equal(oct.actualRevenue, 0);
  assert.equal(oct.estimatedRevenue, 600);
  assert.equal(oct.hasEstimated, true);
  assert.equal(oct.grossMargin, 400);
});

test('analytics handles payroll-linked expenses and reversed expenses correctly', () => {
  const records = [
    record('expenses', { category: 'Supplies', amount: 250, date: '2026-10-01' }, 'e1'),
    record('expenses', { category: 'Rent', amount: 1000, date: '2026-10-01' }, 'e2'),
    // Payroll linked expense should be excluded from operational expenses
    record('expenses', { category: 'Payroll', amount: 5000, date: '2026-10-05', payrollRunId: 'pr-1' }, 'e-payroll'),
    record('expenses', { category: 'Payroll', amount: 1200, date: '2026-10-05', expenseKind: 'payroll-net' }, 'e-payroll2'),
    // Reversed expense should be excluded
    record('expenses', { category: 'Supplies', amount: 300, date: '2026-10-02', status: 'reversed' }, 'e-reversed')
  ];

  const result = buildAnalyticsSummary(records, '2026-10', new Date('2026-10-15T00:00:00Z'), 6);
  assert.equal(result.expensesByCategory.totalAmount, 1250);
  assert.equal(result.expensesByCategory.totalCount, 2);
  assert.equal(result.expensesByCategory.categories.length, 2);

  const rent = result.expensesByCategory.categories.find((c) => c.category === 'Rent');
  const supplies = result.expensesByCategory.categories.find((c) => c.category === 'Supplies');
  assert.equal(rent.amount, 1000);
  assert.equal(rent.percentage, 80);
  assert.equal(supplies.amount, 250);
  assert.equal(supplies.percentage, 20);
  assert.equal(rent.percentage + supplies.percentage, 100);
});

test('analytics buckets months accurately across calendar year boundaries', () => {
  // Query Jan 2027 with 6 months window -> should include Aug, Sep, Oct, Nov, Dec 2026, Jan 2027
  const result = buildAnalyticsSummary([], '2027-01', new Date('2027-01-10T00:00:00Z'), 6);
  const keys = result.monthlyComparison.months.map((m) => m.key);
  assert.deepEqual(keys, ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
});

test('analytics calculates unpaid balances with ledger verification flag', () => {
  const records = [
    record('bookings', {
      name: 'Client Alpha Job',
      client: 'Alpha Corp',
      amount: 1500,
      paymentTrackingStartedAt: '2026-10-01',
      payments: [{ id: 'p1', date: '2026-10-02', amount: 500 }]
    }, 'b-alpha'),
    record('bookings', {
      name: 'Client Beta Legacy Job',
      client: 'Beta Ltd',
      amount: 2000,
      payments: [] // unverified tracking started at is null
    }, 'b-beta')
  ];

  const result = buildAnalyticsSummary(records, '2026-10', new Date('2026-10-15T00:00:00Z'), 6);
  assert.equal(result.unpaidBalances.totalCount, 2);
  assert.equal(result.unpaidBalances.totalBalance, 3000);
  assert.equal(result.unpaidBalances.unverifiedCount, 1);

  // Highest balance first
  assert.equal(result.unpaidBalances.items[0].name, 'Client Beta Legacy Job');
  assert.equal(result.unpaidBalances.items[0].balance, 2000);
  assert.equal(result.unpaidBalances.items[0].paymentLedgerVerified, false);

  assert.equal(result.unpaidBalances.items[1].name, 'Client Alpha Job');
  assert.equal(result.unpaidBalances.items[1].balance, 1000);
  assert.equal(result.unpaidBalances.items[1].paymentLedgerVerified, true);
});

test('analytics records customer cash collected and payroll paid in monthly comparison', () => {
  const records = [
    record('bookings', {
      name: 'Booking with payment',
      payments: [{ id: 'pay-1', date: '2026-10-04', amount: 450 }]
    }, 'b-pay'),
    record('payroll-runs', {
      period: '2026-10',
      status: 'paid',
      payments: [{ id: 'pr-pay-1', date: '2026-10-15', amount: 800 }]
    }, 'pr-1')
  ];

  const result = buildAnalyticsSummary(records, '2026-10', new Date('2026-10-15T00:00:00Z'), 6);
  const oct = result.monthlyComparison.months.find((m) => m.key === '2026-10');
  assert.equal(oct.cashCollected, 450);
  assert.equal(oct.payrollPaid, 800);
});

