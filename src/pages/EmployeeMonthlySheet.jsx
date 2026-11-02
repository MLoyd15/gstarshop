import { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '../components/icons.jsx';
import { Check, Plus, X } from '../components/icons.jsx';
import '../styles/EmployeeMonthlySheet.css';
import '../styles/EmployeeMonthlyOvertime.css';
import { Alert, NOTICE_TIMEOUT_MS } from '../components/ui/alert.tsx';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { ConfirmDialog } from '../components/ui/alert-dialog.tsx';
import { calculateDailyEntryPay, calculateMonthlyPay } from '../../server/services/payroll.js';

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);
const monthDates = (period) => {
  const [year, month] = period.split('-').map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, index) => `${period}-${String(index + 1).padStart(2, '0')}`);
};
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function EmployeeMonthlySheet({ employee, overtimeRate: sharedOvertimeRate = 0, onClose }) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [attendancePage, setAttendancePage] = useState(0);
  const [hours, setHours] = useState({});
  const [overtimeHours, setOvertimeHours] = useState({});
  const [absentDays, setAbsentDays] = useState({});
  const [presentDays, setPresentDays] = useState({});
  const [holidayTypes, setHolidayTypes] = useState({});
  const [holidayNames, setHolidayNames] = useState({});
  const [advances, setAdvances] = useState([]);
  const [expandedAdvanceIds, setExpandedAdvanceIds] = useState({});
  const [pendingAdvanceId, setPendingAdvanceId] = useState(null);
  const [carryIn, setCarryIn] = useState(0);
  const [absenceRate, setAbsenceRate] = useState('');
  const [editingAbsenceRate, setEditingAbsenceRate] = useState(false);
  const [confirmAbsenceRate, setConfirmAbsenceRate] = useState(false);
  const [savingAbsenceRate, setSavingAbsenceRate] = useState(false);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const noticeTimeoutRef = useRef(null);
  useEffect(() => () => { if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    Promise.all([
      fetch(`/api/payroll/employees/${employee.id}/sheet?period=${period}`).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Could not load this employee sheet.');
        return d;
      }),
      fetch(`/api/payroll/holidays?period=${period}`).then((r) => r.ok ? r.json() : { holidays: [] }).catch(() => ({ holidays: [] }))
    ])
      .then(([sheetData, holidaysData]) => {
        if (cancelled) return;
        // Global holidays are the single source of truth for holidays across all employees
        const holidaysList = holidaysData.holidays || sheetData.holidays || [];
        const holidayMap = Object.fromEntries(holidaysList.map((h) => [h.date, h.type]));
        const holidayNamesMap = Object.fromEntries(holidaysList.map((h) => [h.date, h.name]));

        setHolidayTypes(holidayMap);
        setHolidayNames(holidayNamesMap);

        setHours(Object.fromEntries((sheetData.dailyEntries || []).map((entry) => [
          entry.date,
          holidayMap[entry.date] === 'paid_holiday' ? '' : (entry.hours !== undefined && entry.hours !== null ? String(entry.hours) : '')
        ])));
        setOvertimeHours(Object.fromEntries((sheetData.dailyEntries || []).filter((entry) =>
          entry.overtimeHours && holidayMap[entry.date] !== 'paid_holiday'
        ).map((entry) => [entry.date, String(entry.overtimeHours)])));
        setAbsentDays(Object.fromEntries((sheetData.dailyEntries || []).filter((entry) =>
          entry.absent && holidayMap[entry.date] !== 'paid_holiday'
        ).map((entry) => [entry.date, true])));
        setPresentDays(Object.fromEntries((sheetData.dailyEntries || []).filter((entry) =>
          !entry.absent && (entry.present === true || Number(entry.hours) > 0)
        ).map((entry) => [entry.date, true])));

        setAdvances((sheetData.advances || []).map((advance) => ({ ...advance, saved: true })));
        setCarryIn(Number(sheetData.advanceOwedBefore || 0));
        setAbsenceRate(sheetData.absenceDeductionPerDay == null ? '' : String(sheetData.absenceDeductionPerDay));
        setLocked(Boolean(sheetData.locked));
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employee.id, period]);

  const salaryType = employee.salaryType || 'monthly';
  const isDaily = salaryType === 'daily';
  const isMonthly = salaryType === 'monthly';
  const rate = Number(employee.salary || employee.baseRate) || 0;
  const overtimeRate = Number(sharedOvertimeRate) || 0;

  const getDayPay = (date) => {
    const type = holidayTypes[date] || 'regular';
    const isAbsent = Boolean(absentDays[date]);
    const h = isDaily || type === 'paid_holiday' ? 0 : Number(hours[date]) || 0;
    const ot = isDaily || type === 'paid_holiday' ? 0 : Number(overtimeHours[date]) || 0;
    const result = calculateDailyEntryPay({
      entry: { hours: h, overtimeHours: ot, absent: isAbsent, present: presentDays[date] === true, holidayType: type },
      baseRate: rate,
      isDaily,
      overtimeRate
    });
    return { basePay: result.basePay, otPay: result.overtimePay, total: result.totalPay, type: result.holidayType };
  };

  const dates = useMemo(() => monthDates(period), [period]);
  const attendancePageCount = Math.ceil(dates.length / 7);
  const visibleDates = dates.slice(attendancePage * 7, attendancePage * 7 + 7);

  const totals = useMemo(() => {
    let totalH = 0;
    let totalOtH = 0;
    let totalOtPay = 0;
    let regularEarnings = 0;
    let holidayEarnings = 0;
    let doubleCount = 0;
    let paidCount = 0;

    for (const d of dates) {
      const isPaidHoliday = (holidayTypes[d] || 'regular') === 'paid_holiday';
      const h = isPaidHoliday ? 0 : Number(hours[d]) || 0;
      const ot = isPaidHoliday ? 0 : Number(overtimeHours[d]) || 0;
      totalH += h;
      totalOtH += ot;
      const calc = getDayPay(d);
      totalOtPay += calc.otPay;
      if (calc.type === 'double_holiday') {
        doubleCount += 1;
        holidayEarnings += calc.basePay;
      } else if (calc.type === 'paid_holiday') {
        paidCount += 1;
        holidayEarnings += calc.basePay;
      } else {
        regularEarnings += calc.basePay;
      }
    }

    const gross = Math.round((regularEarnings + holidayEarnings + totalOtPay + Number.EPSILON) * 100) / 100;
    return {
      totalHours: totalH,
      totalOvertimeHours: totalOtH,
      totalOvertimePay: Math.round(totalOtPay * 100) / 100,
      regularEarnings: Math.round(regularEarnings * 100) / 100,
      holidayEarnings: Math.round(holidayEarnings * 100) / 100,
      doubleCount,
      paidCount,
      gross
    };
  }, [dates, hours, overtimeHours, absentDays, presentDays, holidayTypes, rate, overtimeRate, isDaily]);

  const totalAbsentDays = useMemo(() => Object.values(absentDays).filter(Boolean).length, [absentDays]);
  const totalDailyDays = useMemo(() => dates.filter((date) => {
    const type = holidayTypes[date] || 'regular';
    return type === 'paid_holiday' || (!absentDays[date] && presentDays[date] === true);
  }).length, [dates, holidayTypes, absentDays, presentDays]);
  const totalAdvances = useMemo(() => advances.reduce((total, advance) => total + (Number(advance.amount) || 0), 0), [advances]);
  const extras = ['allowances', 'bonus', 'commission'].reduce((sum, key) => sum + (Number(employee[key]) || 0), 0);
  const monthlyPay = calculateMonthlyPay({ monthlySalary: rate, workingDaysPerMonth: employee.workingDaysPerMonth || 26, absentDays: totalAbsentDays, perDayDeduction: absenceRate === '' ? undefined : Number(absenceRate), allowances: employee.allowances, bonus: employee.bonus, commission: employee.commission });
  const sheetGross = isMonthly ? monthlyPay.basicEarnings : totals.gross;
  const beforeAdvance = Math.max(0, sheetGross + extras - (Number(employee.regularDeductions) || 0));
  const advanceOwed = Math.max(0, carryIn + totalAdvances - beforeAdvance);
  const takeHome = Math.max(0, beforeAdvance - carryIn - totalAdvances);

  function addAdvance() {
    const today = new Date().toISOString().slice(0, 10);
    const date = period === today.slice(0, 7) ? today : `${period}-01`;
    setAdvances((items) => [...items, { id: id(), date, amount: '', note: '', confirmed: false }]);
  }

  async function saveAbsenceRate() {
    const amount = absenceRate === '' ? monthlyPay.perDayDeduction : Number(absenceRate);
    setSavingAbsenceRate(true); setError('');
    try {
      const response = await fetch(`/api/payroll/employees/${employee.id}/absence-rate`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save absence rate.');
      setAbsenceRate(String(data.absenceDeductionPerDay)); setConfirmAbsenceRate(false); setEditingAbsenceRate(false);
      setNotice('Default absence rate saved for this employee.');
      if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = window.setTimeout(() => { setNotice(''); noticeTimeoutRef.current = null; }, NOTICE_TIMEOUT_MS);
    } catch (e) { setError(e.message); setConfirmAbsenceRate(false); }
    finally { setSavingAbsenceRate(false); }
  }

  function confirmAdvance(advanceId) {
    const advance = advances.find((item) => item.id === advanceId);
    if (!advance || !(Number(advance.amount) > 0)) return;
    setAdvances((items) => items.map((item) => item.id === advanceId ? { ...item, confirmed: true } : item));
    setNotice(`Pay advance of ${money(advance.amount)} confirmed.`);
    if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = window.setTimeout(() => { setNotice(''); noticeTimeoutRef.current = null; }, NOTICE_TIMEOUT_MS);
  }

  function markWeekdaysPresent() {
    if (locked) return;
    setPresentDays((items) => {
      const next = { ...items };
      dates.forEach((date) => {
        const isSunday = new Date(`${date}T12:00:00`).getDay() === 0;
        if (!isSunday && holidayTypes[date] !== 'paid_holiday' && !absentDays[date]) next[date] = true;
      });
      return next;
    });
  }

  async function save() {
    setSaving(true); setError(''); setNotice('');
    const allDates = [...new Set([
      ...Object.keys(hours),
      ...Object.keys(overtimeHours),
      ...Object.keys(absentDays),
      ...Object.keys(presentDays),
      ...Object.keys(holidayTypes)
    ])];

    const dailyEntries = allDates
      .filter((date) =>
        absentDays[date] ||
        presentDays[date] ||
        (!isDaily && Number(hours[date]) > 0) ||
        (!isDaily && Number(overtimeHours[date]) > 0) ||
        holidayTypes[date] === 'paid_holiday' ||
        holidayTypes[date] === 'double_holiday'
      )
      .map((date) => ({
        date,
        hours: isDaily || absentDays[date] || holidayTypes[date] === 'paid_holiday' ? 0 : Number(hours[date]) || 0,
        overtimeHours: isDaily || absentDays[date] || holidayTypes[date] === 'paid_holiday' ? 0 : Number(overtimeHours[date]) || 0,
        absent: holidayTypes[date] === 'paid_holiday' ? false : Boolean(absentDays[date]),
        present: !absentDays[date] && (presentDays[date] === true || (!isDaily && Number(hours[date]) > 0)),
        holidayType: holidayTypes[date] || 'regular'
      }));

    const cleanAdvances = advances.filter((advance) => advance.confirmed !== false && Number(advance.amount) > 0).map(({ confirmed, saved, ...advance }) => ({ ...advance, amount: Number(advance.amount) }));
    try {
      const response = await fetch(`/api/payroll/employees/${employee.id}/sheet?period=${period}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isMonthly
          ? { absentDates: dates.filter((date) => absentDays[date]), advances: cleanAdvances, ...(absenceRate === '' ? {} : { absenceDeductionPerDay: Number(absenceRate) }) }
          : { dailyEntries, advances: cleanAdvances, overtimeRate })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save this sheet.');
      setCarryIn(Number(data.advanceOwedBefore || 0));
      if (data.absenceDeductionPerDay != null) setAbsenceRate(String(data.absenceDeductionPerDay));
      setAdvances((data.advances || []).map((advance) => ({ ...advance, confirmed: true, saved: true })));
      setLocked(Boolean(data.locked));
      setNotice('Monthly sheet saved.');
      if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = window.setTimeout(() => { setNotice(''); noticeTimeoutRef.current = null; }, NOTICE_TIMEOUT_MS);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent size="xl" busy={saving} className="timesheet-shell">
      <DialogHeader className="timesheet-header">
        <div>
          <span className="t-eyebrow">EMPLOYEE PAYROLL</span>
          <DialogTitle>{employee.name}</DialogTitle>
          <DialogDescription>
            {employee.employeeId || 'Employee'} · {money(rate)} {salaryType} {!isMonthly && !isDaily ? `· ${money(overtimeRate)} OT/hr` : ''}
          </DialogDescription>
        </div>
        <DialogClose disabled={saving} className="timesheet-close" />
      </DialogHeader>

      <DialogBody className="timesheet-body">
        <div className="timesheet-period">
          <label>Month<input className="input" type="month" value={period} onChange={(event) => { setPeriod(event.target.value); setAttendancePage(0); }} /></label>
          <span>{locked ? 'Payroll run exists · sheet locked' : isMonthly ? 'Mark absences and record advances' : isDaily ? 'Mark each workday Present or Absent' : 'Track regular hours and overtime · Holidays managed from Pay runs'}</span>
        </div>

        {error && <Alert className="timesheet-notice" variant="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
        {notice && <div className="timesheet-toast" role="status"><AppIcon icon={Check} size="sm" />{notice}</div>}

        <div className="timesheet-totals">
          {(isMonthly ? [
            ['Monthly salary', money(rate)],
            ['Absent days', String(totalAbsentDays)],
            ['Absence deduction', money(monthlyPay.absenceDeduction)],
            ['Gross earnings', money(monthlyPay.basicEarnings)],
            ['Additional earnings', money(extras), `Allowances: ${money(employee.allowances)} · Bonus: ${money(employee.bonus)} · Commission: ${money(employee.commission)}`],
            ['Regular deductions', `− ${money(employee.regularDeductions)}`],
            ['Advances', `− ${money(totalAdvances + carryIn)}`],
            ['Estimated take-home', money(takeHome)]
          ] : isDaily ? [
            ['Days present', String(totalDailyDays)],
            ['Holiday pay', `${totals.doubleCount + totals.paidCount} days · ${money(totals.holidayEarnings)}`],
            ['Gross earnings', money(totals.gross)],
            ['Additional earnings', money(extras), `Allowances: ${money(employee.allowances)} · Bonus: ${money(employee.bonus)} · Commission: ${money(employee.commission)}`],
            ['Regular deductions', `− ${money(employee.regularDeductions)}`],
            ['Absent days', String(totalAbsentDays)],
            ['Advances', `− ${money(totalAdvances + carryIn)}`],
            ['Estimated take-home', money(takeHome)]
          ] : [
            ['Hours this month', `${totals.totalHours} hrs`],
            ['Overtime', `${totals.totalOvertimeHours} hrs · ${money(totals.totalOvertimePay)}`],
            ['Holiday pay', `${totals.doubleCount + totals.paidCount} days · ${money(totals.holidayEarnings)}`],
            ['Gross earnings', money(totals.gross)],
            ['Additional earnings', money(extras), `Allowances: ${money(employee.allowances)} · Bonus: ${money(employee.bonus)} · Commission: ${money(employee.commission)}`],
            ['Regular deductions', `− ${money(employee.regularDeductions)}`],
            ['Absent days', String(totalAbsentDays)],
            ['Advances', `− ${money(totalAdvances + carryIn)}`],
            ['Estimated take-home', money(takeHome)]
          ]).map(([label, value, title]) => <article key={label} title={title} className={label === 'Estimated take-home' ? 'is-total' : undefined}><span>{label}</span><strong>{value}</strong></article>)}
        </div>

        {loading ? <div className="timesheet-loading">Loading monthly sheet…</div> : <div className="timesheet-content">
          {isMonthly ? <section className="timesheet-section timesheet-monthly-section">
            <div className="timesheet-section-heading">
              <div><h3>Monthly attendance</h3><p>Mark only days absent. Pay subtracts ₱{monthlyPay.perDayDeduction.toFixed(2)} per absence day ({monthlyPay.workingDaysPerMonth} working days).</p></div>
            </div>
            <div className="timesheet-days timesheet-monthly-days">
              {visibleDates.map((date) => <div className={`timesheet-day-row ${absentDays[date] ? 'is-absent' : ''}`} key={date}>
                <span>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                <button type="button" className={`btn timesheet-absence-toggle ${absentDays[date] ? 'is-absent' : ''}`} aria-pressed={Boolean(absentDays[date])} disabled={locked} onClick={() => setAbsentDays((items) => ({ ...items, [date]: !items[date] }))}>Absent</button>
              </div>)}
            </div>
            <div className="timesheet-pagination"><button type="button" className="btn btn-secondary" disabled={attendancePage === 0} onClick={() => setAttendancePage((page) => page - 1)}>Previous</button><span>Week {attendancePage + 1} of {attendancePageCount}</span><button type="button" className="btn btn-secondary" disabled={attendancePage + 1 >= attendancePageCount} onClick={() => setAttendancePage((page) => page + 1)}>Next</button></div>
          </section> : <section className="timesheet-section">
            <div className="timesheet-section-heading">
              <div>
                <h3>{isDaily ? 'Daily attendance' : 'Daily hours & attendance'}</h3>
                <p>{isDaily ? 'Choose Present or Absent. A Present day earns the daily rate. Holidays are managed from ' : 'Track regular hours and overtime. Holidays are applied automatically from '}<strong>Pay runs &rarr; Manage holidays</strong>.</p>
              </div>
              {isDaily && <button type="button" className="btn btn-secondary" disabled={locked} onClick={markWeekdaysPresent}>Mark Mon–Sat present</button>}
            </div>

            <div className="timesheet-days timesheet-days-overtime">
              {visibleDates.map((date) => {
                const dayPay = getDayPay(date);
                const isDouble = holidayTypes[date] === 'double_holiday';
                const isPaid = holidayTypes[date] === 'paid_holiday';
                const rowClass = [
                  'timesheet-day-row',
                  isDaily ? 'timesheet-day-row-daily' : '',
                  absentDays[date] ? 'is-absent' : '',
                  isDouble ? 'is-double-holiday' : '',
                  isPaid ? 'is-paid-holiday' : ''
                ].filter(Boolean).join(' ');

                return <div className={rowClass} key={date}>
                  <span>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>

                  <div className="timesheet-day-holiday">
                    {isDouble && <span className="timesheet-holiday-pill double" title={holidayNames[date] ? `${holidayNames[date]} (Double pay · 200%)` : 'Double pay holiday (200%)'}>Double pay (200%)</span>}
                    {isPaid && <span className="timesheet-holiday-pill paid" title={holidayNames[date] ? `${holidayNames[date]} (Paid holiday · 100%)` : 'Paid holiday (100%)'}>Paid holiday (100%)</span>}
                  </div>

                  {!isDaily && <input
                    className="input"
                    aria-label={`Regular hours worked on ${date}`}
                    type="number"
                    min="0"
                    max="24"
                    step="0.25"
                    placeholder={isPaid ? 'Paid' : 'Regular'}
                    value={isPaid ? '' : (hours[date] || '')}
                    disabled={locked || isPaid || absentDays[date]}
                    onChange={(event) => setHours((items) => ({ ...items, [date]: event.target.value }))}
                  />}

                  {!isDaily && <input
                    className="input"
                    aria-label={`Overtime hours worked on ${date}`}
                    type="number"
                    min="0"
                    max="24"
                    step="0.25"
                    placeholder={isPaid ? '—' : 'OT'}
                    value={isPaid ? '' : (overtimeHours[date] || '')}
                    disabled={locked || isPaid || absentDays[date]}
                    onChange={(event) => setOvertimeHours((items) => ({ ...items, [date]: event.target.value }))}
                  />}

                  {isDaily ? <button
                    type="button"
                    className={`btn timesheet-presence-toggle ${presentDays[date] ? 'is-present' : ''}`}
                    aria-pressed={Boolean(presentDays[date])}
                    disabled={locked || isPaid}
                    onClick={() => {
                      const nextPresent = !presentDays[date];
                      setPresentDays((items) => ({ ...items, [date]: nextPresent }));
                      setAbsentDays((items) => ({ ...items, [date]: false }));
                      setHours((items) => ({ ...items, [date]: '' }));
                      setOvertimeHours((items) => ({ ...items, [date]: '' }));
                    }}
                  >Present</button> : null}

                  {isDaily ? <button
                    type="button"
                    className={`btn timesheet-absence-toggle ${absentDays[date] ? 'is-absent' : ''}`}
                    aria-pressed={Boolean(absentDays[date])}
                    disabled={locked || isPaid}
                    onClick={() => {
                      const nextAbsent = !absentDays[date];
                      setAbsentDays((items) => ({ ...items, [date]: nextAbsent }));
                      setPresentDays((items) => ({ ...items, [date]: false }));
                      setHours((items) => ({ ...items, [date]: '' }));
                      setOvertimeHours((items) => ({ ...items, [date]: '' }));
                    }}
                  >Absent</button> : <button
                    type="button"
                    className={`btn timesheet-absence-toggle btn-secondary ${absentDays[date] ? 'is-absent' : ''}`}
                    aria-pressed={Boolean(absentDays[date])}
                    disabled={locked || isPaid}
                    onClick={() => {
                      const nextAbsent = !absentDays[date];
                      setAbsentDays((items) => ({ ...items, [date]: nextAbsent }));
                      if (nextAbsent) {
                        setPresentDays((items) => ({ ...items, [date]: false }));
                        setHours((items) => ({ ...items, [date]: '' }));
                        setOvertimeHours((items) => ({ ...items, [date]: '' }));
                      }
                    }}
                  >
                    {isPaid ? 'Paid holiday' : 'Absent'}
                  </button>}

                  <small title={isDouble ? 'Double Pay (200%)' : isPaid ? 'Paid Holiday (100%)' : 'Regular'}>
                    {absentDays[date] && !isPaid ? 'Absent'
                      : !isPaid && isDaily && !presentDays[date] && !absentDays[date] ? '—'
                        : !isPaid && !isDaily && !absentDays[date] && !(Number(hours[date]) > 0) && !(Number(overtimeHours[date]) > 0) ? '—'
                          : money(dayPay.total)}
                  </small>
                </div>;
              })}
            </div>
            <div className="timesheet-pagination"><button type="button" className="btn btn-secondary" disabled={attendancePage === 0} onClick={() => setAttendancePage((page) => page - 1)}>Previous</button><span>Week {attendancePage + 1} of {attendancePageCount}</span><button type="button" className="btn btn-secondary" disabled={attendancePage + 1 >= attendancePageCount} onClick={() => setAttendancePage((page) => page + 1)}>Next</button></div>
          </section>}

          <div className="timesheet-payroll-tools">
          <section className="timesheet-section timesheet-absence-rate-section">
            <div className="timesheet-section-heading"><div><h3>Absence deduction</h3><p>Default amount charged per absent day.</p></div></div>
            <button type="button" className="btn btn-secondary" disabled={locked || saving} onClick={() => setEditingAbsenceRate((value) => !value)}>{editingAbsenceRate ? 'Cancel' : 'Set absence rate'}</button>
            {editingAbsenceRate && <div className="timesheet-absence-rate-editor"><label className="timesheet-absence-rate">Amount per absent day<input className="input" type="number" min="0" step="0.01" value={absenceRate === '' ? monthlyPay.perDayDeduction : absenceRate} disabled={locked || savingAbsenceRate} onChange={(event) => setAbsenceRate(event.target.value)} /></label><button type="button" className="btn btn-primary" disabled={locked || savingAbsenceRate || absenceRate === ''} onClick={() => { setEditingAbsenceRate(false); setConfirmAbsenceRate(true); }}>Save default rate</button></div>}
          </section>
          <section className="timesheet-section">
            <div className="timesheet-section-heading">
              <div>
                <h3>Pay advances</h3>
                <p>Advance balance carries into the next month.</p>
              </div>
              <button type="button" className="btn btn-secondary" disabled={locked} onClick={addAdvance}><AppIcon icon={Plus} size="sm" /> Add advance</button>
            </div>
            {!advances.length ? <p className="timesheet-empty">No advances recorded this month.</p> : <div className="timesheet-advance-list">
              {advances.map((advance) => <div className="timesheet-advance-row" key={advance.id}>
                {advance.saved ? <div className="timesheet-advance-saved"><button type="button" className="timesheet-advance-summary" aria-expanded={Boolean(expandedAdvanceIds[advance.id])} onClick={() => setExpandedAdvanceIds((items) => ({ ...items, [advance.id]: !items[advance.id] }))}>{money(advance.amount)}</button>{expandedAdvanceIds[advance.id] && <span className="timesheet-advance-detail"><span>Date: {advance.date}</span><span>Optional note: {advance.note || '—'}</span></span>}</div> : <>
                  <label>Date<input className="input" type="date" value={advance.date} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, date: event.target.value } : item))} /></label>
                  <div className="timesheet-advance-amount"><label>Amount<input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={advance.amount} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, amount: event.target.value } : item))} /></label><button type="button" className={`btn btn-secondary ${pendingAdvanceId === advance.id ? 'is-pending' : ''}`} disabled={locked || !(Number(advance.amount) > 0)} onClick={() => setPendingAdvanceId(advance.id)}>Confirm advance</button></div>
                  {pendingAdvanceId === advance.id && <div className="timesheet-advance-confirmation" role="group" aria-label="Confirm pay advance"><span>Confirm pay advance of {money(advance.amount)}?</span><div><button type="button" className="btn btn-secondary" onClick={() => setPendingAdvanceId(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={() => { confirmAdvance(advance.id); setPendingAdvanceId(null); }}>Confirm</button></div></div>}
                  <label>Note<input className="input" type="text" placeholder="Optional note" value={advance.note || ''} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, note: event.target.value } : item))} /></label>
                </>}
                <button className="btn btn-icon btn-ghost" type="button" aria-label="Remove advance" disabled={locked} onClick={() => setAdvances((items) => items.filter((item) => item.id !== advance.id))}><AppIcon icon={X} size="sm" /></button>
              </div>)}
            </div>}
          </section>
          </div>
        </div>}
      </DialogBody>

      <DialogFooter className="timesheet-footer">
        <span>Advance balance carries into the next month.</span>
        <div>
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>Close</button>
          <button type="button" className="btn btn-primary" aria-busy={saving || undefined} disabled={saving || loading || locked} onClick={save}>
            {locked ? 'Payroll already generated' : saving ? 'Saving…' : 'Save monthly sheet'}
          </button>
        </div>
      </DialogFooter>
    </DialogContent>
    <ConfirmDialog open={confirmAbsenceRate} title="Save default absence rate?" description={`This will set ${money(absenceRate)} per absent day for ${employee.name}, including future months. It saves independently of the monthly sheet.`} confirmLabel={savingAbsenceRate ? 'Saving…' : 'Confirm rate'} onConfirm={saveAbsenceRate} onCancel={() => setConfirmAbsenceRate(false)} busy={savingAbsenceRate} overlayClassName="timesheet-confirm-overlay" />
  </Dialog>;
}
