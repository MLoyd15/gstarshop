import express from 'express';
import {
  calculatePayroll, normalizePayrollPeriod, payrollPeriodEnd,
  PayrollValidationError, toMoney, validPayrollPeriod
} from '../services/payroll.js';

const active = (employee) => !['inactive', 'terminated'].includes(String(employee.status || 'active').toLowerCase());
const serialize = (record) => ({ ...record.data, id: record._id.toString(), createdAt: record.createdAt, updatedAt: record.updatedAt });

export function createPayrollRouter(BusinessRecord, mongoose) {
  const router = express.Router();
  const fail = (res, error) => res.status(error.status || 500).json({ error: error.message || 'Payroll action failed.' });

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
      const prepared = employees.filter((r) => active(r.data)).map((record) => {
        const employee = record.data;
        const id = record._id.toString();
        const employeeKey = String(employee.employeeId || employee.name || id).toLowerCase();
        if (keys.has(id.toLowerCase()) || keys.has(employeeKey)) throw new PayrollValidationError(`${employee.name || 'An employee'} already has a payroll run for ${period}.`);
        const unit = unitsByEmployee[id];
        const advanceDeduction = toMoney(advancesByEmployee[id], `${employee.name || 'Employee'} advance`, { optional: true });
        const regularDeductions = toMoney(employee.regularDeductions, 'Regular deductions', { optional: true });
        const calc = calculatePayroll({
          salaryType: employee.salaryType || 'monthly', baseRate: employee.salary ?? employee.baseRate,
          units: employee.salaryType === 'daily' || employee.salaryType === 'hourly' ? unit : 1,
          allowances: employee.allowances, bonus: employee.bonus, commission: employee.commission,
          deductions: regularDeductions + advanceDeduction
        });
        return { resource: 'payroll-runs', data: {
          period, periodEnd: payrollPeriodEnd(period).toISOString().slice(0, 10), employee: employee.name,
          employeeId: employee.employeeId || '', employeeRecordId: id, employeeSnapshot: { ...employee },
          ...calc, regularDeductions, advanceDeduction,
          advanceDate: advanceDeduction > 0 ? (advanceDatesByEmployee[id] || '') : '',
          amountPaid: 0, balance: calc.netPay, payments: [], status: 'draft', expenseId: null
        }};
      });
      if (!prepared.length) throw new PayrollValidationError('No active employees are available for this payroll period.');
      const created = await BusinessRecord.insertMany(prepared);
      res.status(201).json(created.map(serialize));
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

  router.post('/runs/:id/finalize', async (req, res) => {
    let session;
    try {
      const finish = async () => {
        const run = await BusinessRecord.findOne({ _id: req.params.id, resource: 'payroll-runs' }).session(session);
        if (!run) throw Object.assign(new Error('Payroll run not found.'), { status: 404 });
        if (run.data.status === 'finalized' || run.data.status === 'partially-paid' || run.data.status === 'paid') return run;
        if (run.data.status !== 'draft') throw Object.assign(new Error('Only draft runs can be finalized.'), { status: 409 });
        const expense = await BusinessRecord.create([{ resource: 'expenses', data: {
          name: `Payroll ${run.data.period} — ${run.data.employee}`, category: 'Payroll',
          amount: run.data.grossPay, date: run.data.periodEnd, payrollRunId: run._id.toString(), expenseKind: 'payroll-accrual'
        }}], { session });
        run.data = { ...run.data, status: 'finalized', finalizedAt: new Date().toISOString(), expenseId: expense[0]._id.toString() };
        run.updatedAt = new Date(); await run.save({ session }); return run;
      };
      try { session = await mongoose.startSession(); let result; await session.withTransaction(async () => { result = serialize(await finish()); }); res.json(result); }
      catch (error) {
        if (!/transaction numbers|replica set|does not support transactions/i.test(error.message)) throw error;
        // Standalone MongoDB has no transactions. Claim the draft first, then reuse a linked expense on retry.
        const now = new Date();
        let run = await BusinessRecord.findOneAndUpdate(
          { _id: req.params.id, resource: 'payroll-runs', 'data.status': 'draft' },
          { $set: { 'data.status': 'finalizing', 'data.finalizingAt': now.toISOString(), updatedAt: now } },
          { new: true }
        );
        if (!run) {
          run = await BusinessRecord.findOne({ _id: req.params.id, resource: 'payroll-runs' });
          if (!run) return res.status(404).json({ error: 'Payroll run not found.' });
          if (['finalized', 'partially-paid', 'paid'].includes(run.data.status)) return res.json(serialize(run));
          if (run.data.status !== 'finalizing' || Date.now() - Date.parse(run.data.finalizingAt || 0) < 60000) {
            return res.status(409).json({ error: 'This payroll run is already being finalized. Retry shortly.' });
          }
          run.data.finalizingAt = now.toISOString(); run.updatedAt = now; await run.save();
        }
        let expense = await BusinessRecord.findOne({ resource: 'expenses', 'data.payrollRunId': run._id.toString(), 'data.expenseKind': 'payroll-accrual' });
        if (!expense) expense = await BusinessRecord.create({ resource: 'expenses', data: {
          name: `Payroll ${run.data.period} — ${run.data.employee}`, category: 'Payroll', amount: run.data.grossPay,
          date: run.data.periodEnd, payrollRunId: run._id.toString(), expenseKind: 'payroll-accrual'
        }});
        run.data = { ...run.data, status: 'finalized', finalizedAt: now.toISOString(), expenseId: expense._id.toString() };
        delete run.data.finalizingAt; run.updatedAt = now; await run.save(); res.json(serialize(run));
      }
      finally { if (session) await session.endSession(); }
    } catch (error) { fail(res, error); }
  });

  router.post('/runs/:id/payments', async (req, res) => {
    try {
      const run = await BusinessRecord.findOne({ _id: req.params.id, resource: 'payroll-runs' });
      if (!run) return res.status(404).json({ error: 'Payroll run not found.' });
      if (!['finalized', 'partially-paid'].includes(run.data.status)) return res.status(409).json({ error: 'Finalize this payroll run before recording payment.' });
      const amount = toMoney(req.body.amount, 'Payment amount');
      if (!amount || amount > Number(run.data.balance)) throw new PayrollValidationError('Payment must be greater than zero and no more than the outstanding balance.');
      const date = String(req.body.date || ''); if (Number.isNaN(Date.parse(date))) throw new PayrollValidationError('Enter a valid payment date.');
      const payment = { amount, date, method: String(req.body.method || 'Manual'), reference: String(req.body.reference || '').trim(), notes: String(req.body.notes || '').trim(), source: 'manual', recordedAt: new Date().toISOString() };
      if (req.body.source === 'externally-confirmed') {
        if (!payment.reference) throw new PayrollValidationError('An external payment reference is required.');
        payment.source = 'externally-confirmed';
        if ((run.data.payments || []).some((p) => p.reference === payment.reference)) throw new PayrollValidationError('This payment reference has already been recorded.');
      }
      run.data = { ...run.data, payments: [...(run.data.payments || []), payment], amountPaid: Number(run.data.amountPaid || 0) + amount, balance: Number(run.data.balance) - amount };
      run.data.status = run.data.balance <= 0 ? 'paid' : 'partially-paid';
      run.updatedAt = new Date(); await run.save(); res.json(serialize(run));
    } catch (error) { fail(res, error); }
  });

  router.post('/runs/:id/reverse', async (req, res) => {
    try {
      const run = await BusinessRecord.findOne({ _id: req.params.id, resource: 'payroll-runs' });
      if (!run) return res.status(404).json({ error: 'Payroll run not found.' });
      if (run.data.status !== 'finalized' || Number(run.data.amountPaid || 0) > 0) return res.status(409).json({ error: 'Only finalized payroll runs with no payments can be reversed.' });
      const reason = String(req.body.reason || '').trim(); if (!reason) throw new PayrollValidationError('Enter a reason for reversing this payroll run.');
      const expense = await BusinessRecord.create({ resource: 'expenses', data: { name: `Payroll reversal ${run.data.period} — ${run.data.employee}`, category: 'Payroll reversal', amount: -Number(run.data.grossPay), date: new Date().toISOString().slice(0, 10), payrollRunId: run._id.toString(), expenseKind: 'payroll-reversal' } });
      run.data = { ...run.data, status: 'reversed', reversalReason: reason, reversedAt: new Date().toISOString(), reversalExpenseId: expense._id.toString() };
      run.updatedAt = new Date(); await run.save(); res.json(serialize(run));
    } catch (error) { fail(res, error); }
  });

  return router;
}
