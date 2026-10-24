import express from 'express';
import {
  addPayrollPayment, calculatePayroll, normalizePayrollPeriod, payrollPeriodEnd,
  PayrollValidationError, toMoney, validPayrollPeriod
} from '../services/payroll.js';

const active = (employee) => !['inactive', 'terminated'].includes(String(employee.status || 'active').toLowerCase());
const serialize = (record) => ({ ...record.data, id: record._id.toString(), createdAt: record.createdAt, updatedAt: record.updatedAt });

export function createPayrollRouter(BusinessRecord, mongoose) {
  const router = express.Router();
  const fail = (res, error) => res.status(error.status || 500).json({ error: error.message || 'Payroll action failed.' });

  router.get('/employees/:employeeId/sheet', async (req, res) => {
    try {
      const period = validPayrollPeriod(req.query.period);
      if (!mongoose.isValidObjectId(req.params.employeeId)) return res.status(400).json({ error: 'Employee ID is invalid.' });
      const employee = await BusinessRecord.findOne({ _id: req.params.employeeId, resource: 'employees' }).lean();
      if (!employee) return res.status(404).json({ error: 'Employee not found.' });
      const sheet = await BusinessRecord.findOne({ resource: 'payroll-timesheets', 'data.employeeRecordId': req.params.employeeId, 'data.period': period }).lean();
      const run = await BusinessRecord.findOne({ resource: 'payroll-runs', 'data.employeeRecordId': req.params.employeeId, 'data.period': period }).lean();
      const previous = sheet ? null : await BusinessRecord.findOne({ resource: 'payroll-timesheets', 'data.employeeRecordId': req.params.employeeId, 'data.period': { $lt: period } }).sort({ 'data.period': -1 }).lean();
      res.json({ ...(sheet ? serialize(sheet) : { employeeRecordId: req.params.employeeId, period, dailyEntries: [], advances: [], advanceOwedBefore: Number(previous?.data.advanceOwed || 0) }), locked: Boolean(run) });
    } catch (error) { fail(res, error); }
  });

  router.put('/employees/:employeeId/sheet', async (req, res) => {
    try {
      const period = validPayrollPeriod(req.query.period);
      if (!mongoose.isValidObjectId(req.params.employeeId)) return res.status(400).json({ error: 'Employee ID is invalid.' });
      const employeeRecord = await BusinessRecord.findOne({ _id: req.params.employeeId, resource: 'employees' });
      if (!employeeRecord) return res.status(404).json({ error: 'Employee not found.' });
      if ((employeeRecord.data.salaryType || 'monthly') !== 'hourly') return res.status(409).json({ error: 'Set this employee’s pay basis to Hourly before entering daily hours.' });
      const run = await BusinessRecord.findOne({ resource: 'payroll-runs', 'data.employeeRecordId': req.params.employeeId, 'data.period': period }).lean();
      if (run) return res.status(409).json({ error: 'This month already has a payroll run. Edit the draft from Pay runs or reverse the run before changing the sheet.' });
      const validDate = (date) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !String(date).startsWith(`${period}-`)) return false;
        const [year, month, day] = String(date).split('-').map(Number);
        const parsed = new Date(year, month - 1, day);
        return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
      };
      const dailyEntries = (Array.isArray(req.body.dailyEntries) ? req.body.dailyEntries : []).map((entry) => {
        const hours = Number(entry.hours);
        const overtimeHours = Number(entry.overtimeHours || 0);
        const absent = entry.absent === true;
        if (!validDate(entry.date) || !Number.isFinite(hours) || !Number.isFinite(overtimeHours) || hours < 0 || overtimeHours < 0 || (absent ? hours + overtimeHours !== 0 : hours + overtimeHours <= 0) || hours + overtimeHours > 24) throw new PayrollValidationError('Each workday needs regular or overtime hours, or must be marked absent. Hours must total between 0 and 24.');
        return { date: entry.date, hours: Math.round(hours * 100) / 100, overtimeHours: Math.round(overtimeHours * 100) / 100, absent };
      });
      if (new Set(dailyEntries.map((entry) => entry.date)).size !== dailyEntries.length) throw new PayrollValidationError('There can only be one hours entry per day.');
      const advances = (Array.isArray(req.body.advances) ? req.body.advances : []).map((advance) => {
        if (!validDate(advance.date)) throw new PayrollValidationError('Each advance needs a date in the selected month.');
        const amount = toMoney(advance.amount, 'Advance amount');
        if (!amount) throw new PayrollValidationError('Advance amounts must be greater than zero.');
        return { id: String(advance.id || new mongoose.Types.ObjectId()), date: advance.date, amount, note: String(advance.note || '').trim() };
      });
      const totalHours = dailyEntries.reduce((sum, entry) => sum + entry.hours, 0);
      const totalOvertimeHours = dailyEntries.reduce((sum, entry) => sum + entry.overtimeHours, 0);
      const totalAdvances = advances.reduce((sum, entry) => sum + entry.amount, 0);
      const rate = toMoney(employeeRecord.data.salary ?? employeeRecord.data.baseRate, 'Hourly rate');
      const overtimeRate = toMoney(employeeRecord.data.overtimeRate, 'Overtime rate', { optional: true });
      const overtimePay = Math.round((overtimeRate * totalOvertimeHours + Number.EPSILON) * 100) / 100;
      const grossPay = Math.round((rate * totalHours + overtimePay + Number.EPSILON) * 100) / 100;
      const regularDeductions = toMoney(employeeRecord.data.regularDeductions, 'Regular deductions', { optional: true });
      const additions = ['allowances', 'bonus', 'commission'].reduce((sum, key) => sum + toMoney(employeeRecord.data[key], key, { optional: true }), 0);
      const earningsBeforeAdvance = Math.max(0, grossPay + additions - regularDeductions);
      const priorSheets = await BusinessRecord.find({ resource: 'payroll-timesheets', 'data.employeeRecordId': req.params.employeeId, 'data.period': { $lt: period } }).sort({ 'data.period': -1 }).limit(1).lean();
      const advanceOwedBefore = Number(priorSheets[0]?.data.advanceOwed || 0);
      const advanceApplied = Math.min(advanceOwedBefore + totalAdvances, earningsBeforeAdvance);
      const advanceOwed = Math.max(0, advanceOwedBefore + totalAdvances - earningsBeforeAdvance);
      const data = {
        employeeRecordId: req.params.employeeId, employee: employeeRecord.data.name, employeeId: employeeRecord.data.employeeId || '',
        period, rate, overtimeRate, overtimePay, dailyEntries, advances, totalHours, totalOvertimeHours, grossPay, regularDeductions, totalAdvances,
        advanceOwedBefore, advanceApplied, advanceOwed,
        estimatedNetPay: Math.max(0, earningsBeforeAdvance - advanceApplied), updatedAt: new Date().toISOString()
      };
      let sheet = await BusinessRecord.findOne({ resource: 'payroll-timesheets', 'data.employeeRecordId': req.params.employeeId, 'data.period': period });
      if (sheet) { sheet.data = data; sheet.updatedAt = new Date(); await sheet.save(); }
      else [sheet] = await BusinessRecord.create([{ resource: 'payroll-timesheets', data }]);
      res.json(serialize(sheet));
    } catch (error) { fail(res, error); }
  });

  router.get('/runs', async (req, res) => {
    try {
      const query = { resource: 'payroll-runs' };
      if (req.query.period) query['data.period'] = validPayrollPeriod(req.query.period);
      const records = await BusinessRecord.find(query).sort({ updatedAt: -1 }).lean();
      res.json(records.map(serialize));
    } catch (error) { fail(res, error); }
  });

  router.post('/runs/generate', async (req, res) => {
    try {
      const period = validPayrollPeriod(req.body.period);
      const employees = await BusinessRecord.find({ resource: 'employees' }).lean();
      const existing = await BusinessRecord.find({ resource: 'payroll-runs' }).lean();
      const keys = new Set(existing.filter((r) => normalizePayrollPeriod(r.data.period) === period)
        .map((r) => String(r.data.employeeRecordId || r.data.employeeId || r.data.employee || '').toLowerCase()));
      const unitsByEmployee = req.body.unitsByEmployee || {};
      const advancesByEmployee = req.body.advancesByEmployee || {};
      const advanceDatesByEmployee = req.body.advanceDatesByEmployee || {};
      const requestedIds = Array.isArray(req.body.employeeIds) ? new Set(req.body.employeeIds.map(String)) : null;
      const timesheets = await BusinessRecord.find({ resource: 'payroll-timesheets', 'data.period': period }).lean();
      const sheetByEmployee = new Map(timesheets.map((sheet) => [String(sheet.data.employeeRecordId), sheet.data]));
      const skipped = [];
      const candidates = employees.filter((r) => active(r.data) && (!requestedIds || requestedIds.has(r._id.toString())));
      const prepared = candidates.flatMap((record) => {
        const employee = record.data;
        const id = record._id.toString();
        const employeeKey = String(employee.employeeId || employee.name || id).toLowerCase();
        if (keys.has(id.toLowerCase()) || keys.has(employeeKey)) { skipped.push({ employee: employee.name || 'Employee', reason: 'A payroll record already exists for this period.' }); return []; }
        const sheet = sheetByEmployee.get(id);
        const unit = sheet?.totalHours ?? unitsByEmployee[id];
        const salaryType = employee.salaryType || 'monthly';
        if (salaryType === 'hourly' && !(Number(unit) > 0)) { skipped.push({ employee: employee.name || 'Employee', reason: 'No hours saved for this period.' }); return []; }
        if (salaryType === 'daily') { skipped.push({ employee: employee.name || 'Employee', reason: 'Daily pay is not supported by the current timesheet.' }); return []; }
        const advanceDeduction = sheet?.advanceApplied ?? toMoney(advancesByEmployee[id], `${employee.name || 'Employee'} advance`, { optional: true });
        const regularDeductions = toMoney(employee.regularDeductions, 'Regular deductions', { optional: true });
        const calc = calculatePayroll({
          salaryType, baseRate: employee.salary ?? employee.baseRate,
          units: salaryType === 'daily' || salaryType === 'hourly' ? unit : 1,
          allowances: employee.allowances, bonus: employee.bonus, commission: employee.commission,
          otherEarnings: Number(employee.otherEarnings || 0) + Number(sheet?.overtimePay || 0),
          deductions: regularDeductions + advanceDeduction
        });
        calc.otherEarnings = toMoney(employee.otherEarnings, 'Other earnings', { optional: true });
        return [{ resource: 'payroll-runs', data: {
          period, periodEnd: payrollPeriodEnd(period).toISOString().slice(0, 10), employee: employee.name,
          employeeId: employee.employeeId || '', employeeRecordId: id, employeeSnapshot: { ...employee },
          ...calc, regularDeductions, advanceDeduction,
          advanceDate: advanceDeduction > 0 ? (advanceDatesByEmployee[id] || sheet?.advances?.at(-1)?.date || '') : '',
          overtimeRate: sheet?.overtimeRate || 0, overtimeHours: sheet?.totalOvertimeHours || 0, overtimePay: sheet?.overtimePay || 0,
          dailyEntries: sheet?.dailyEntries || [], advances: sheet?.advances || [], advanceOwed: sheet?.advanceOwed || 0,
          amountPaid: 0, balance: calc.netPay, payments: [], status: 'draft', expenseId: null
        }}];
      });
      if (!candidates.length) throw new PayrollValidationError('No active employees were selected for this payroll period.');
      const created = prepared.length ? await BusinessRecord.insertMany(prepared) : [];
      res.status(201).json({ created: created.map(serialize), skipped });
    } catch (error) { fail(res, error); }
  });

  router.patch('/runs/:id', async (req, res) => {
    try {
      const record = await BusinessRecord.findOne({ _id: req.params.id, resource: 'payroll-runs' });
      if (!record) return res.status(404).json({ error: 'Payroll run not found.' });
      if (record.data.status !== 'draft') return res.status(409).json({ error: 'Only draft payroll runs can be edited.' });
      const d = { ...record.data, ...req.body };
      const regularDeductions = toMoney(d.regularDeductions ?? d.deductions, 'Regular deductions', { optional: true });
      const advanceDeduction = toMoney(d.advanceDeduction, 'Advance paid', { optional: true });
      const calc = calculatePayroll({ ...d, baseRate: d.baseRate, units: d.units, deductions: regularDeductions + advanceDeduction });
      record.data = { ...d, ...calc, regularDeductions, advanceDeduction, balance: calc.netPay };
      record.updatedAt = new Date(); await record.save(); res.json(serialize(record));
    } catch (error) { fail(res, error); }
  });

  router.delete('/runs/:id', async (req, res) => {
    let session;
    try {
      session = await mongoose.startSession();
      let found = false;
      await session.withTransaction(async () => {
        const run = await BusinessRecord.findOne({ _id: req.params.id, resource: 'payroll-runs' }).session(session);
        if (!run) return;
        found = true;
        const expenseIds = [run.data.expenseId].filter(Boolean);
        await BusinessRecord.deleteMany({
          resource: 'expenses',
          $or: [
            { 'data.payrollRunId': run._id.toString() },
            ...(expenseIds.length ? [{ _id: { $in: expenseIds } }] : [])
          ]
        }).session(session);
        await run.deleteOne({ session });
      });
      if (!found) return res.status(404).json({ error: 'Payroll run not found.' });
      res.status(204).end();
    } catch (error) { fail(res, error); }
    finally { await session?.endSession(); }
  });
  router.post('/runs/:id/finalize', async (req, res) => {
    try {
      const run = await BusinessRecord.findOne({ _id: req.params.id, resource: 'payroll-runs' });
      if (!run) return res.status(404).json({ error: 'Payroll run not found.' });
      if (['finalized', 'partially-paid', 'paid'].includes(run.data.status)) return res.json(serialize(run));
      if (run.data.status !== 'draft') return res.status(409).json({ error: 'Only draft runs can be finalized.' });
      run.data = { ...run.data, status: 'finalized', finalizedAt: new Date().toISOString() };
      run.updatedAt = new Date(); await run.save(); res.json(serialize(run));
    } catch (error) { fail(res, error); }
  });

  router.post('/runs/:id/payments', async (req, res) => {
    let session;
    try {
      const amount = toMoney(req.body.amount, 'Payment amount');
      const date = String(req.body.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new PayrollValidationError('Enter a valid payment date.');
      const paymentId = String(req.body.paymentId || '').trim();
      if (!paymentId || paymentId.length > 128) throw new PayrollValidationError('A valid payment ID is required so repeated requests cannot record the same payment twice.');
      const payment = { id: paymentId, amount, date, method: String(req.body.method || 'Manual'), reference: String(req.body.reference || '').trim(), notes: String(req.body.notes || '').trim(), source: 'manual', recordedAt: new Date().toISOString() };
      if (req.body.source === 'externally-confirmed') {
        if (!payment.reference) throw new PayrollValidationError('An external payment reference is required.');
        payment.source = 'externally-confirmed';
      }
      session = await mongoose.startSession();
      let updatedRun;
      await session.withTransaction(async () => {
        const run = await BusinessRecord.findOne({ _id: req.params.id, resource: 'payroll-runs' }).session(session);
        if (!run) throw Object.assign(new Error('Payroll run not found.'), { status: 404 });
        const result = addPayrollPayment(run.data, payment);
        if (result.duplicate) { updatedRun = run; return; }

        let expense = await BusinessRecord.findOne({ resource: 'expenses', 'data.payrollPaymentId': paymentId }).session(session);
        if (!expense) expense = await BusinessRecord.findOne({ resource: 'expenses', 'data.payrollRunId': run._id.toString(), 'data.expenseKind': { $in: ['payroll-payment', 'payroll-accrual'] } }).session(session);
        const expenseData = {
          name: `Payroll payment ${run.data.period} — ${run.data.employee}`, category: 'Payroll', amount: result.runData.amountPaid,
          date, payrollRunId: run._id.toString(), payrollPaymentId: paymentId, expenseKind: 'payroll-payment',
          paymentMethod: payment.method, paymentReference: payment.reference
        };
        if (expense) { expense.data = { ...expense.data, ...expenseData }; expense.updatedAt = new Date(); await expense.save({ session }); }
        else [expense] = await BusinessRecord.create([{ resource: 'expenses', data: expenseData }], { session });
        run.data = { ...result.runData, expenseId: expense._id.toString() };
        run.updatedAt = new Date(); await run.save({ session });
        updatedRun = run;
      });
      res.json(serialize(updatedRun));
    } catch (error) { fail(res, error); }
    finally { await session?.endSession(); }
  });
  router.post('/runs/:id/reverse', async (req, res) => {
    try {
      const run = await BusinessRecord.findOne({ _id: req.params.id, resource: 'payroll-runs' });
      if (!run) return res.status(404).json({ error: 'Payroll run not found.' });
      if (run.data.status !== 'finalized' || Number(run.data.amountPaid || 0) > 0) return res.status(409).json({ error: 'Only finalized payroll runs with no payments can be reversed.' });
      const reason = String(req.body.reason || '').trim(); if (!reason) throw new PayrollValidationError('Enter a reason for reversing this payroll run.');
      const legacyExpense = run.data.expenseId ? await BusinessRecord.findOne({ _id: run.data.expenseId, resource: 'expenses' }) : null;
      if (legacyExpense) { legacyExpense.data = { ...legacyExpense.data, amount: 0, expenseKind: 'payroll-void' }; legacyExpense.updatedAt = new Date(); await legacyExpense.save(); }
      run.data = { ...run.data, status: 'reversed', reversalReason: reason, reversedAt: new Date().toISOString() };
      run.updatedAt = new Date(); await run.save(); res.json(serialize(run));
    } catch (error) { fail(res, error); }
  });

  return router;
}
