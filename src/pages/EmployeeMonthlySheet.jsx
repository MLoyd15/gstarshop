import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [hours, setHours] = useState({}); const [overtimeHours, setOvertimeHours] = useState({}); const [absentDays, setAbsentDays] = useState({}); const [advances, setAdvances] = useState([]);
  const [carryIn, setCarryIn] = useState(0); const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const noticeTimeoutRef = useRef(null);
  useEffect(() => () => { if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current); }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    fetch(`/api/payroll/employees/${employee.id}/sheet?period=${period}`)
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load this employee sheet.'); return data; })
      .then((data) => {
        if (cancelled) return;
        setHours(Object.fromEntries((data.dailyEntries || []).map((entry) => [entry.date, String(entry.hours)])));
        setOvertimeHours(Object.fromEntries((data.dailyEntries || []).filter((entry) => entry.overtimeHours).map((entry) => [entry.date, String(entry.overtimeHours)])));
        setAbsentDays(Object.fromEntries((data.dailyEntries || []).filter((entry) => entry.absent).map((entry) => [entry.date, true])));
        setAdvances(data.advances || []); setCarryIn(Number(data.advanceOwedBefore || 0)); setLocked(Boolean(data.locked));
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employee.id, period]);

  const totalHours = useMemo(() => Object.values(hours).reduce((total, value) => total + (Number(value) || 0), 0), [hours]);
  const totalOvertimeHours = useMemo(() => Object.values(overtimeHours).reduce((total, value) => total + (Number(value) || 0), 0), [overtimeHours]);
  const totalAbsentDays = useMemo(() => Object.values(absentDays).filter(Boolean).length, [absentDays]);
  const totalAdvances = useMemo(() => advances.reduce((total, advance) => total + (Number(advance.amount) || 0), 0), [advances]);
  const rate = Number(employee.salary || employee.baseRate) || 0;
  const overtimeRate = Number(sharedOvertimeRate) || 0;
  const overtimePay = Math.round(overtimeRate * totalOvertimeHours * 100) / 100;
  const gross = Math.round((rate * totalHours + overtimePay) * 100) / 100;
  const extras = ['allowances', 'bonus', 'commission'].reduce((sum, key) => sum + (Number(employee[key]) || 0), 0);
  const beforeAdvance = Math.max(0, gross + extras - (Number(employee.regularDeductions) || 0));
  const advanceOwed = Math.max(0, carryIn + totalAdvances - beforeAdvance);
  const takeHome = Math.max(0, beforeAdvance - carryIn - totalAdvances);

  function addAdvance() { const today = new Date().toISOString().slice(0, 10); const date = period === today.slice(0, 7) ? today : `${period}-01`; setAdvances((items) => [...items, { id: id(), date, amount: '', note: '' }]); }
  async function save() {
    setSaving(true); setError(''); setNotice('');
    const dailyEntries = [...new Set([...Object.keys(hours), ...Object.keys(overtimeHours), ...Object.keys(absentDays)])].filter((date) => absentDays[date] || Number(hours[date]) > 0 || Number(overtimeHours[date]) > 0).map((date) => ({ date, hours: absentDays[date] ? 0 : Number(hours[date]) || 0, overtimeHours: absentDays[date] ? 0 : Number(overtimeHours[date]) || 0, absent: Boolean(absentDays[date]) }));
    const cleanAdvances = advances.filter((advance) => Number(advance.amount) > 0).map((advance) => ({ ...advance, amount: Number(advance.amount) }));
    try {
      const response = await fetch(`/api/payroll/employees/${employee.id}/sheet?period=${period}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dailyEntries, advances: cleanAdvances, overtimeRate })
      });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not save this sheet.');
      setCarryIn(Number(data.advanceOwedBefore || 0)); setAdvances(data.advances || []); setLocked(Boolean(data.locked)); setNotice('Monthly sheet saved.');
      if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = window.setTimeout(() => { setNotice(''); noticeTimeoutRef.current = null; }, NOTICE_TIMEOUT_MS);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent size="xl" busy={saving} className="timesheet-shell">
      <DialogHeader className="timesheet-header"><div><span className="t-eyebrow">EMPLOYEE PAYROLL</span><DialogTitle>{employee.name}</DialogTitle><DialogDescription>{employee.employeeId || 'Employee'} · {money(rate)} regular / {money(overtimeRate)} overtime per hour</DialogDescription></div><DialogClose disabled={saving} className="timesheet-close" /></DialogHeader>
      <DialogBody className="timesheet-body">
      <div className="timesheet-period"><label>Month<input className="input" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label><span>{locked ? 'Payroll run exists · sheet locked' : 'Enter hours for each day worked'}</span></div>
      {error && <Alert className="timesheet-notice" variant="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}{notice && <Alert className="timesheet-notice" variant="success">{notice}</Alert>}
      <div className="timesheet-totals">{[['Hours this month',`${totalHours} hrs`],['Overtime',`${totalOvertimeHours} hrs · ${money(overtimePay)}`],['Absent days',String(totalAbsentDays)],['Gross earnings',money(gross)],['Advances paid',money(totalAdvances)],['Advance still owed',money(advanceOwed)],['Estimated take-home',money(takeHome)]].map(([label,value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      {loading ? <div className="timesheet-loading">Loading monthly sheet…</div> : <div className="timesheet-content">
        <section className="timesheet-section"><div className="timesheet-section-heading"><div><h3>Daily hours</h3><p>Enter regular and overtime hours separately. Mark days absent when the employee did not work. Overtime rate: {money(overtimeRate)} per hour.</p></div></div><div className="timesheet-days timesheet-days-overtime">{monthDates(period).map((date) => <div className={`timesheet-day-row${absentDays[date] ? ' is-absent' : ''}`} key={date}><span>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</span><input className="input" aria-label={`Regular hours worked on ${date}`} type="number" min="0" max="24" step="0.25" placeholder="Regular" value={hours[date] || ''} disabled={locked || absentDays[date]} onChange={(event) => setHours((items) => ({ ...items, [date]: event.target.value }))} /><input className="input" aria-label={`Overtime hours worked on ${date}`} type="number" min="0" max="24" step="0.25" placeholder="OT" value={overtimeHours[date] || ''} disabled={locked || absentDays[date]} onChange={(event) => setOvertimeHours((items) => ({ ...items, [date]: event.target.value }))} /><button type="button" className="btn timesheet-absence-toggle btn-secondary" aria-pressed={Boolean(absentDays[date])} disabled={locked} onClick={() => { const nextAbsent = !absentDays[date]; setAbsentDays((items) => ({ ...items, [date]: nextAbsent })); if (nextAbsent) { setHours((items) => ({ ...items, [date]: '' })); setOvertimeHours((items) => ({ ...items, [date]: '' })); } }}>{absentDays[date] ? 'Absent' : 'Mark absent'}</button><small>{absentDays[date] ? 'Absent' : money((Number(hours[date]) || 0) * rate + (Number(overtimeHours[date]) || 0) * overtimeRate)}</small></div>)}</div></section>
        <section className="timesheet-section"><div className="timesheet-section-heading"><div><h3>Pay advances</h3><p>Record each advance paid. The sheet shows any amount still owed after earned pay.</p></div><button type="button" className="btn btn-secondary" disabled={locked} onClick={addAdvance}>＋ Add advance</button></div>
          {!advances.length ? <p className="timesheet-empty">No advances recorded this month.</p> : <div className="timesheet-advance-list">{advances.map((advance) => <div className="timesheet-advance-row" key={advance.id}><label>Date<input className="input" type="date" value={advance.date} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, date: event.target.value } : item))} /></label><label>Amount<input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={advance.amount} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, amount: event.target.value } : item))} /></label><label>Note<input className="input" type="text" placeholder="Optional note" value={advance.note || ''} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, note: event.target.value } : item))} /></label><button className="btn btn-icon btn-ghost" type="button" aria-label="Remove advance" disabled={locked} onClick={() => setAdvances((items) => items.filter((item) => item.id !== advance.id))}>×</button></div>)}</div>}
        </section>
      </div>}
      </DialogBody>
      <DialogFooter className="timesheet-footer"><span>Advance balance carries into the next month.</span><div><button className="btn btn-secondary" type="button" onClick={onClose} disabled={saving}>Close</button><button type="button" className="btn btn-primary" aria-busy={saving || undefined} disabled={saving || loading || locked} onClick={save}>{locked ? 'Payroll already generated' : saving ? 'Saving…' : 'Save monthly sheet'}</button></div></DialogFooter>
    </DialogContent>
  </Dialog>;
}
