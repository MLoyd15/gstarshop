import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPayrollPayment,
  calculateDailyEntryPay,
  calculatePayroll,
  payrollPeriodEnd,
  PayrollConflictError,
  PayrollValidationError,
  toMoney,
  validPayrollPeriod
} from './payroll.js';

test('monthly salary includes additional earnings and deductions', () => {
  assert.deepEqual(calculatePayroll({ salaryType: 'monthly', baseRate: '2500.00', allowances: '100', bonus: '50', commission: '25', deductions: '200' }), {
    salaryType: 'monthly', baseRate: 2500, units: 1, basicEarnings: 2500, allowances: 100, bonus: 50,
    commission: 25, otherEarnings: 0, grossPay: 2675, deductions: 200, netPay: 2475
  });
});

test('daily and hourly rates require worked units', () => {
  assert.equal(calculatePayroll({ salaryType: 'daily', baseRate: 80, units: 20 }).grossPay, 1600);
  assert.equal(calculatePayroll({ salaryType: 'hourly', baseRate: 12.5, units: 40 }).grossPay, 500);
  assert.throws(() => calculatePayroll({ salaryType: 'hourly', baseRate: 12.5, units: 0 }), PayrollValidationError);
});

test('payroll calculation supports holiday pay across salary types', () => {
  const result = calculatePayroll({
    salaryType: 'daily',
    baseRate: 500,
    units: 10,
    holidayPay: 1500,
    allowances: 200,
    deductions: 100
  });
  assert.equal(result.basicEarnings, 5000);
  assert.equal(result.holidayPay, 1500);
  assert.equal(result.grossPay, 6700);
  assert.equal(result.netPay, 6600);
});

test('holiday 3 options: regular pay, paid holiday, and double pay holiday for hourly employees', () => {
  const hourlyRate = 100;
  const overtimeRate = 125;

  // 1. Regular pay: 8 regular hours + 2 OT hours
  const regularDay = calculateDailyEntryPay({
    entry: { hours: 8, overtimeHours: 2, holidayType: 'regular' },
    baseRate: hourlyRate,
    isDaily: false,
    overtimeRate
  });
  assert.equal(regularDay.basePay, 800);
  assert.equal(regularDay.overtimePay, 250);
  assert.equal(regularDay.totalPay, 1050);
  assert.equal(regularDay.regularPay, 800);
  assert.equal(regularDay.holidayPay, 0);

  // 2. Paid holiday: unworked (0 hours) gives standard 100% pay (8 hours * rate)
  const paidHolidayUnworked = calculateDailyEntryPay({
    entry: { hours: 0, overtimeHours: 0, holidayType: 'paid_holiday' },
    baseRate: hourlyRate,
    isDaily: false,
    overtimeRate
  });
  assert.equal(paidHolidayUnworked.basePay, 800);
  assert.equal(paidHolidayUnworked.totalPay, 800);
  assert.equal(paidHolidayUnworked.holidayPay, 800);
  assert.equal(paidHolidayUnworked.regularPay, 0);
  assert.equal(paidHolidayUnworked.isPaidHoliday, true);

  // 3. Double pay holiday: worked 8 hours gives 200% rate (8 * 100 * 2 = 1600)
  const doublePayHoliday = calculateDailyEntryPay({
    entry: { hours: 8, overtimeHours: 1, holidayType: 'double_holiday' },
    baseRate: hourlyRate,
    isDaily: false,
    overtimeRate
  });
  assert.equal(doublePayHoliday.basePay, 1600);
  assert.equal(doublePayHoliday.overtimePay, 125);
  assert.equal(doublePayHoliday.totalPay, 1725);
  assert.equal(doublePayHoliday.holidayPay, 1600);
  assert.equal(doublePayHoliday.isDouble, true);
});

