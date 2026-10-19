import { useEffect, useMemo, useState } from 'react';
import '../styles/EmployeeMonthlySheet.css';

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);
const monthDates = (period) => {
  const [year, month] = period.split('-').map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, index) => `${period}-${String(index + 1).padStart(2, '0')}`);
};
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function EmployeeMonthlySheet({ employee, onClose }) {
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [hours, setHours] = useState({}); const [advances, setAdvances] = useState([]);
  const [carryIn, setCarryIn] = useState(0); const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    fetch(`/api/payroll/employees/${employee.id}/sheet?period=${period}`)
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load this employee sheet.'); return data; })
      .then((data) => {
        if (cancelled) return;
        setHours(Object.fromEntries((data.dailyEntries || []).map((entry) => [entry.date, String(entry.hours)])));
        setAdvances(data.advances || []); setCarryIn(Number(data.advanceOwedBefore || 0)); setLocked(Boolean(data.locked));
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employee.id, period]);

  const totalHours = useMemo(() => Object.values(hours).reduce((total, value) => total + (Number(value) || 0), 0), [hours]);
  const totalAdvances = useMemo(() => advances.reduce((total, advance) => total + (Number(advance.amount) || 0), 0), [advances]);
  const rate = Number(employee.salary || employee.baseRate) || 0;
  const gross = Math.round(rate * totalHours * 100) / 100;
  const extras = ['allowances', 'bonus', 'commission'].reduce((sum, key) => sum + (Number(employee[key]) || 0), 0);
  const beforeAdvance = Math.max(0, gross + extras - (Number(employee.regularDeductions) || 0));
  const advanceOwed = Math.max(0, carryIn + totalAdvances - beforeAdvance);
  const takeHome = Math.max(0, beforeAdvance - carryIn - totalAdvances);

  function addAdvance() { const today = new Date().toISOString().slice(0, 10); const date = period === today.slice(0, 7) ? today : `${period}-01`; setAdvances((items) => [...items, { id: id(), date, amount: '', note: '' }]); }
  async function save() {
    setSaving(true); setError(''); setNotice('');
    const dailyEntries = Object.entries(hours).filter(([, value]) => Number(value) > 0).map(([date, value]) => ({ date, hours: Number(value) }));
    const cleanAdvances = advances.filter((advance) => Number(advance.amount) > 0).map((advance) => ({ ...advance, amount: Number(advance.amount) }));
    try {
      const response = await fetch(`/api/payroll/employees/${employee.id}/sheet?period=${period}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dailyEntries, advances: cleanAdvances })
      });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not save this sheet.');
      setCarryIn(Number(data.advanceOwedBefore || 0)); setAdvances(data.advances || []); setLocked(Boolean(data.locked)); setNotice('Monthly sheet saved.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  return <div className="timesheet-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="timesheet-sheet" role="dialog" aria-modal="true" aria-label={`${employee.name} monthly payroll sheet`}>
      <header className="timesheet-header"><div><span className="timesheet-eyebrow">EMPLOYEE PAYROLL</span><h2>{employee.name}</h2><p>{employee.employeeId || 'Employee'} · {money(rate)} per hour</p></div><button type="button" aria-label="Close monthly sheet" onClick={onClose}>×</button></header>
      <div className="timesheet-period"><label>Month<input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></label><span>{locked ? 'Payroll run exists · sheet locked' : 'Enter hours for each day worked'}</span></div>
      {error && <div className="timesheet-alert" role="alert">{error}</div>}{notice && <div className="timesheet-success" role="status">{notice}</div>}
      <div className="timesheet-totals">{[['Hours this month',`${totalHours} hrs`],['Gross earnings',money(gross)],['Advances paid',money(totalAdvances)],['Advance still owed',money(advanceOwed)],['Estimated take-home',money(takeHome)]].map(([label,value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      {loading ? <div className="timesheet-loading">Loading monthly sheet…</div> : <div className="timesheet-content">
        <section className="timesheet-section"><div className="timesheet-section-heading"><div><h3>Daily hours</h3><p>Leave days not worked blank. Enter fractions such as 7.5 if needed.</p></div></div><div className="timesheet-days">{monthDates(period).map((date) => <label key={date}><span>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</span><input aria-label={`Hours worked on ${date}`} type="number" min="0" max="24" step="0.25" placeholder="—" value={hours[date] || ''} disabled={locked} onChange={(event) => setHours((items) => ({ ...items, [date]: event.target.value }))} /><small>{money((Number(hours[date]) || 0) * rate)}</small></label>)}</div></section>
        <section className="timesheet-section"><div className="timesheet-section-heading"><div><h3>Pay advances</h3><p>Record each advance paid. The sheet shows any amount still owed after earned pay.</p></div><button type="button" className="timesheet-add" disabled={locked} onClick={addAdvance}>＋ Add advance</button></div>
          {!advances.length ? <p className="timesheet-empty">No advances recorded this month.</p> : <div className="timesheet-advance-list">{advances.map((advance) => <div className="timesheet-advance-row" key={advance.id}><label>Date<input type="date" value={advance.date} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, date: event.target.value } : item))} /></label><label>Amount<input type="number" min="0" step="0.01" placeholder="0.00" value={advance.amount} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, amount: event.target.value } : item))} /></label><label>Note<input type="text" placeholder="Optional note" value={advance.note || ''} disabled={locked} onChange={(event) => setAdvances((items) => items.map((item) => item.id === advance.id ? { ...item, note: event.target.value } : item))} /></label><button type="button" aria-label="Remove advance" disabled={locked} onClick={() => setAdvances((items) => items.filter((item) => item.id !== advance.id))}>×</button></div>)}</div>}
        </section>
      </div>}
      <footer className="timesheet-footer"><span>Advance balance carries into the next month.</span><div><button type="button" onClick={onClose}>Close</button><button type="button" className="timesheet-save" disabled={saving || loading || locked} onClick={save}>{locked ? 'Payroll already generated' : saving ? 'Saving…' : 'Save monthly sheet'}</button></div></footer>
    </section>
  </div>;
}
