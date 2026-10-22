import { useEffect, useRef, useState } from 'react';
import { Butterfly } from '../shared.jsx';
import '../styles/DashboardPage.css';

/* Tailwind version. Accent color comes from your existing --purple CSS variable.
   Everything else uses the default Tailwind palette (slate, emerald, etc.). */

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--purple)]';
const btnBase = `inline-flex h-[38px] items-center gap-2 rounded-[10px] border px-3.5 text-sm font-medium motion-safe:transition ${focusRing}`;
const btn = `${btnBase} border-slate-200 bg-white text-slate-800 hover:border-[color:var(--purple)]`;
const btnPrimary = `${btnBase} border-[color:var(--purple)] bg-[color:var(--purple)] text-white hover:brightness-95`;
const panel = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-[22px]';

const TONES = {
  income: 'bg-emerald-50 text-emerald-700',
  expenses: 'bg-orange-50 text-orange-700',
  bookings: 'bg-violet-100 text-violet-700',
  purchases: 'bg-blue-50 text-blue-700',
  neutral: 'bg-slate-100 text-slate-600',
};

const ICONS = {
  plus: 'M12 5v14M5 12h14',
  income: 'M7 17L17 7M9 7h8v8',
  expenses: 'M7 7l10 10M17 9v8H9',
  bookings: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  purchases: 'M4 8l8-4 8 4-8 4-8-4zM4 8v8l8 4 8-4V8M12 12v8',
  suppliers: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 5 17.5V19M10.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3 3 0 0 1 0 5.6',
  inventory: 'M4 6h16M4 12h16M4 18h10',
  chevron: 'M9 6l6 6-6 6',
};