test('holiday 3 options: regular pay, paid holiday, and double pay holiday for daily employees', () => {
  const dailyRate = 600;

  // 1. Regular pay: 1 day worked = 600
  const regularDay = calculateDailyEntryPay({
    entry: { hours: 8, overtimeHours: 0, holidayType: 'regular' },
    baseRate: dailyRate,
    isDaily: true
  });
  assert.equal(regularDay.basePay, 600);
  assert.equal(regularDay.regularPay, 600);
  assert.equal(regularDay.holidayPay, 0);

  // 2. Paid holiday: 1 day 100% pay even if unworked/0 hours
  const paidHoliday = calculateDailyEntryPay({
    entry: { hours: 0, overtimeHours: 0, holidayType: 'paid_holiday' },
    baseRate: dailyRate,
    isDaily: true
  });
  assert.equal(paidHoliday.basePay, 600);
  assert.equal(paidHoliday.holidayPay, 600);
  assert.equal(paidHoliday.regularPay, 0);
  assert.equal(paidHoliday.isPaidHoliday, true);

  // 3. Double pay holiday: 2x daily rate (200% = 1200)
  const doubleHoliday = calculateDailyEntryPay({
    entry: { hours: 8, overtimeHours: 0, holidayType: 'double_holiday' },
    baseRate: dailyRate,
    isDaily: true
  });
  assert.equal(doubleHoliday.basePay, 1200);
  assert.equal(doubleHoliday.holidayPay, 1200);
  assert.equal(doubleHoliday.regularPay, 0);
  assert.equal(doubleHoliday.isDouble, true);
});

test('money and deduction validation reject malformed or impossible amounts', () => {
  assert.equal(toMoney('10.25'), 10.25);
  assert.throws(() => toMoney('10.256'), PayrollValidationError);
  assert.throws(() => calculatePayroll({ baseRate: 100, deductions: 101 }), /cannot exceed gross/);
  assert.throws(() => calculatePayroll({ salaryType: 'weekly', baseRate: 100 }), /Salary type/);
});

test('period parsing validates month and returns the last day', () => {
  assert.equal(validPayrollPeriod('2026-02'), '2026-02');
  assert.equal(payrollPeriodEnd('2024-02').toISOString().slice(0, 10), '2024-02-29');
  assert.throws(() => validPayrollPeriod('2026-13'), PayrollValidationError);
});

test('payroll payment retries with the same ID do not add a second payment', () => {
  const original = { status: 'finalized', netPay: 100, amountPaid: 0, balance: 100, payments: [] };
  const payment = { id: 'request-1', amount: 40, date: '2026-10-22', method: 'Cash', reference: '', notes: '', source: 'manual', recordedAt: '2026-10-22T00:00:00.000Z' };
  const first = addPayrollPayment(original, payment);
  const retry = addPayrollPayment(first.runData, { ...payment, recordedAt: '2026-10-22T00:00:01.000Z' });

  assert.equal(first.runData.payments.length, 1);
  assert.equal(first.runData.amountPaid, 40);
  assert.equal(first.runData.balance, 60);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.runData.payments.length, 1);
  assert.equal(retry.runData.amountPaid, 40);
});

test('a reused payroll payment ID with a changed request is rejected', () => {
  const original = { status: 'partially-paid', netPay: 100, amountPaid: 40, balance: 60, payments: [
    { id: 'request-1', amount: 40, date: '2026-10-22', method: 'Cash', reference: '', notes: '', source: 'manual' }
  ] };
  assert.throws(() => addPayrollPayment(original, {
    id: 'request-1', amount: 20, date: '2026-10-22', method: 'Cash', reference: '', notes: '', source: 'manual'
  }), PayrollConflictError);
});

test('payroll payment cannot exceed the balance and the final payment marks the run paid', () => {
  const original = { status: 'partially-paid', netPay: 100, amountPaid: 40, balance: 60, payments: [] };
  assert.throws(() => addPayrollPayment(original, { id: 'too-much', amount: 61, source: 'manual' }), PayrollValidationError);
  const result = addPayrollPayment(original, { id: 'final-payment', amount: 60, source: 'manual' });
  assert.equal(result.runData.amountPaid, 100);
  assert.equal(result.runData.balance, 0);
  assert.equal(result.runData.status, 'paid');
});
