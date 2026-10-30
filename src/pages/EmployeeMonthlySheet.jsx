import { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '../components/icons.jsx';
import { Plus, X } from '../components/icons.jsx';
import '../styles/EmployeeMonthlySheet.css';
import '../styles/EmployeeMonthlyOvertime.css';
import { Alert, NOTICE_TIMEOUT_MS } from '../components/ui/alert.tsx';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);
const monthDates = (period) => {
  const [year, month] = period.split('-').map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, index) => `${period}-${String(index + 1).padStart(2, '0')}`);
};
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function EmployeeMonthlySheet({ employee, overtimeRate: sharedOvertimeRate = 0, onClose }) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [hours, setHours] = useState({});
  const [overtimeHours, setOvertimeHours] = useState({});
  const [absentDays, setAbsentDays] = useState({});
  const [holidayTypes, setHolidayTypes] = useState({});
  const [holidayNames, setHolidayNames] = useState({});
  const [advances, setAdvances] = useState([]);
  const [carryIn, setCarryIn] = useState(0);
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

        setAdvances(sheetData.advances || []);
        setCarryIn(Number(sheetData.advanceOwedBefore || 0));
        setLocked(Boolean(sheetData.locked));
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employee.id, period]);

  const isDaily = (employee.salaryType || 'monthly') === 'daily';
  const rate = Number(employee.salary || employee.baseRate) || 0;
  const overtimeRate = Number(sharedOvertimeRate) || 0;

  const getDayPay = (date) => {
    const type = holidayTypes[date] || 'regular';
    const isAbsent = Boolean(absentDays[date]);
    const h = type === 'paid_holiday' ? 0 : Number(hours[date]) || 0;
    const ot = type === 'paid_holiday' ? 0 : Number(overtimeHours[date]) || 0;
    const otPay = ot * overtimeRate;

    if (isDaily) {
      if (type === 'double_holiday') {
        const multiplier = (!isAbsent && (h > 0 || !isAbsent)) ? 2 : 1;
        return { basePay: rate * multiplier, otPay, total: rate * multiplier + otPay, type, multiplier };
      }
      if (type === 'paid_holiday') {
        return { basePay: rate, otPay, total: rate + otPay, type, multiplier: 1 };
      }
      if (isAbsent) return { basePay: 0, otPay: 0, total: 0, type, multiplier: 0 };
      return { basePay: rate, otPay, total: rate + otPay, type, multiplier: 1 };
    }

    // Hourly:
    if (type === 'double_holiday') {
      const effH = h > 0 ? h : (isAbsent ? 0 : 8);
      const mult = h > 0 ? 2 : 1;
      const basePay = effH * rate * mult;
      return { basePay, otPay, total: basePay + otPay, type, multiplier: mult };
    }
    if (type === 'paid_holiday') {
      const basePay = 8 * rate;
      return { basePay, otPay, total: basePay + otPay, type, multiplier: 1 };
    }
    if (isAbsent) return { basePay: 0, otPay: 0, total: 0, type, multiplier: 0 };
    const basePay = h * rate;
    return { basePay, otPay, total: basePay + otPay, type, multiplier: 1 };
  };

  const dates = useMemo(() => monthDates(period), [period]);

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
  }, [dates, hours, overtimeHours, absentDays, holidayTypes, rate, overtimeRate, isDaily]);

  const totalAbsentDays = useMemo(() => Object.values(absentDays).filter(Boolean).length, [absentDays]);
  const totalAdvances = useMemo(() => advances.reduce((total, advance) => total + (Number(advance.amount) || 0), 0), [advances]);
  const extras = ['allowances', 'bonus', 'commission'].reduce((sum, key) => sum + (Number(employee[key]) || 0), 0);
  const beforeAdvance = Math.max(0, totals.gross + extras - (Number(employee.regularDeductions) || 0));
  const advanceOwed = Math.max(0, carryIn + totalAdvances - beforeAdvance);
  const takeHome = Math.max(0, beforeAdvance - carryIn - totalAdvances);

  function addAdvance() {
    const today = new Date().toISOString().slice(0, 10);
    const date = period === today.slice(0, 7) ? today : `${period}-01`;
    setAdvances((items) => [...items, { id: id(), date, amount: '', note: '' }]);
  }

  async function save() {
    setSaving(true); setError(''); setNotice('');
    const allDates = [...new Set([
      ...Object.keys(hours),
      ...Object.keys(overtimeHours),
      ...Object.keys(absentDays),
      ...Object.keys(holidayTypes)
    ])];

    const dailyEntries = allDates
      .filter((date) =>
        absentDays[date] ||
        Number(hours[date]) > 0 ||
        Number(overtimeHours[date]) > 0 ||
        holidayTypes[date] === 'paid_holiday' ||
        holidayTypes[date] === 'double_holiday'
      )
      .map((date) => ({
        date,
        hours: absentDays[date] || holidayTypes[date] === 'paid_holiday' ? 0 : Number(hours[date]) || 0,
        overtimeHours: absentDays[date] || holidayTypes[date] === 'paid_holiday' ? 0 : Number(overtimeHours[date]) || 0,
        absent: holidayTypes[date] === 'paid_holiday' ? false : Boolean(absentDays[date]),
        holidayType: holidayTypes[date] || 'regular'
      }));

    const cleanAdvances = advances.filter((advance) => Number(advance.amount) > 0).map((advance) => ({ ...advance, amount: Number(advance.amount) }));
    try {
      const response = await fetch(`/api/payroll/employees/${employee.id}/sheet?period=${period}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyEntries, advances: cleanAdvances, overtimeRate })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save this sheet.');
      setCarryIn(Number(data.advanceOwedBefore || 0));
      setAdvances(data.advances || []);
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
            {employee.employeeId || 'Employee'} · {money(rate)} {isDaily ? 'daily' : 'hourly'} · {money(overtimeRate)} OT/hr
          </DialogDescription>
        </div>
        <DialogClose disabled={saving} className="timesheet-close" />
      </DialogHeader>

      <DialogBody className="timesheet-body">
        <div className="timesheet-period">
          <label>Month<input className="input" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
          <span>{locked ? 'Payroll run exists · sheet locked' : 'Track regular hours and overtime · Holidays managed from Pay runs'}</span>
        </div>

        {error && <Alert className="timesheet-notice" variant="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
        {notice && <Alert className="timesheet-notice" variant="success">{notice}</Alert>}

        <div className="timesheet-totals">
          {[
            ['Hours this month', `${totals.totalHours} hrs`],
            ['Overtime', `${totals.totalOvertimeHours} hrs · ${money(totals.totalOvertimePay)}`],
            ['Holiday pay', `${totals.doubleCount + totals.paidCount} days · ${money(totals.holidayEarnings)}`],
            ['Gross earnings', money(totals.gross)],
            ['Absent days', String(totalAbsentDays)],
            ['Advances paid', money(totalAdvances)],
            ['Advance still owed', money(advanceOwed)],
            ['Estimated take-home', money(takeHome)]
          ].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
        </div>

        {loading ? <div className="timesheet-loading">Loading monthly sheet…</div> : <div className="timesheet-content">
          <section className="timesheet-section">
            <div className="timesheet-section-heading">
              <div>
                <h3>Daily hours & attendance</h3>
                <p>Track regular hours and overtime. Holidays are applied automatically from <strong>Pay runs &rarr; Manage holidays</strong>.</p>
              </div>
            </div>

            <div className="timesheet-days timesheet-days-overtime">
              {dates.map((date) => {
                const dayPay = getDayPay(date);
                const isDouble = holidayTypes[date] === 'double_holiday';
                const isPaid = holidayTypes[date] === 'paid_holiday';
                const rowClass = [
                  'timesheet-day-row',
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

                  <input
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
                  />

                  <input
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
                  />

                  <button
                    type="button"
                    className="btn timesheet-absence-toggle btn-secondary"
                    aria-pressed={Boolean(absentDays[date])}
                    disabled={locked || isPaid}
                    onClick={() => {
                      const nextAbsent = !absentDays[date];
                      setAbsentDays((items) => ({ ...items, [date]: nextAbsent }));
                      if (nextAbsent) {
                        setHours((items) => ({ ...items, [date]: '' }));
                        setOvertimeHours((items) => ({ ...items, [date]: '' }));
                      }
                    }}
                  >
                    {isPaid ? 'Paid holiday' : absentDays[date] ? 'Absent' : 'Mark absent'}
                  </button>

                  <small title={isDouble ? 'Double Pay (200%)' : isPaid ? 'Paid Holiday (100%)' : 'Regular'}>
                    {absentDays[date] && !isPaid && !isDouble ? 'Absent' : money(dayPay.total)}
                  </small>
                </div>;
              })}
            </div>
          </section>

          <section className="timesheet-section">
            <div className="timesheet-section-heading">
              <div>
                <h3>Pay advances</h3>
                <p>Record each advance paid. The sheet shows any amount still owed after earned pay.</p>
              </div>
              <button type="button" className="btn btn-secondary" disabled={locked} onClick={addAdvance}>
                <AppIcon icon={Plus} size="sm" /> Add advance
              </button>
            </div>
            {!advances.length ? <p className="timesheet-empty">No advances recorded this month.</p> : <div className="timesheet-advance-list">
              {advances.map((advance) => <div className="timesheet-advance-row" key={advance.id}>
                <label>Date<input className="input" type="date" value={advance.date} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, date: event.target.value } : item))} /></label>
                <label>Amount<input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={advance.amount} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, amount: event.target.value } : item))} /></label>
                <label>Note<input className="input" type="text" placeholder="Optional note" value={advance.note || ''} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, note: event.target.value } : item))} /></label>
                <button className="btn btn-icon btn-ghost" type="button" aria-label="Remove advance" disabled={locked} onClick={() => setAdvances((items) => items.filter((item) => item.id !== advance.id))}><AppIcon icon={X} size="sm" /></button>
              </div>)}
            </div>}
          </section>
        </div>}
      </DialogBody>

      <DialogFooter className="timesheet-footer">
        <span>Advance balance carries into the next month. Double pay holidays calculate at 200%, paid holidays at 100%.</span>
        <div>
          <button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>Close</button>
          <button type="button" className="btn btn-primary" aria-busy={saving || undefined} disabled={saving || loading || locked} onClick={save}>
            {locked ? 'Payroll already generated' : saving ? 'Saving…' : 'Save monthly sheet'}
          </button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
