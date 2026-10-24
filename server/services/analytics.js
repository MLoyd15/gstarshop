import { deriveBookingFinancials, isCancelledBooking } from './booking-financials.js';

const amountOf = (record) => {
  const amount = Number(record?.data?.amount);
  return Number.isFinite(amount) ? amount : 0;
};

const hasRevenueSnapshot = (completion) =>
  typeof completion?.revenueAmount === 'number' &&
  Number.isFinite(completion.revenueAmount) &&
  completion.revenueAmount >= 0;

function dateKey(value) {
  if (!value) return '';
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw ? '' : raw;
}

function monthKey(value, fallback = '') {
  const key = dateKey(value);
  return key ? key.slice(0, 7) : fallback;
}

function validMonth(period, now) {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ''))) return period;
  return now.toISOString().slice(0, 7);
}

function isReversed(data) {
  return data?.status === 'reversed' || Boolean(data?.reversedAt || data?.voidedAt);
}

function roundTo(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function buildAnalyticsSummary(records = [], requestedPeriod, now = new Date(), requestedMonths = 6) {
  const period = validMonth(requestedPeriod, now);
  const monthCount = [3, 6, 12].includes(Number(requestedMonths)) ? Number(requestedMonths) : 6;
  const [year, month] = period.split('-').map(Number);

  // 1. Build months list for the requested window across year boundaries
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(Date.UTC(year, month - monthCount + index, 1));
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      label: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      year: date.getUTCFullYear(),
      income: 0,
      expenses: 0,
      salesRevenue: 0,
      cashCollected: 0,
      payrollPaid: 0,
      materialCost: 0,
      actualRevenue: 0,
      estimatedRevenue: 0,
      grossMargin: 0,
      marginPercentage: 0,
      hasEstimated: false
    };
  });
  const monthByKey = new Map(months.map((m) => [m.key, m]));

  const ordinaryExpenses = (record) =>
    !record.data?.payrollRunId && !String(record.data?.expenseKind || '').startsWith('payroll-');

  const incomes = records.filter((r) => r.resource === 'income' && !isReversed(r.data));
  const expenses = records.filter((r) => r.resource === 'expenses' && ordinaryExpenses(r) && !isReversed(r.data));
  const bookings = records.filter((r) => r.resource === 'bookings');
  const nonCancelledBookings = bookings.filter((r) => !isCancelledBooking(r.data));
  const completedBookings = nonCancelledBookings.filter((r) => r.data?.completion?.status === 'completed');

  // Populate monthly income
  for (const record of incomes) {
    const key = monthKey(record.data?.date || record.createdAt);
    const m = monthByKey.get(key);
    if (m) m.income += amountOf(record);
  }

  // Populate monthly expenses
  for (const record of expenses) {
    const key = monthKey(record.data?.date || record.createdAt);
    const m = monthByKey.get(key);
    if (m) m.expenses += amountOf(record);
  }

  // Populate monthly gross margin & revenue
  for (const record of completedBookings) {
    const completion = record.data?.completion;
    const key = monthKey(completion.completionDate || completion.completedAt || record.updatedAt);
    const m = monthByKey.get(key);
    if (!m) continue;

    const materialCost = Number(completion.materialCost) || 0;
    m.materialCost += materialCost;

    if (hasRevenueSnapshot(completion)) {
      const revenue = Number(completion.revenueAmount) || 0;
      const isEst = completion.revenueSource === 'migration-current-booking-amount' || completion.revenueSource !== 'completion';
      m.salesRevenue += revenue;
      if (isEst) {
        m.estimatedRevenue += revenue;
        m.hasEstimated = true;
      } else {
        m.actualRevenue += revenue;
      }
      m.grossMargin += revenue - materialCost;
    }
  }

  // Populate monthly customer payments (cash collected)
  const seenBookingPayments = new Set();
  for (const record of bookings) {
    const bookingKey = record._id?.toString?.() || String(record.id || record.data?.name || 'booking');
    for (const [index, payment] of (record.data?.payments || []).entries()) {
      if (payment.voidedAt) continue;
      const uniqueKey = `${bookingKey}:${payment.idempotencyKey || payment.id || `legacy-${index}`}`;
      if (seenBookingPayments.has(uniqueKey)) continue;
      seenBookingPayments.add(uniqueKey);
      const amount = Number(payment.amount);
      const m = monthByKey.get(monthKey(payment.date, ''));
      if (m && Number.isFinite(amount) && amount >= 0) m.cashCollected += amount;
    }
  }

  // Populate monthly payroll paid
  const seenPayments = new Set();
  for (const record of records.filter((item) => item.resource === 'payroll-runs' && item.data?.status !== 'reversed')) {
    for (const [index, payment] of (record.data?.payments || []).entries()) {
      const paymentKey = payment.id ? `${record._id}:${payment.id}` : `${record._id}:legacy:${index}`;
      if (seenPayments.has(paymentKey)) continue;
      seenPayments.add(paymentKey);
      const m = monthByKey.get(monthKey(payment.date, ''));
      if (m && Number.isFinite(Number(payment.amount))) m.payrollPaid += Number(payment.amount);
    }
  }

  // Finalize monthly margin percentages & calculate peak for Income vs Expenses
  let peakVal = 0;
  let peakMonthKey = '';
  let peakType = 'income';

  for (const m of months) {
    m.income = roundTo(m.income, 2);
    m.expenses = roundTo(m.expenses, 2);
    m.salesRevenue = roundTo(m.salesRevenue, 2);
    m.cashCollected = roundTo(m.cashCollected, 2);
    m.payrollPaid = roundTo(m.payrollPaid, 2);
    m.actualRevenue = roundTo(m.actualRevenue, 2);
    m.estimatedRevenue = roundTo(m.estimatedRevenue, 2);
    m.materialCost = roundTo(m.materialCost, 2);
    m.grossMargin = roundTo(m.grossMargin, 2);
    m.marginPercentage = m.salesRevenue > 0 ? roundTo((m.grossMargin / m.salesRevenue) * 100, 1) : 0;

    const higherVal = Math.max(m.income, m.expenses);
    if (higherVal > peakVal) {
      peakVal = higherVal;
      peakMonthKey = m.key;
      peakType = m.income >= m.expenses ? 'income' : 'expenses';
    }
  }

  for (const m of months) {
    m.isPeak = Boolean(peakVal > 0 && m.key === peakMonthKey);
  }

  // 2. Expenses by category for the selected period
  const categoryMap = new Map();
  let totalPeriodExpenses = 0;
  let totalPeriodExpenseCount = 0;

  for (const record of expenses) {
    const key = monthKey(record.data?.date || record.createdAt);
    if (key !== period) continue;
    const cat = String(record.data?.category || '').trim() || 'Uncategorized';
    const amt = amountOf(record);
    const current = categoryMap.get(cat) || { category: cat, amount: 0, count: 0 };
    current.amount += amt;
    current.count += 1;
    categoryMap.set(cat, current);
    totalPeriodExpenses += amt;
    totalPeriodExpenseCount += 1;
  }

  totalPeriodExpenses = roundTo(totalPeriodExpenses, 2);

  const categories = Array.from(categoryMap.values())
    .map((item) => ({
      category: item.category,
      amount: roundTo(item.amount, 2),
      count: item.count,
      percentage: totalPeriodExpenses > 0 ? roundTo((item.amount / totalPeriodExpenses) * 100, 1) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // 3. Booking Pipeline Funnel (Booked -> Completed -> Paid)
  let bookedCount = 0;
  let bookedValue = 0;
  let completedCount = 0;
  let completedRevenue = 0;
  let paidCount = 0;
  let paidValue = 0;

  for (const record of nonCancelledBookings) {
    bookedCount += 1;
    const bookingAmt = Number(record.data?.amount) || 0;
    bookedValue += bookingAmt;

    const completion = record.data?.completion;
    const isComp = completion?.status === 'completed';
    if (isComp) {
      completedCount += 1;
      completedRevenue += hasRevenueSnapshot(completion) ? Number(completion.revenueAmount) : bookingAmt;
    }

    const fin = deriveBookingFinancials(record.data);
    if (fin.paymentStatus === 'paid' || fin.paymentStatus === 'overpaid') {
      paidCount += 1;
      paidValue += fin.paidAmount;
    }
  }

  bookedValue = roundTo(bookedValue, 2);
  completedRevenue = roundTo(completedRevenue, 2);
  paidValue = roundTo(paidValue, 2);

  const funnel = {
    booked: { count: bookedCount, value: bookedValue, label: 'Booked' },
    completed: {
      count: completedCount,
      value: completedRevenue,
      label: 'Completed',
      conversionRate: bookedCount > 0 ? roundTo((completedCount / bookedCount) * 100, 1) : 0
    },
    paid: {
      count: paidCount,
      value: paidValue,
      label: 'Fully Paid',
      conversionRate: completedCount > 0 ? roundTo((paidCount / completedCount) * 100, 1) : 0,
      overallConversionRate: bookedCount > 0 ? roundTo((paidCount / bookedCount) * 100, 1) : 0
    }
  };

  // 4. Unpaid Balances Bar List
  const unpaidBookings = nonCancelledBookings
    .map((record) => {
      const fin = deriveBookingFinancials(record.data);
      const isComp = record.data?.completion?.status === 'completed';
      return {
        id: record._id?.toString?.() || String(record.id || ''),
        name: record.data?.name || 'Untitled booking',
        client: record.data?.client || 'No client',
        date: record.data?.date || '',
        totalAmount: Number(record.data?.amount) || 0,
        paidAmount: fin.paidAmount,
        balance: roundTo(Math.max(0, fin.balance), 2),
        paymentLedgerVerified: fin.paymentLedgerVerified,
        isCompleted: isComp
      };
    })
    .filter((b) => b.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const totalUnpaidBalance = roundTo(unpaidBookings.reduce((sum, b) => sum + b.balance, 0), 2);
  const unverifiedUnpaidCount = unpaidBookings.filter((b) => !b.paymentLedgerVerified).length;

  return {
    period,
    chartMonths: monthCount,
    monthlyComparison: {
      months,
      peakMonth: {
        key: peakMonthKey,
        value: roundTo(peakVal, 2),
        type: peakType
      }
    },
    expensesByCategory: {
      period,
      categories,
      totalAmount: totalPeriodExpenses,
      totalCount: totalPeriodExpenseCount
    },
    funnel,
    grossMargin: {
      months,
      totalRevenue: roundTo(months.reduce((sum, m) => sum + m.salesRevenue, 0), 2),
      totalMaterialCost: roundTo(months.reduce((sum, m) => sum + m.materialCost, 0), 2),
      totalGrossMargin: roundTo(months.reduce((sum, m) => sum + m.grossMargin, 0), 2)
    },
    unpaidBalances: {
      items: unpaidBookings.slice(0, 10),
      totalCount: unpaidBookings.length,
      totalBalance: totalUnpaidBalance,
      unverifiedCount: unverifiedUnpaidCount
    },
    productRevenue: {
      supported: false,
      reason: 'Product-level revenue is not tracked. Bookings currently record total job price without itemized product links.'
    }
  };
}

