import express from 'express';
import {
  addPayrollPayment, calculateDailyEntryPay, calculatePayroll, normalizePayrollPeriod, payrollPeriodEnd,
  PayrollValidationError, toMoney, validPayrollPeriod
} from '../services/payroll.js';

const active = (employee) => !['inactive', 'terminated'].includes(String(employee.status || 'active').toLowerCase());
const serialize = (record) => ({ ...record.data, id: record._id.toString(), createdAt: record.createdAt, updatedAt: record.updatedAt });

export function createPayrollRouter(BusinessRecord, mongoose) {
  const router = express.Router();
  const fail = (res, error) => res.status(error.status || 500).json({ error: error.message || 'Payroll action failed.' });

  router.get('/holidays', async (req, res) => {
    try {
      const period = validPayrollPeriod(req.query.period);
      const record = await BusinessRecord.findOne({ resource: 'payroll-holidays', 'data.period': period }).lean();
      res.json(record ? serialize(record) : { period, holidays: [] });
    } catch (error) { fail(res, error); }
  });

  router.put('/holidays', async (req, res) => {
    try {
      const period = validPayrollPeriod(req.body.period);
      const holidays = (Array.isArray(req.body.holidays) ? req.body.holidays : []).map((h) => {
        const type = ['double_holiday', 'paid_holiday', 'regular'].includes(h.type) ? h.type : 'regular';
        return {
          date: String(h.date || ''),
          name: String(h.name || '').trim(),
          type
        };
      }).filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date) && h.date.startsWith(`${period}-`));

      const holidayMap = new Map(holidays.map((h) => [h.date, h.type]));
      const data = { period, holidays, updatedAt: new Date().toISOString() };
      let record = await BusinessRecord.findOne({ resource: 'payroll-holidays', 'data.period': period });
      if (record) {
        record.data = data;
        record.updatedAt = new Date();
        await record.save();
      } else {
        [record] = await BusinessRecord.create([{ resource: 'payroll-holidays', data }]);
      }

      if (req.body.applyToSheets) {
        const timesheets = await BusinessRecord.find({ resource: 'payroll-timesheets', 'data.period': period });
        const runs = await BusinessRecord.find({ resource: 'payroll-runs', 'data.period': period }).lean();
        const lockedEmpIds = new Set(runs.map((r) => String(r.data.employeeRecordId)));

        for (const ts of timesheets) {
          if (lockedEmpIds.has(String(ts.data.employeeRecordId))) continue;
          const employeeRecord = await BusinessRecord.findOne({ _id: ts.data.employeeRecordId, resource: 'employees' }).lean();
          if (!employeeRecord) continue;
          const isDaily = (employeeRecord.data.salaryType || 'monthly') === 'daily';
          const rate = Number(employeeRecord.data.salary ?? employeeRecord.data.baseRate) || 0;
          const otRate = Number(ts.data.overtimeRate) || 0;

          const updatedEntries = (ts.data.dailyEntries || []).map((entry) => ({
            ...entry,
            holidayType: holidayMap.get(entry.date) || entry.holidayType || 'regular'
          }));

          let totalHours = 0;
          let totalOvertimeHours = 0;
          let regularPay = 0;
          let holidayPay = 0;
          let doubleHolidayPay = 0;
          let paidHolidayPay = 0;
          let regularDays = 0;
          let regularHours = 0;

          for (const entry of updatedEntries) {
            totalHours += Number(entry.hours || 0);
            totalOvertimeHours += Number(entry.overtimeHours || 0);
            const calc = calculateDailyEntryPay({ entry, baseRate: rate, isDaily, overtimeRate: otRate });
            regularPay += calc.regularPay;
            holidayPay += calc.holidayPay;
            doubleHolidayPay += calc.doubleHolidayPay || 0;
            paidHolidayPay += calc.paidHolidayPay || 0;
            if (calc.regularPay > 0) {
              regularDays += 1;
              regularHours += Number(entry.hours || 0);
            }
          }
          const overtimePay = Math.round((otRate * totalOvertimeHours + Number.EPSILON) * 100) / 100;
          const grossPay = Math.round((regularPay + holidayPay + overtimePay + Number.EPSILON) * 100) / 100;
          const additions = ['allowances', 'bonus', 'commission'].reduce((sum, key) => sum + (Number(employeeRecord.data[key]) || 0), 0);
          const regularDeductions = Number(ts.data.regularDeductions) || 0;
          const earningsBeforeAdvance = Math.max(0, grossPay + additions - regularDeductions);
          const advanceApplied = Math.min(Number(ts.data.advanceOwedBefore || 0) + Number(ts.data.totalAdvances || 0), earningsBeforeAdvance);
          const advanceOwed = Math.max(0, Number(ts.data.advanceOwedBefore || 0) + Number(ts.data.totalAdvances || 0) - earningsBeforeAdvance);

          ts.data = {
            ...ts.data,
            dailyEntries: updatedEntries,
            regularPay,
            holidayPay,
            doubleHolidayPay,
            paidHolidayPay,
            regularDays,
            regularHours,
            grossPay,
            overtimePay,
            totalHours,
            totalOvertimeHours,
            advanceApplied,
            advanceOwed,
            estimatedNetPay: Math.max(0, earningsBeforeAdvance - advanceApplied),
            updatedAt: new Date().toISOString()
          };
          ts.updatedAt = new Date();
          await ts.save();
        }
      }

      res.json(serialize(record));
    } catch (error) { fail(res, error); }
  });

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
      if (!['hourly', 'daily'].includes(employeeRecord.data.salaryType || 'monthly')) return res.status(409).json({ error: 'Set this employee’s pay basis to Hourly or Daily before entering timesheet records.' });
      const run = await BusinessRecord.findOne({ resource: 'payroll-runs', 'data.employeeRecordId': req.params.employeeId, 'data.period': period }).lean();
      if (run) return res.status(409).json({ error: 'This month already has a payroll run. Edit the draft from Pay runs or reverse the run before changing the sheet.' });
      const validDate = (date) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !String(date).startsWith(`${period}-`)) return false;
        const [year, month, day] = String(date).split('-').map(Number);
        const parsed = new Date(year, month - 1, day);
        return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
      };

      const dailyEntries = (Array.isArray(req.body.dailyEntries) ? req.body.dailyEntries : []).map((entry) => {
        const hours = Number(entry.hours || 0);
        const overtimeHours = Number(entry.overtimeHours || 0);
        const absent = entry.absent === true;
        const rawHolidayType = String(entry.holidayType || 'regular').trim().toLowerCase();
        const holidayType = ['double_holiday', 'paid_holiday', 'regular'].includes(rawHolidayType) ? rawHolidayType : 'regular';
        const totalDayHours = hours + overtimeHours;
        const validHours = Number.isFinite(hours) && Number.isFinite(overtimeHours) && hours >= 0 && overtimeHours >= 0 && totalDayHours <= 24;

        if (!validDate(entry.date) || !validHours) {
          throw new PayrollValidationError('Hours must be numbers between 0 and 24 for a valid date in this month.');
        }
        if (holidayType === 'paid_holiday' && totalDayHours > 0) {
          throw new PayrollValidationError('Paid holidays cannot include regular or overtime hours.');
        }

        if (absent) {
          if (totalDayHours !== 0) {
            throw new PayrollValidationError('Days marked absent cannot have worked hours.');
          }
        } else if (holidayType === 'regular' && totalDayHours <= 0) {
          throw new PayrollValidationError('Each workday needs regular or overtime hours, or must be marked absent or holiday.');
        }

        return {
          date: entry.date,
          hours: Math.round(hours * 100) / 100,
          overtimeHours: Math.round(overtimeHours * 100) / 100,
          absent,
          holidayType
        };
      });

      if (new Set(dailyEntries.map((entry) => entry.date)).size !== dailyEntries.length) {
        throw new PayrollValidationError('There can only be one hours entry per day.');
      }

      const advances = (Array.isArray(req.body.advances) ? req.body.advances : []).map((advance) => {
        if (!validDate(advance.date)) throw new PayrollValidationError('Each advance needs a date in the selected month.');
        const amount = toMoney(advance.amount, 'Advance amount');
        if (!amount) throw new PayrollValidationError('Advance amounts must be greater than zero.');
        return { id: String(advance.id || new mongoose.Types.ObjectId()), date: advance.date, amount, note: String(advance.note || '').trim() };
      });

      const totalHours = dailyEntries.reduce((sum, entry) => sum + entry.hours, 0);
      const totalOvertimeHours = dailyEntries.reduce((sum, entry) => sum + entry.overtimeHours, 0);
      const totalAdvances = advances.reduce((sum, entry) => sum + entry.amount, 0);
      const isDaily = (employeeRecord.data.salaryType || 'monthly') === 'daily';
      const rate = toMoney(employeeRecord.data.salary ?? employeeRecord.data.baseRate, isDaily ? 'Daily rate' : 'Hourly rate');
      const overtimeRate = req.body.overtimeRate === undefined
        ? toMoney(employeeRecord.data.overtimeRate, 'Overtime rate', { optional: true })
        : toMoney(req.body.overtimeRate, 'Overtime rate', { optional: true });

      let regularPay = 0;
      let holidayPay = 0;
      let doubleHolidayPay = 0;
      let paidHolidayPay = 0;
      let regularDays = 0;
      let regularHours = 0;
      let doubleHolidayCount = 0;
      let paidHolidayCount = 0;

      for (const entry of dailyEntries) {
        const calc = calculateDailyEntryPay({ entry, baseRate: rate, isDaily, overtimeRate });
        regularPay += calc.regularPay;
        holidayPay += calc.holidayPay;
        doubleHolidayPay += calc.doubleHolidayPay || 0;
        paidHolidayPay += calc.paidHolidayPay || 0;
        if (calc.holidayType === 'double_holiday') doubleHolidayCount += 1;
        if (calc.holidayType === 'paid_holiday') paidHolidayCount += 1;
        if (calc.regularPay > 0) {
          regularDays += 1;
          regularHours += Number(entry.hours || 0);
        }
      }

      regularPay = Math.round((regularPay + Number.EPSILON) * 100) / 100;
      holidayPay = Math.round((holidayPay + Number.EPSILON) * 100) / 100;
      doubleHolidayPay = Math.round((doubleHolidayPay + Number.EPSILON) * 100) / 100;
      paidHolidayPay = Math.round((paidHolidayPay + Number.EPSILON) * 100) / 100;
      const overtimePay = Math.round((overtimeRate * totalOvertimeHours + Number.EPSILON) * 100) / 100;
      const totalDays = dailyEntries.filter((entry) => entry.holidayType === 'paid_holiday' || (!entry.absent && (entry.hours > 0 || entry.worked !== false))).length;
      const grossPay = Math.round((regularPay + holidayPay + overtimePay + Number.EPSILON) * 100) / 100;

      const regularDeductions = toMoney(employeeRecord.data.regularDeductions, 'Regular deductions', { optional: true });
      const additions = ['allowances', 'bonus', 'commission'].reduce((sum, key) => sum + toMoney(employeeRecord.data[key], key, { optional: true }), 0);
      const earningsBeforeAdvance = Math.max(0, grossPay + additions - regularDeductions);
      const priorSheets = await BusinessRecord.find({ resource: 'payroll-timesheets', 'data.employeeRecordId': req.params.employeeId, 'data.period': { $lt: period } }).sort({ 'data.period': -1 }).limit(1).lean();
      const advanceOwedBefore = Number(priorSheets[0]?.data.advanceOwed || 0);
      const advanceApplied = Math.min(advanceOwedBefore + totalAdvances, earningsBeforeAdvance);
      const advanceOwed = Math.max(0, advanceOwedBefore + totalAdvances - earningsBeforeAdvance);

      const data = {
        employeeRecordId: req.params.employeeId,
        employee: employeeRecord.data.name,
        employeeId: employeeRecord.data.employeeId || '',
        period,
        rate,
        overtimeRate,
        overtimePay,
        dailyEntries,
        advances,
        totalHours,
        totalOvertimeHours,
        totalDays,
        regularDays,
        regularHours,
        regularPay,
        holidayPay,
        doubleHolidayPay,
        paidHolidayPay,
        doubleHolidayCount,
        paidHolidayCount,
        grossPay,
        regularDeductions,
        totalAdvances,
        advanceOwedBefore,
        advanceApplied,
        advanceOwed,
        estimatedNetPay: Math.max(0, earningsBeforeAdvance - advanceApplied),
        updatedAt: new Date().toISOString()
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
      const sharedOvertimeRate = req.body.overtimeRate === undefined ? null : toMoney(req.body.overtimeRate, 'Overtime rate', { optional: true });
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
        const salaryType = employee.salaryType || 'monthly';
        const totalDaysFromEntries = sheet?.dailyEntries?.filter((e) => e.holidayType === 'paid_holiday' || (!e.absent && (e.hours > 0 || e.worked !== false))).length;
        const daysWorked = sheet?.totalDays ?? (totalDaysFromEntries !== undefined ? totalDaysFromEntries : Number(unitsByEmployee[id] || 0));
        const unit = salaryType === 'daily' ? daysWorked : (sheet?.totalHours ?? unitsByEmployee[id]);
        const holidayPay = Number(sheet?.holidayPay || 0);

        if (salaryType === 'hourly' && !(Number(unit) > 0 || holidayPay > 0)) {
          skipped.push({ employee: employee.name || 'Employee', reason: 'No hours saved for this period.' });
          return [];
        }
        if (salaryType === 'daily' && !(Number(unit) > 0 || holidayPay > 0)) {
          skipped.push({ employee: employee.name || 'Employee', reason: 'No days worked saved for this period.' });
          return [];
        }
        const overtimeRate = sharedOvertimeRate ?? toMoney(sheet?.overtimeRate ?? employee.overtimeRate, 'Overtime rate', { optional: true });
        const overtimeHours = Number(sheet?.totalOvertimeHours || 0);
        const overtimePay = Math.round((overtimeRate * overtimeHours + Number.EPSILON) * 100) / 100;
        const regularDeductions = toMoney(employee.regularDeductions, 'Regular deductions', { optional: true });
        const advancesToApply = sheet
          ? Number(sheet.advanceOwedBefore || 0) + Number(sheet.totalAdvances || 0)
          : toMoney(advancesByEmployee[id], `${employee.name || 'Employee'} advance`, { optional: true });

        const baseUnits = salaryType === 'daily'
          ? (sheet?.regularDays !== undefined ? sheet.regularDays : unit)
          : salaryType === 'hourly'
            ? (sheet?.regularHours !== undefined ? sheet.regularHours : unit)
            : 1;

        const basicEarnings = sheet?.regularPay !== undefined
          ? Number(sheet.regularPay)
          : (Number(employee.salary ?? employee.baseRate) || 0) * (salaryType === 'hourly' || salaryType === 'daily' ? Number(baseUnits) || 0 : 1);

        const earningsBeforeAdvance = Math.max(0,
          basicEarnings + holidayPay +
          Number(employee.allowances || 0) + Number(employee.bonus || 0) + Number(employee.commission || 0) +
          Number(employee.otherEarnings || 0) + overtimePay - regularDeductions
        );
        const advanceDeduction = Math.min(advancesToApply, earningsBeforeAdvance);
        const advanceOwed = Math.max(0, advancesToApply - advanceDeduction);
        const calc = calculatePayroll({
          salaryType,
          baseRate: employee.salary ?? employee.baseRate,
          units: baseUnits,
          holidayPay,
          allowances: employee.allowances,
          bonus: employee.bonus,
          commission: employee.commission,
          otherEarnings: Number(employee.otherEarnings || 0) + overtimePay,
          deductions: regularDeductions + advanceDeduction
        });
        calc.otherEarnings = toMoney(employee.otherEarnings, 'Other earnings', { optional: true });
        return [{ resource: 'payroll-runs', data: {
          period, periodEnd: payrollPeriodEnd(period).toISOString().slice(0, 10), employee: employee.name,
          employeeId: employee.employeeId || '', employeeRecordId: id, employeeSnapshot: { ...employee },
          ...calc, regularDeductions, advanceDeduction,
          advanceDate: advanceDeduction > 0 ? (advanceDatesByEmployee[id] || sheet?.advances?.at(-1)?.date || '') : '',
          overtimeRate, overtimeHours, overtimePay,
          holidayPay,
          doubleHolidayCount: sheet?.doubleHolidayCount || 0,
          paidHolidayCount: sheet?.paidHolidayCount || 0,
          regularPay: sheet?.regularPay ?? calc.basicEarnings,
          dailyEntries: sheet?.dailyEntries || [], advances: sheet?.advances || [], advanceOwed: sheet ? advanceOwed : 0,
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
      const holidayPay = toMoney(d.holidayPay, 'Holiday pay', { optional: true });
      const calc = calculatePayroll({
        ...d,
        baseRate: d.baseRate,
        units: d.units,
        holidayPay,
        deductions: regularDeductions + advanceDeduction
      });
      record.data = { ...d, ...calc, holidayPay, regularDeductions, advanceDeduction, balance: calc.netPay };
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
