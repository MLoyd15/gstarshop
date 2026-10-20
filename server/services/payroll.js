const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const SALARY_TYPES = new Set(['monthly', 'daily', 'hourly']);

export class PayrollValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PayrollValidationError';
    this.status = 400;
  }
}

export function toMoney(value, label = 'Amount', { optional = false } = {}) {
  if ((value === '' || value === null || value === undefined) && optional) return 0;
  const text = String(value ?? '').trim();
  if (!MONEY_PATTERN.test(text)) throw new PayrollValidationError(`${label} must be a non-negative amount with no more than two decimal places.`);
  const cents = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(cents)) throw new PayrollValidationError(`${label} is too large.`);
  return cents / 100;
}

export function validPayrollPeriod(period) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ''))) {
    throw new PayrollValidationError('Choose a payroll period in YYYY-MM format.');
  }
  return period;
}

export function payrollPeriodEnd(period) {
  validPayrollPeriod(period);
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0, 12));
}

export function normalizePayrollPeriod(value) {
  if (!value) return '';
  const text = String(value).trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function calculatePayroll({ salaryType = 'monthly', baseRate, units, allowances = 0, bonus = 0, commission = 0, otherEarnings = 0, deductions = 0 }) {
  const type = String(salaryType || 'monthly').trim().toLowerCase();
  if (!SALARY_TYPES.has(type)) throw new PayrollValidationError('Salary type must be monthly, daily, or hourly.');

  const rate = toMoney(baseRate, 'Base pay rate');
  const parsedUnits = type === 'monthly' ? 1 : Number(units);
  if (!Number.isFinite(parsedUnits) || parsedUnits < 0 || (type !== 'monthly' && parsedUnits === 0)) {
    throw new PayrollValidationError(type === 'daily' ? 'Enter days worked for this employee.' : type === 'hourly' ? 'Enter hours worked for this employee.' : 'Units must be zero or greater.');
  }

  const basicEarnings = Math.round((rate * parsedUnits + Number.EPSILON) * 100) / 100;
  const earnings = {
    allowances: toMoney(allowances, 'Allowances', { optional: true }),
    bonus: toMoney(bonus, 'Bonus', { optional: true }),
    commission: toMoney(commission, 'Commission', { optional: true }),
    otherEarnings: toMoney(otherEarnings, 'Other earnings', { optional: true })
  };
  const totalDeductions = toMoney(deductions, 'Deductions', { optional: true });
  const grossPay = Math.round((basicEarnings + Object.values(earnings).reduce((sum, amount) => sum + amount, 0) + Number.EPSILON) * 100) / 100;
  if (totalDeductions > grossPay) throw new PayrollValidationError('Deductions cannot exceed gross earnings.');

  return {
    salaryType: type,
    baseRate: rate,
    units: parsedUnits,
    basicEarnings,
    ...earnings,
    grossPay,
    deductions: totalDeductions,
    netPay: Math.round((grossPay - totalDeductions + Number.EPSILON) * 100) / 100
  };
}

export function validateEmployeePayrollData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new PayrollValidationError('Employee data must be a JSON object.');
  const salaryType = String(data.salaryType || 'monthly').toLowerCase();
  if (!SALARY_TYPES.has(salaryType)) throw new PayrollValidationError('Salary type must be monthly, daily, or hourly.');
  toMoney(data.salary ?? data.baseRate, 'Base pay rate');
  for (const key of ['overtimeRate', 'allowances', 'bonus', 'commission', 'regularDeductions']) {
    toMoney(data[key], key === 'regularDeductions' ? 'Configured deductions' : key, { optional: true });
  }
  if (data.effectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.effectiveDate))) {
    throw new PayrollValidationError('Effective date must be a valid date.');
  }
  return { ...data, salaryType };
}

