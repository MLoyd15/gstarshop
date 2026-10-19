import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePayroll, payrollPeriodEnd, PayrollValidationError, toMoney, validPayrollPeriod } from './payroll.js';

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