function Glyph({ name, size = 18, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

function IconBadge({ name, tone }) {
  return <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${TONES[tone]}`}><Glyph name={name} /></span>;
}

const currency = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2
}).format(value);
const compactCurrency = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1
}).format(value);

const CHART_SERIES = [
  { key: 'income', label: 'Income', color: 'var(--purple,#6c5ce7)' },
  { key: 'expenses', label: 'Expenses', color: '#f97316' },
  { key: 'payrollPaid', label: 'Payroll paid', color: '#0ea5e9' },
  { key: 'materialCosts', label: 'Material costs', color: '#10b981' }
];

function readChartPreferences() {
  try {
    const saved = JSON.parse(window.localStorage.getItem('g4-sticker-chart-preferences') || '{}');
    return {
      series: Array.isArray(saved.series) ? saved.series.filter((key) => CHART_SERIES.some((item) => item.key === key)) : ['income', 'expenses'],
      type: saved.type === 'bar' ? 'bar' : 'line'
    };
  } catch { return { series: ['income', 'expenses'], type: 'line' }; }
}

export default function DashboardPage({ onNavigate, data, compact, loading = false, period, onPeriodChange, chartMonths = 6, onChartMonthsChange }) {
  const today = new Date();
  const hour = today.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const { totals, payroll, comparison } = data;
  const [chartPreferences, setChartPreferences] = useState(readChartPreferences);
  useEffect(() => {
    try { window.localStorage.setItem('g4-sticker-chart-preferences', JSON.stringify(chartPreferences)); }
    catch { /* Chart selection remains available for the current session. */ }
  }, [chartPreferences]);
  const currentPeriod = period || data.period;
  const periodLabel = new Date(`${currentPeriod}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const previousLabel = data.previousPeriod ? new Date(`${data.previousPeriod}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }) : 'previous month';

  return (
    <div className="dashboard-page grid gap-5 text-slate-800">
      {compact && <section className="dashboard-quick-actions" aria-label="Quick actions">
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
          <button className={`${btnPrimary} w-full justify-center`} onClick={() => onNavigate('income')}><Glyph name="plus" size={16} />Record income</button>
          <button className={`${btn} w-full justify-center`} onClick={() => onNavigate('bookings')}><Glyph name="bookings" size={16} />New booking</button>
          <button className={`${btn} w-full justify-center`} onClick={() => onNavigate('products')}><Glyph name="purchases" size={16} />Add product</button>
          <button className={`${btn} w-full justify-center`} onClick={() => onNavigate('suppliers')}><Glyph name="suppliers" size={16} />Add supplier</button>
        </div>
      </section>}
      {!compact && <header className="rounded-2xl border border-violet-100 bg-gradient-to-br from-white via-white to-violet-50 p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="mb-2 inline-flex rounded-full border border-violet-100 bg-white/80 px-3 py-1 text-xs font-semibold tracking-wide text-violet-700 shadow-sm">{compact || dateLabel}</p>
          <h1 className="font-[family-name:Manrope,sans-serif] m-0 flex items-center gap-2.5 dashboard-title font-semibold leading-tight tracking-tight text-slate-900">
            {compact ? `Your ${compact.toLowerCase()}, at a glance` : <>Good {timeOfDay} <Butterfly className="ml-1 -mb-1 h-[26px] w-[31px] drop-shadow-[0_3px_3px_rgba(119,115,223,0.15)] max-sm:h-[22px] max-sm:w-[25px]" /></>}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
            {compact ? 'Everything moving your business forward, in one view.' : 'Here’s where your business stands today.'}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:gap-2.5 xl:w-auto xl:min-w-[360px]">
          <button className={`${btnPrimary} w-full justify-center`} onClick={() => onNavigate('income')}><Glyph name="plus" size={16} />Record income</button>
          <button className={`${btn} w-full justify-center`} onClick={() => onNavigate('bookings')}><Glyph name="bookings" size={16} />New booking</button>
          <button className={`${btn} w-full justify-center`} onClick={() => onNavigate('products')}><Glyph name="purchases" size={16} />Add product</button>
          <button className={`${btn} w-full justify-center`} onClick={() => onNavigate('suppliers')}><Glyph name="suppliers" size={16} />Add supplier</button>
        </div>
        </div>
      </header>}

      <div className="grid items-start gap-4 lg:grid-cols-1">
        <section className={panel} aria-label="Financial summary">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="font-[family-name:Manrope,sans-serif] m-0 text-base font-semibold">Financial overview</h2><p className="mt-1 text-sm text-slate-500">Recorded activity for {periodLabel}</p></div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">Month<input className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" type="month" value={currentPeriod} onChange={(event) => onPeriodChange?.(event.target.value)} /></label>
          </div>
          {loading ? <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading financial summary">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-[88px] animate-pulse rounded-xl bg-slate-100" />)}</div> : <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Income recorded" value={currency(totals.income)} detail={`${totals.incomeEntries} entries`} onClick={() => onNavigate('income')} />
              <MetricCard label="Expenses recorded" value={currency(totals.expenses)} detail={`${totals.expenseEntries} entries · payroll listed separately`} onClick={() => onNavigate('expenses')} />
              <MetricCard label="Payroll paid this month" value={currency(totals.payrollPaid)} detail="From dated pay-run payment records" onClick={() => onNavigate('payroll-runs')} />
              <MetricCard label="Job material costs" value={currency(totals.materialCosts)} detail="Completed jobs · average cost" onClick={() => onNavigate('bookings')} />
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 p-3.5">
              <div className="mb-2 flex items-center justify-between"><h3 className="m-0 text-sm font-semibold text-slate-800">Expense categories</h3><button className={`text-xs font-semibold text-[color:var(--purple)] hover:underline ${focusRing}`} onClick={() => onNavigate('expenses')}>View expenses</button></div>
              {Object.keys(totals.expenseCategories || {}).length ? <div className="grid gap-2">{Object.entries(totals.expenseCategories).sort((a, b) => b[1] - a[1]).map(([category, amount]) => {
                const maxCategory = Math.max(...Object.values(totals.expenseCategories));
                const percent = maxCategory > 0 ? Math.max(4, Number(amount) / maxCategory * 100) : 0;
                return <div key={category} className="grid grid-cols-[minmax(95px,.7fr)_minmax(70px,1.5fr)_auto] items-center gap-3 text-xs"><span className="truncate text-slate-600">{category}</span><span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-[color:var(--purple)]" style={{ width: `${percent}%` }} /></span><strong className="tabular-nums text-slate-700">{currency(amount)}</strong></div>;
              })}</div> : <p className="mb-0 mt-1 text-xs text-slate-500">No non-payroll expenses recorded for this month.</p>}
            </div>
            <p className="mb-0 mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">Profit and customer balances aren’t reported because invoice allocations aren’t tracked and expenses may overlap material costs. Supplier payment due dates aren’t recorded.</p>
          </>}

          <div className="dashboard-chart-toolbar mt-5">
            <div className="dashboard-chart-series" aria-label="Choose chart data">{CHART_SERIES.map((item) => <label key={item.key} className="dashboard-chart-toggle"><input type="checkbox" checked={chartPreferences.series.includes(item.key)} onChange={() => setChartPreferences((previous) => ({ ...previous, series: previous.series.includes(item.key) ? previous.series.filter((key) => key !== item.key) : [...previous.series, item.key] }))} /><i style={{ '--series-color': item.color }} />{item.label}</label>)}</div>
            <div className="dashboard-chart-options">
              <label>Window<select value={chartMonths} onChange={(event) => onChartMonthsChange?.(Number(event.target.value))}><option value={3}>3 months</option><option value={6}>6 months</option><option value={12}>12 months</option></select></label>
              <div className="dashboard-chart-type" role="group" aria-label="Chart type"><button type="button" aria-pressed={chartPreferences.type === 'line'} onClick={() => setChartPreferences((previous) => ({ ...previous, type: 'line' }))}>Line</button><button type="button" aria-pressed={chartPreferences.type === 'bar'} onClick={() => setChartPreferences((previous) => ({ ...previous, type: 'bar' }))}>Bar</button></div>
            </div>
          </div>
          <p className="dashboard-chart-caption">Monthly totals through {periodLabel}. Toggle series, choose a window, and hover a month for exact amounts.</p>
          {loading ? <div className="h-64 animate-pulse rounded-xl bg-slate-50" /> : <RevenueChart months={data.months} selectedSeries={chartPreferences.series} chartType={chartPreferences.type} />}
          {!loading && <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-xs">
              <caption className="sr-only">Selected and previous month financial comparison</caption>
              <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 pr-3 font-medium">Period</th><th className="py-2 pr-3 font-medium">Income</th><th className="py-2 pr-3 font-medium">Other expenses</th><th className="py-2 pr-3 font-medium">Payroll paid</th><th className="py-2 font-medium">Material costs</th></tr></thead>
              <tbody>{[[periodLabel, comparison.current], [previousLabel, comparison.previous]].map(([label, row]) => <tr key={label} className="border-b border-slate-100 last:border-0"><th className="py-2 pr-3 font-medium text-slate-700">{label}</th><td className="py-2 pr-3 tabular-nums">{currency(row.income)}</td><td className="py-2 pr-3 tabular-nums">{currency(row.expenses)}</td><td className="py-2 pr-3 tabular-nums">{currency(row.payrollPaid)}</td><td className="py-2 tabular-nums">{currency(row.materialCosts)}</td></tr>)}</tbody>
            </table>
          </div>}
        </section>

        <section className={panel} aria-label="Business operations charts">
          <div className="mb-4"><h2 className="font-[family-name:Manrope,sans-serif] m-0 text-base font-semibold">Business pulse</h2><p className="mt-1 text-sm text-slate-500">Bookings, material levels, and purchasing at a glance.</p></div>
          {loading ? <div className="h-28 animate-pulse rounded-xl bg-slate-100" aria-label="Loading operations charts" /> : <div className="grid gap-4 md:grid-cols-3">
            <MiniBarChart title="Bookings" items={[{ label: 'Active', value: data.operationCharts?.bookings?.active || 0, color: 'bg-[color:var(--purple)]' }, { label: 'Completed', value: data.operationCharts?.bookings?.completed || 0, color: 'bg-emerald-500' }]} onClick={() => onNavigate('bookings')} />
            <MiniBarChart title="Material stock" items={[{ label: 'Healthy', value: data.operationCharts?.materials?.healthy || 0, color: 'bg-emerald-500' }, { label: 'Low', value: data.operationCharts?.materials?.low || 0, color: 'bg-amber-500' }, { label: 'Out', value: data.operationCharts?.materials?.out || 0, color: 'bg-rose-500' }]} onClick={() => onNavigate('materials')} />
            <MiniBarChart title="Purchasing" items={[{ label: 'Awaiting receipt', value: data.operationCharts?.purchasing?.awaitingReceipt || 0, color: 'bg-sky-500' }, { label: 'Balance due', value: data.operationCharts?.purchasing?.balanceDue || 0, color: 'bg-amber-500' }]} onClick={() => onNavigate('purchases')} />
          </div>}
        </section>
      </div>

      <section className={panel} aria-label="Attention needed">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-[family-name:Manrope,sans-serif] m-0 text-base font-semibold">Needs attention</h2><p className="mt-1 text-sm text-slate-500">Counts by area · select a group to review the records.</p></div><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{data.attention?.length || 0} open items</span></div>
        {loading ? <div className="mt-4 h-16 animate-pulse rounded-xl bg-slate-100" aria-label="Loading action counts" /> : <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{[
          { kind: 'booking', title: 'Bookings', sub: 'dates & material plans', target: 'bookings' },
          { kind: 'purchase', title: 'Purchasing', sub: 'receipts & balances', target: 'purchases' },
          { kind: 'inventory', title: 'Inventory', sub: 'low or out of stock', target: 'materials' },
          { kind: 'payroll', title: 'Payroll', sub: 'drafts & unpaid runs', target: 'payroll-runs' }
        ].map((group) => { const records = (data.attention || []).filter((item) => item.kind === group.kind); const count = records.length; const popoverId = `attention-${group.kind}-details`; return <div className="dashboard-attention-card" key={group.kind}><button type="button" aria-describedby={popoverId} className={`w-full rounded-xl border border-slate-200 px-3 py-3 text-left hover:border-[color:var(--purple)] hover:bg-violet-50/40 ${focusRing}`} onClick={() => onNavigate(group.target)}><span className="flex items-baseline justify-between gap-2"><strong className="text-sm font-semibold text-slate-700">{group.title}</strong><span className="font-[family-name:Manrope,sans-serif] text-xl font-bold tabular-nums text-[color:var(--purple)]">{count}</span></span><small className="mt-1 block truncate text-xs text-slate-500">{group.sub} · hover for details</small></button><span className="dashboard-attention-popover" id={popoverId} role="tooltip"><strong>{group.title} · {count} {count === 1 ? 'item' : 'items'}</strong>{count ? <span className="dashboard-attention-popover-list">{records.slice(0, 5).map((item) => <span key={item.key}><b>{item.label}</b><small>{item.detail}</small></span>)}{count > 5 && <small>+ {count - 5} more · open the page to review</small>}</span> : <small>No open items.</small>}</span></div>; })}</div>}
        {!loading && <p className="mb-0 mt-3 text-xs text-slate-500">Customer balances can’t be calculated without invoice allocations. Supplier balances have no due dates in purchase records.</p>}
      </section>

      <section className={panel} aria-label="Payroll overview">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-[family-name:Manrope,sans-serif] m-0 text-base font-semibold">Payroll overview · {periodLabel}</h2><p className="mt-1 text-sm text-slate-500">Saved pay runs for this period. Drafts are excluded from paid expense totals.</p></div><button className={`text-sm font-semibold text-[color:var(--purple)] hover:underline ${focusRing}`} onClick={() => onNavigate('payroll-runs')}>Open pay runs →</button></div>
        {loading ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-slate-100" /> : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <PayrollMetric label="Employees in pay runs" value={payroll.employeeCount} detail={`${payroll.runCount} saved runs`} />
          <PayrollMetric label="Run status" value={`${payroll.draftCount + payroll.finalizedCount + payroll.partiallyPaidCount} open`} detail={`${payroll.draftCount} draft · ${payroll.finalizedCount} finalized · ${payroll.partiallyPaidCount} part-paid`} />
          <PayrollMetric label="Gross payroll" value={currency(payroll.gross)} detail={`${currency(payroll.overtime)} overtime`} />
          <PayrollMetric label="Deductions" value={currency(payroll.deductions)} detail="From saved pay runs" />
          <PayrollMetric label="Net payroll" value={currency(payroll.net)} detail="For selected pay period" />
          <PayrollMetric label="Paid" value={currency(payroll.paid)} detail={`${payroll.paidCount} fully paid runs`} />
          <PayrollMetric label="Finalized balance due" value={currency(payroll.outstandingFinalized)} detail="Finalized or partly paid" />
        </div>}
      </section>

      <section className={panel} aria-label="Recent transactions">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:Manrope,sans-serif] m-0 text-base font-semibold">Recent transactions</h2>
            <p className="mt-1 text-sm text-slate-500">Your latest income, expenses, bookings and purchases.</p>
          </div>
        </div>

        {data.recent.length ? (
          <div className="mt-4">
            <div className={`${txGrid} pb-2 text-xs text-slate-500`} aria-hidden="true">
              <span /><span>Name</span><span className="hidden sm:block">Type</span><span className="hidden sm:block">Date</span><span className="text-right">Amount</span>
            </div>
            {data.recent.map((t) => {
              const sign = t.type === 'income' ? '+' : t.type === 'expenses' ? '−' : '';
              const label = t.type.charAt(0).toUpperCase() + t.type.slice(1);
              const tone = TONES[t.type] ? t.type : 'income';
              return (
                <button type="button" className={`${txGrid} w-full border-t border-slate-100 py-3 text-left text-sm hover:bg-slate-50 ${focusRing}`} key={t.id} onClick={() => onNavigate(t.type === 'purchases' ? 'purchases' : t.type)} aria-label={`Open ${label.toLowerCase()} records`}>
                  <IconBadge name={tone} tone={tone} />
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="hidden text-slate-500 sm:block">{label}</span>
                  <span className="hidden text-slate-500 sm:block">
                    {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className={`text-right font-semibold tabular-nums ${t.type === 'income' ? 'text-emerald-700' : ''}`}>{sign}{currency(t.amount)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="pt-6 text-sm text-slate-500">
            No transactions yet. Record your first sale and it will show up here.
            <div className="mt-3"><button className={btnPrimary} onClick={() => onNavigate('income')}><Glyph name="plus" size={16} />Record income</button></div>
          </div>
        )}
      </section>
    </div>
  );
}

const txGrid = 'grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3.5 sm:grid-cols-[36px_minmax(0,1fr)_110px_120px_110px]';

function Figure({ label, value, note }) {
  return (
    <div>
      <span className="block text-sm text-slate-500">{label}</span>
      <strong className="font-[family-name:Manrope,sans-serif] mt-1 block text-xl font-semibold tabular-nums">{value}</strong>
      <small className="mt-0.5 block text-xs text-slate-500">{note}</small>
    </div>
  );
}

function MetricCard({ label, value, detail, onClick }) {
  return <button type="button" onClick={onClick} className={`min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 text-left hover:border-[color:var(--purple)] hover:bg-violet-50/40 ${focusRing}`}>
    <span className="block text-xs font-medium text-slate-500">{label}</span>
    <strong className="mt-1 block truncate font-[family-name:Manrope,sans-serif] text-lg font-semibold tabular-nums text-slate-900">{value}</strong>
    <small className="mt-1 block truncate text-[11px] text-slate-500">{detail}</small>
  </button>;
}

function PayrollMetric({ label, value, detail }) {
  return <article className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
    <span className="block text-xs font-medium text-slate-500">{label}</span>
    <strong className="mt-1 block truncate font-[family-name:Manrope,sans-serif] text-lg font-semibold tabular-nums text-slate-900">{value}</strong>
    <small className="mt-1 block truncate text-[11px] text-slate-500">{detail}</small>
  </article>;
}

function CountRow({ icon, tone, label, value, onClick }) {
  return (
    <button
      className={`grid w-full grid-cols-[36px_1fr_auto_16px] items-center gap-3 rounded-[10px] border-t border-slate-100 px-2 py-3 text-left first:border-t-0 hover:bg-slate-50 motion-safe:transition-colors ${focusRing}`}
      onClick={onClick}
    >
      <IconBadge name={icon} tone={tone} />
      <span>{label}</span>
      <strong className="text-lg font-semibold tabular-nums">{Number(value || 0).toLocaleString()}</strong>
      <Glyph name="chevron" size={16} className="text-slate-400" />
    </button>
  );
}

function MiniBarChart({ title, items, onClick }) {
  const max = Math.max(1, ...items.map((item) => Number(item.value) || 0));
  return <button type="button" className={`rounded-xl border border-slate-200 p-3.5 text-left hover:border-[color:var(--purple)] hover:bg-violet-50/30 ${focusRing}`} onClick={onClick} aria-label={`Open ${title.toLowerCase()} records`}>
    <h3 className="m-0 text-sm font-semibold text-slate-800">{title}</h3>
    <div className="mt-3 grid gap-3">{items.map((item) => <div key={item.label}>
      <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate text-slate-500">{item.label}</span><strong className="tabular-nums text-slate-700">{item.value}</strong></div>
      <span className="block h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={item.label} aria-valuemin="0" aria-valuemax={max} aria-valuenow={item.value}><span className={`block h-full rounded-full ${item.color}`} style={{ width: `${Math.max(0, Number(item.value) / max * 100)}%` }} /></span>
    </div>)}</div>
  </button>;
}

/* Responsive chart with selectable financial series and exact month readouts. */
function RevenueChart({ months, selectedSeries, chartType }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = months.length;
  const H = 300;
  const pad = { l: 66, r: 16, t: 18, b: 34 };
  const iw = width - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const activeSeries = CHART_SERIES.filter((item) => selectedSeries.includes(item.key));
  const rawMax = Math.max(0, ...months.flatMap((month) => activeSeries.map((item) => Number(month[item.key]) || 0)));

  if (!n || !activeSeries.length) {
    return <div ref={wrapRef} className="dashboard-chart-empty">{n ? 'Select at least one data series to display.' : 'No financial data is available for this window.'}</div>;
  }

  const base = 10 ** Math.floor(Math.log10((rawMax || 1) / 4));
  const axisMax = rawMax || 1;
  const step = [1, 2, 2.5, 5, 10].map((f) => f * base).find((s) => s * 4 >= axisMax);
  const tickCount = Math.ceil(axisMax / step);
  const max = step * tickCount;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => step * i);

  const x = (i) => pad.l + (n < 2 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const smooth = (key) => months.map((month, i) => {
    const px = x(i), py = y(Number(month[key]) || 0);
    if (i === 0) return `M${px},${py}`;
    const cx = (x(i - 1) + px) / 2;
    return `C${cx},${y(Number(months[i - 1][key]) || 0)} ${cx},${py} ${px},${py}`;
  }).join(' ');
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = n < 2 ? 0 : Math.round(((e.clientX - rect.left - pad.l) / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, idx)));
  };
  const active = hover === null ? n - 1 : hover;
  const m = months[active];
  const barWidth = Math.min(25, (iw / n * 0.76) / activeSeries.length);

  return (
    <div className="relative" ref={wrapRef}>
      <svg className="block w-full touch-pan-y" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img"
        aria-label={`${chartType === 'bar' ? 'Bar' : 'Line'} chart comparing ${activeSeries.map((item) => item.label).join(', ')} over ${n} months`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="stroke-slate-100" />
            <text x={pad.l - 10} y={y(t) + 4} textAnchor="end" className="fill-slate-500 text-xs tabular-nums">{compactCurrency(t)}</text>
          </g>
        ))}
        {hover !== null && <line x1={x(active)} x2={x(active)} y1={pad.t} y2={y(0)} className="stroke-slate-300" />}
        {activeSeries.map((series, seriesIndex) => chartType === 'bar'
          ? months.map((month, index) => <rect key={`${series.key}-${month.key}`} x={x(index) - (activeSeries.length * barWidth) / 2 + seriesIndex * barWidth} y={y(Number(month[series.key]) || 0)} width={Math.max(2, barWidth - 2)} height={Math.max(0, y(0) - y(Number(month[series.key]) || 0))} rx="3" fill={series.color} opacity={index === active ? 1 : 0.78} />)
          : <g key={series.key}><path d={smooth(series.key)} fill="none" stroke={series.color} strokeWidth={series.key === 'income' ? 3 : 2.5} strokeLinecap="round" strokeLinejoin="round" />{months.map((month, index) => <circle key={month.key} cx={x(index)} cy={y(Number(month[series.key]) || 0)} r={index === active ? 4.5 : 2.8} fill="var(--surface,#fff)" stroke={series.color} strokeWidth="2" />)}</g>)}
        {months.map((mo, i) => (
          <text key={mo.key} x={x(i)} y={H - 8} textAnchor="middle"
            className={`text-xs ${i === active ? 'fill-slate-800 font-semibold' : 'fill-slate-500'}`}>{mo.label}</text>
        ))}
      </svg>
      <table className="sr-only"><caption>Exact selected financial amounts for each month in the chart</caption><thead><tr><th>Month</th>{activeSeries.map((item) => <th key={item.key}>{item.label}</th>)}</tr></thead><tbody>{months.map((month) => <tr key={month.key}><th>{month.key}</th>{activeSeries.map((item) => <td key={item.key}>{currency(month[item.key] || 0)}</td>)}</tr>)}</tbody></table>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-slate-800 px-3 py-2 text-xs leading-relaxed text-white"
          style={{ left: Math.min(width - 70, Math.max(70, x(active))) }}>
          <b className="mb-0.5 block font-semibold">{m.key}</b>
          {activeSeries.map((item) => <span key={item.key} className="flex items-center justify-between gap-4"><span>{item.label}</span><strong>{currency(m[item.key] || 0)}</strong></span>)}
        </div>
      )}
    </div>
  );
}
