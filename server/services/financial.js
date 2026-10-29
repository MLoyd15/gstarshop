const MONEY_PATTERN = /^\d+(?:\.\d{1,2})?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class FinancialValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FinancialValidationError';
    this.status = 400;
  }
}

function validDate(value) {
  const date = String(value ?? '').trim();
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function validateFinancialEntry(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FinancialValidationError('Financial entry must be an object.');
  if (['payrollRunId', 'payrollPaymentId'].some((key) => Object.hasOwn(input, key))) {
    throw new FinancialValidationError('Payroll-linked expenses can only be managed through the Pay runs page.');
  }
  if (['purchaseOrderId', 'purchasePaymentId'].some((key) => Object.hasOwn(input, key))) {
    throw new FinancialValidationError('Purchase-linked expenses can only be managed through the Purchases page.');
  }
  if (Object.hasOwn(input, 'expenseKind')) {
    throw new FinancialValidationError('System-managed expenses can only be managed through their business records.');
  }
  const name = String(input.name ?? '').trim();
  if (!name || name.length > 200) throw new FinancialValidationError('Enter a description up to 200 characters.');
  const category = String(input.category ?? '').trim();
  if (!category || category.length > 100) throw new FinancialValidationError('Enter a category up to 100 characters.');
  const resource = typeof options === 'string' ? options : (options.resource || input.resource);
  if (resource === 'expenses' && category.toLowerCase() === 'materials') {
    throw new FinancialValidationError('Materials cannot be entered manually as an expense category. Material costs are tracked automatically through inventory stock movements and completed booking jobs.');
  }
  const amountText = String(input.amount ?? '').trim();
  if (!MONEY_PATTERN.test(amountText)) throw new FinancialValidationError('Amount must be a positive value with no more than two decimal places.');
  const cents = Math.round(Number(amountText) * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new FinancialValidationError('Amount must be greater than zero and within the supported range.');
  if (!validDate(input.date)) throw new FinancialValidationError('Enter a valid transaction date in YYYY-MM-DD format.');
  return { ...input, name, category, amount: cents / 100, date: String(input.date).trim() };
}
