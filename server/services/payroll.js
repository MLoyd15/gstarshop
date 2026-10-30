const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const SALARY_TYPES = new Set(['monthly', 'daily', 'hourly']);
export const HOLIDAY_TYPES = new Set(['regular', 'paid_holiday', 'double_holiday']);

export class PayrollValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PayrollValidationError';
    this.status = 400;
  }
}

export class PayrollConflictError extends PayrollValidationError {
  constructor(message) {
    super(message);
    this.name = 'PayrollConflictError';
    this.status = 409;
  }
}

export function addPayrollPayment(runData, payment) {
  const payments = runData.payments || [];
  const existing = payments.find((entry) => entry.id === payment.id);
  if (existing) {
    const sameRequest = ['amount', 'date', 'method', 'reference', 'notes', 'source']
      .every((key) => String(existing[key] ?? '') === String(payment[key] ?? ''));
    if (sameRequest) return { runData, duplicate: true };
    throw new PayrollConflictError('This payment ID was already used for a different payment.');
  }
  if (!['finalized', 'partially-paid'].includes(runData.status)) {
    throw new PayrollConflictError('Finalize this payroll run before recording payment.');
  }
  const paymentCents = Math.round(Number(payment.amount) * 100);
  const currentBalance = Number(runData.balance ?? (Number(runData.netPay) - Number(runData.amountPaid || 0)));
  const balanceCents = Math.round(currentBalance * 100);
  if (!Number.isSafeInteger(paymentCents) || paymentCents <= 0 || !Number.isSafeInteger(balanceCents) || paymentCents > balanceCents) {
    throw new PayrollValidationError('Payment must be greater than zero and no more than the outstanding balance.');
  }
  if (payment.source === 'externally-confirmed' && payments.some((entry) => entry.reference === payment.reference)) {
    throw new PayrollConflictError('This payment reference has already been recorded.');
  }
  const amountPaid = (Math.round(Number(runData.amountPaid || 0) * 100) + paymentCents) / 100;
  const balance = Math.max(0, balanceCents - paymentCents) / 100;
  const nextRunData = {
    ...runData,
    payments: [...payments, payment],
    amountPaid,
    balance,
    status: balance <= 0 ? 'paid' : 'partially-paid'
  };
  return { runData: nextRunData, duplicate: false };
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

export function calculateDailyEntryPay({ entry, baseRate, isDaily, overtimeRate = 0 }) {
  const rate = Number(baseRate) || 0;
  const otRate = Number(overtimeRate) || 0;
  const rawType = String(entry?.holidayType || 'regular').trim().toLowerCase();
  const holidayType = HOLIDAY_TYPES.has(rawType) ? rawType : 'regular';
  const hours = holidayType === 'paid_holiday' ? 0 : Number(entry?.hours) || 0;
  const overtimeHours = holidayType === 'paid_holiday' ? 0 : Number(entry?.overtimeHours) || 0;
  const absent = entry?.absent === true;
  const overtimePay = Math.round((overtimeHours * otRate + Number.EPSILON) * 100) / 100;

  if (isDaily) {
    if (holidayType === 'double_holiday') {
      const multiplier = (!absent && (hours > 0 || entry?.worked !== false)) ? 2 : (absent ? 1 : 2);
      const basePay = Math.round((multiplier * rate + Number.EPSILON) * 100) / 100;
      return {
        holidayType,
        basePay,
        overtimePay,
        totalPay: Math.round((basePay + overtimePay + Number.EPSILON) * 100) / 100,
        holidayPay: basePay,
        regularPay: 0,
        doubleHolidayPay: multiplier === 2 ? basePay : 0,
        paidHolidayPay: multiplier === 1 ? basePay : 0,
        isDouble: multiplier === 2,
        isPaidHoliday: multiplier === 1
      };
    }
    if (holidayType === 'paid_holiday') {
      const basePay = Math.round((rate + Number.EPSILON) * 100) / 100;
      return {
        holidayType,
        basePay,
        overtimePay,
        totalPay: Math.round((basePay + overtimePay + Number.EPSILON) * 100) / 100,
        holidayPay: basePay,
        regularPay: 0,
        doubleHolidayPay: 0,
        paidHolidayPay: basePay,
        isPaidHoliday: true
      };
    }
    if (absent || (hours === 0 && entry?.worked === false)) {
      return { holidayType, basePay: 0, overtimePay: 0, totalPay: 0, holidayPay: 0, regularPay: 0, doubleHolidayPay: 0, paidHolidayPay: 0 };
    }
    const basePay = Math.round((rate + Number.EPSILON) * 100) / 100;
    return {
      holidayType,
      basePay,
      overtimePay,
      totalPay: Math.round((basePay + overtimePay + Number.EPSILON) * 100) / 100,
      holidayPay: 0,
      regularPay: basePay,
      doubleHolidayPay: 0,
      paidHolidayPay: 0
    };
  }

  // Hourly employee:
  if (holidayType === 'double_holiday') {
    const effectiveHours = hours > 0 ? hours : (absent ? 0 : 8);
    const hourlyMultiplier = hours > 0 ? 2 : 1;
    const basePay = Math.round((effectiveHours * (rate * hourlyMultiplier) + Number.EPSILON) * 100) / 100;
    return {
      holidayType,
      basePay,
      overtimePay,
      totalPay: Math.round((basePay + overtimePay + Number.EPSILON) * 100) / 100,
      holidayPay: basePay,
      regularPay: 0,
      doubleHolidayPay: hourlyMultiplier === 2 ? basePay : 0,
      paidHolidayPay: hourlyMultiplier === 1 ? basePay : 0,
      isDouble: hourlyMultiplier === 2,
      isPaidHoliday: hourlyMultiplier === 1
    };
  }
  if (holidayType === 'paid_holiday') {
    const effectiveHours = 8;
    const basePay = Math.round((effectiveHours * rate + Number.EPSILON) * 100) / 100;
    return {
      holidayType,
      basePay,
      overtimePay,
      totalPay: Math.round((basePay + overtimePay + Number.EPSILON) * 100) / 100,
      holidayPay: basePay,
      regularPay: 0,
      doubleHolidayPay: 0,
      paidHolidayPay: basePay,
      isPaidHoliday: true
    };
  }
  if (absent) {
    return { holidayType, basePay: 0, overtimePay: 0, totalPay: 0, holidayPay: 0, regularPay: 0, doubleHolidayPay: 0, paidHolidayPay: 0 };
  }
  const basePay = Math.round((hours * rate + Number.EPSILON) * 100) / 100;
  return {
    holidayType,
    basePay,
    overtimePay,
    totalPay: Math.round((basePay + overtimePay + Number.EPSILON) * 100) / 100,
    holidayPay: 0,
    regularPay: basePay,
    doubleHolidayPay: 0,
    paidHolidayPay: 0
  };
}

export function calculatePayroll({ salaryType = 'monthly', baseRate, units, holidayPay, allowances = 0, bonus = 0, commission = 0, otherEarnings = 0, deductions = 0 }) {
  const type = String(salaryType || 'monthly').trim().toLowerCase();
  if (!SALARY_TYPES.has(type)) throw new PayrollValidationError('Salary type must be monthly, daily, or hourly.');

  const rate = toMoney(baseRate, 'Base pay rate');
  const parsedHolidayPay = toMoney(holidayPay, 'Holiday pay', { optional: true });
  const parsedUnits = type === 'monthly' ? 1 : Number(units);
  if (!Number.isFinite(parsedUnits) || parsedUnits < 0 || (type !== 'monthly' && parsedUnits === 0 && !(parsedHolidayPay > 0))) {
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
  const grossPay = Math.round((basicEarnings + parsedHolidayPay + Object.values(earnings).reduce((sum, amount) => sum + amount, 0) + Number.EPSILON) * 100) / 100;
  if (totalDeductions > grossPay) throw new PayrollValidationError('Deductions cannot exceed gross earnings.');

  const res = {
    salaryType: type,
    baseRate: rate,
    units: parsedUnits,
    basicEarnings,
    ...earnings,
    grossPay,
    deductions: totalDeductions,
    netPay: Math.round((grossPay - totalDeductions + Number.EPSILON) * 100) / 100
  };
  if (holidayPay !== undefined) {
    res.holidayPay = parsedHolidayPay;
  }
  return res;
}

export function validateEmployeePayrollData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new PayrollValidationError('Employee data must be a JSON object.');
  const salaryType = String(data.salaryType || 'monthly').toLowerCase();
  if (!SALARY_TYPES.has(salaryType)) throw new PayrollValidationError('Salary type must be monthly, daily, or hourly.');
  toMoney(data.salary ?? data.baseRate, 'Base pay rate');
  for (const key of ['overtimeRate', 'holidayRate', 'allowances', 'bonus', 'commission', 'regularDeductions']) {
    toMoney(data[key], key === 'regularDeductions' ? 'Configured deductions' : key, { optional: true });
  }
  if (data.effectiveDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.effectiveDate))) {
    throw new PayrollValidationError('Effective date must be a valid date.');
  }
  return { ...data, salaryType };
}
