const amountOf = (record) => {
  const amount = Number(record?.data?.amount);
  return Number.isFinite(amount) ? amount : 0;
};

function dateKey(value) {
  if (!value) return '';
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw ? '' : raw;
}

function monthKey(value, fallback) {
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

export function buildDashboardSummary(records, requestedPeriod, now = new Date(), requestedMonths = 6) {
  const period = validMonth(requestedPeriod, now);
  const monthCount = [3, 6, 12].includes(Number(requestedMonths)) ? Number(requestedMonths) : 6;
  const [year, month] = period.split('-').map(Number);
  const periodDate = new Date(Date.UTC(year, month - 1, 1));
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - monthCount + 1 + index, 1));
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      label: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      income: 0,
      expenses: 0,
      payrollPaid: 0,
      materialCosts: 0
    };
  });
  const monthByKey = new Map(months.map((item) => [item.key, item]));
  const monthTotals = (key) => monthByKey.get(key);
  const ordinaryExpenses = (record) => !record.data.payrollRunId && !String(record.data.expenseKind || '').startsWith('payroll-');
  const incomes = records.filter((record) => record.resource === 'income' && !isReversed(record.data));
  const expenses = records.filter((record) => record.resource === 'expenses' && ordinaryExpenses(record) && !isReversed(record.data));
  const completedBookings = records.filter((record) => record.resource === 'bookings' && record.data.completion?.status === 'completed');
  const runs = records.filter((record) => record.resource === 'payroll-runs' && record.data.period === period && record.data.status !== 'reversed');
  const paymentRecords = [];

  for (const record of incomes) {
    const key = monthKey(record.data.date || record.createdAt, '');
    const item = monthTotals(key);
    if (item) item.income += amountOf(record);
  }
  for (const record of expenses) {
    const key = monthKey(record.data.date || record.createdAt, '');
    const item = monthTotals(key);
    if (item) item.expenses += amountOf(record);
  }
  for (const record of completedBookings) {
    const completion = record.data.completion;
    const key = monthKey(completion.completionDate || completion.completedAt || record.updatedAt, '');
    const item = monthTotals(key);
    if (item) item.materialCosts += Number.isFinite(Number(completion.materialCost)) ? Number(completion.materialCost) : 0;
  }

  const seenPayments = new Set();
  for (const record of records.filter((item) => item.resource === 'payroll-runs' && item.data.status !== 'reversed')) {
    for (const [index, payment] of (record.data.payments || []).entries()) {
      const paymentKey = payment.id ? `${record._id}:${payment.id}` : `${record._id}:legacy:${index}`;
      if (seenPayments.has(paymentKey)) continue;
      seenPayments.add(paymentKey);
      paymentRecords.push({ run: record, payment });
      const item = monthTotals(monthKey(payment.date, ''));
      if (item && Number.isFinite(Number(payment.amount))) item.payrollPaid += Number(payment.amount);
    }
  }

  const previousDate = new Date(Date.UTC(periodDate.getUTCFullYear(), periodDate.getUTCMonth() - 1, 1));
  const previousPeriod = previousDate.toISOString().slice(0, 7);
  const periodValues = (key) => {
    const read = (resource, dateSelector) => records
      .filter((record) => record.resource === resource && !isReversed(record.data) && dateSelector(record) === key)
      .reduce((sum, record) => sum + amountOf(record), 0);
    const income = read('income', (record) => monthKey(record.data.date || record.createdAt, ''));
    const expensesTotal = records.filter((record) => record.resource === 'expenses' && ordinaryExpenses(record) && !isReversed(record.data)
      && monthKey(record.data.date || record.createdAt, '') === key).reduce((sum, record) => sum + amountOf(record), 0);
    const materialCosts = completedBookings.filter((record) => {
      const completion = record.data.completion;
      return monthKey(completion.completionDate || completion.completedAt || record.updatedAt, '') === key;
    }).reduce((sum, record) => sum + (Number(record.data.completion.materialCost) || 0), 0);
    const payrollPaid = paymentRecords.filter(({ payment }) => monthKey(payment.date, '') === key)
      .reduce((sum, { payment }) => sum + (Number(payment.amount) || 0), 0);
    return { income, expenses: expensesTotal, payrollPaid, materialCosts };
  };

  const selectedTotals = periodValues(period);
  const previousTotals = periodValues(previousPeriod);
  const expenseCategories = {};
  for (const record of expenses) {
    if (monthKey(record.data.date || record.createdAt, '') !== period) continue;
    const category = String(record.data.category || '').trim() || 'Uncategorized';
    expenseCategories[category] = (expenseCategories[category] || 0) + amountOf(record);
  }
  const totalForRuns = (predicate, field) => runs.filter((record) => predicate(record.data.status))
    .reduce((sum, record) => sum + (Number(record.data[field]) || 0), 0);
  const payroll = {
    runCount: runs.length,
    employeeCount: new Set(runs.map((record) => String(record.data.employeeRecordId || record.data.employeeId || record.data.employee || record._id))).size,
    draftCount: runs.filter((record) => record.data.status === 'draft').length,
    finalizedCount: runs.filter((record) => record.data.status === 'finalized').length,
    partiallyPaidCount: runs.filter((record) => record.data.status === 'partially-paid').length,
    paidCount: runs.filter((record) => record.data.status === 'paid').length,
    gross: totalForRuns((status) => status !== 'reversed', 'grossPay'),
    overtime: totalForRuns((status) => status !== 'reversed', 'overtimePay'),
    deductions: totalForRuns((status) => status !== 'reversed', 'deductions'),
    net: totalForRuns((status) => status !== 'reversed', 'netPay'),
    paid: totalForRuns((status) => status !== 'reversed', 'amountPaid'),
    outstandingFinalized: runs.filter((record) => ['finalized', 'partially-paid'].includes(record.data.status))
      .reduce((sum, record) => sum + Math.max(0, Number(record.data.balance ?? (Number(record.data.netPay) - Number(record.data.amountPaid || 0))) || 0), 0)
  };
  const materials = records.filter((record) => record.resource === 'materials');
  const todayKey = dateKey(now);
  const todayDate = todayKey ? new Date(`${todayKey}T00:00:00.000Z`) : new Date();
  const upcomingEndKey = new Date(todayDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const openBookings = records.filter((record) => record.resource === 'bookings'
    && !['cancelled', 'canceled', 'complete', 'completed'].includes(String(record.data.status || 'active').toLowerCase())
    && record.data.completion?.status !== 'completed');
  const attention = [];
  for (const record of openBookings) {
    const bookingDate = dateKey(record.data.date);
    if (bookingDate && bookingDate < todayKey) attention.push({ key: `booking-overdue-${record._id}`, kind: 'booking', label: `${record.data.name || 'Booking'} · overdue`, detail: `Scheduled ${bookingDate}`, target: 'bookings', priority: 1 });
    else if (bookingDate && bookingDate >= todayKey && bookingDate <= upcomingEndKey) attention.push({ key: `booking-upcoming-${record._id}`, kind: 'booking', label: `${record.data.name || 'Booking'} · upcoming`, detail: `Scheduled ${bookingDate}`, target: 'bookings', priority: 3 });
    if (!(record.data.materialPlan || []).length) attention.push({ key: `booking-materials-${record._id}`, kind: 'booking', label: `${record.data.name || 'Booking'} · materials not planned`, detail: 'Add planned materials before completing this job.', target: 'bookings', priority: 2 });
  }
  for (const record of records.filter((item) => item.resource === 'purchase-orders')) {
    const data = record.data;
    if (['ordered', 'partially_received'].includes(data.status)) attention.push({ key: `purchase-receipt-${record._id}`, kind: 'purchase', label: `${data.number || 'Purchase order'} · awaiting receipt`, detail: data.expectedDate ? `Expected ${data.expectedDate}` : 'Stock has not been fully received.', target: 'purchases', priority: data.expectedDate && data.expectedDate < todayKey ? 1 : 2 });
    const balance = Math.max(0, Number(data.subtotal || 0) - Number(data.paidAmount || 0));
    if (data.status === 'received' && balance > 0) attention.push({ key: `supplier-balance-${record._id}`, kind: 'purchase', label: `${data.number || 'Purchase order'} · supplier balance`, detail: `Outstanding ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(balance)} · no payment due date is recorded`, target: 'purchases', priority: 3 });
  }
  for (const record of materials.filter((item) => item.data.active !== false && Number(item.data.quantity || 0) <= Number(item.data.reorderLevel || 0))) {
    const quantity = Number(record.data.quantity || 0);
    attention.push({ key: `material-stock-${record._id}`, kind: 'inventory', label: `${record.data.name || 'Material'} · ${quantity <= 0 ? 'out of stock' : 'low stock'}`, detail: `${quantity} ${record.data.unit || ''} on hand · reorder level ${Number(record.data.reorderLevel || 0)}`, target: 'materials', priority: quantity <= 0 ? 1 : 2 });
  }
  for (const run of runs.filter((record) => record.data.status === 'draft' || ['finalized', 'partially-paid'].includes(record.data.status))) {
    const status = run.data.status === 'draft' ? 'draft' : run.data.status === 'finalized' ? 'finalized' : 'partially paid';
    const action = run.data.status === 'draft' ? 'Review this saved run before finalizing.' : run.data.status === 'finalized' ? 'Payment is still outstanding.' : 'A balance remains to be paid.';
    attention.push({ key: `payroll-${run._id}`, kind: 'payroll', label: `Pay run · ${status}`, detail: `${run.data.period} · ${action}`, target: 'payroll-runs', priority: run.data.status === 'draft' ? 2 : 3 });
  }
  attention.sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
  const activeMaterials = materials.filter((record) => record.data.active !== false);
  const stockGroups = {
    out: activeMaterials.filter((record) => Number(record.data.quantity || 0) <= 0).length,
    low: activeMaterials.filter((record) => Number(record.data.quantity || 0) > 0 && Number(record.data.quantity || 0) <= Number(record.data.reorderLevel || 0)).length,
    healthy: activeMaterials.filter((record) => Number(record.data.quantity || 0) > Number(record.data.reorderLevel || 0)).length
  };
  const purchaseOrders = records.filter((record) => record.resource === 'purchase-orders');
  const operationCharts = {
    bookings: {
      active: openBookings.length,
      completed: records.filter((record) => record.resource === 'bookings' && record.data.completion?.status === 'completed').length
    },
    materials: stockGroups,
    purchasing: {
      awaitingReceipt: purchaseOrders.filter((record) => ['ordered', 'partially_received'].includes(record.data.status)).length,
      balanceDue: purchaseOrders.filter((record) => record.data.status === 'received' && Number(record.data.subtotal || 0) > Number(record.data.paidAmount || 0)).length
    }
  };
  const recent = records.filter((record) => ['income', 'expenses', 'purchase-orders', 'bookings'].includes(record.resource) && !isReversed(record.data))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5)
    .map((record) => ({
      id: record._id.toString(),
      name: record.data.name || record.data.description || record.resource,
      type: record.resource === 'purchase-orders' ? 'purchases' : record.resource,
      date: record.data.date || record.createdAt,
      amount: record.resource === 'purchase-orders' ? (Number(record.data.subtotal) || 0) : amountOf(record)
    }));

  return {
    period,
    previousPeriod,
    totals: {
      ...selectedTotals,
      expenseCategories,
      incomeEntries: incomes.filter((record) => monthKey(record.data.date || record.createdAt, '') === period).length,
      expenseEntries: expenses.filter((record) => monthKey(record.data.date || record.createdAt, '') === period).length,
      clients: records.filter((record) => record.resource === 'clients').length,
      materials: materials.filter((record) => record.data.active !== false).length,
      lowStockMaterials: materials.filter((record) => record.data.active !== false && Number(record.data.quantity || 0) <= Number(record.data.reorderLevel || 0)).length,
      suppliers: records.filter((record) => record.resource === 'suppliers').length,
      products: records.filter((record) => record.resource === 'products').length,
      bookings: records.filter((record) => record.resource === 'bookings' && !['cancelled', 'canceled', 'complete', 'completed'].includes(String(record.data.status || 'active').toLowerCase())).length
    },
    comparison: { current: selectedTotals, previous: previousTotals },
    payroll,
    attention,
    operationCharts,
    months,
    recent,
    financialLimits: {
      salesRevenueTrackedSeparately: false,
      customerReceivablesTracked: false,
      profitReliable: false
    }
  };
}
