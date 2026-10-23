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
  settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.08-.02a1.7 1.7 0 0 0-1.75.62l-.05.07h-3.4l-.03-.08a1.7 1.7 0 0 0-1.43-1.16l-.09-.01-1.7-2.94.06-.06A1.7 1.7 0 0 0 9.8 14.5l-.08-.02v-3.4l.08-.03a1.7 1.7 0 0 0 1.16-1.43l.01-.09 2.94-1.7.06.06a1.7 1.7 0 0 0 1.88.34l.08-.03 2.94 1.7-.02.08a1.7 1.7 0 0 0 .62 1.75l.07.05v3.4l-.08.03a1.7 1.7 0 0 0-1.16 1.43z',
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
  const { totals, payroll, comparison } = data;
  const [chartPreferences, setChartPreferences] = useState(readChartPreferences);
  useEffect(() => {
    try { window.localStorage.setItem('g4-sticker-chart-preferences', JSON.stringify(chartPreferences)); }
    catch { /* Chart selection remains available for the current session. */ }
  }, [chartPreferences]);
  const currentPeriod = period || data.period;
  const periodLabel = new Date(`${currentPeriod}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const previousLabel = data.previousPeriod ? new Date(`${data.previousPeriod}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }) : 'previous month';

  const deltaFor = (current, previous) => previous ? ((current - previous) / Math.abs(previous)) * 100 : null;
  const stats = [
    { label: 'Income recorded', value: currency(totals.income), count: `${totals.incomeEntries} entries`, current: comparison.current.income, previous: comparison.previous.income, target: 'income' },
    { label: 'Expenses recorded', value: currency(totals.expenses), count: `${totals.expenseEntries} entries`, current: comparison.current.expenses, previous: comparison.previous.expenses, target: 'expenses' },
    { label: 'Payroll paid', value: currency(totals.payrollPaid), count: 'From dated pay-run payments', current: comparison.current.payrollPaid, previous: comparison.previous.payrollPaid, target: 'payroll-runs' },
    { label: 'Job material costs', value: currency(totals.materialCosts), count: 'Completed jobs', current: comparison.current.materialCosts, previous: comparison.previous.materialCosts, target: 'bookings' }
  ];
  const attentionGroups = [
    { kind: 'booking', title: 'Bookings', target: 'bookings' },
    { kind: 'purchase', title: 'Purchasing', target: 'purchases' },
    { kind: 'inventory', title: 'Inventory', target: 'materials' },
    { kind: 'payroll', title: 'Payroll', target: 'payroll-runs' }
  ];
  const recent = data.recent || [];
  const attention = data.attention || [];
  const heading = compact || 'Business overview';

  return (
    <div className="dashboard-page dashboard-v2">
      <div className="dashboard-toolbar">
        <div><h1>{heading}</h1><p>Recorded activity for {periodLabel}</p></div>
        <div className="dashboard-toolbar-actions">
          <label className="dashboard-period-control">Month<input type="month" value={currentPeriod} onChange={(event) => onPeriodChange?.(event.target.value)} /></label>
          <button className={btnPrimary} onClick={() => onNavigate('income')}><Glyph name="plus" size={16} />Record income</button>
        </div>
      </div>

      <section className="dashboard-v2-stats" aria-label="Financial summary">
        {stats.map((stat) => {
          const delta = deltaFor(stat.current, stat.previous);
          return <button type="button" className="dashboard-v2-stat" key={stat.label} onClick={() => onNavigate(stat.target)}>
            <span>{stat.label}</span><strong>{loading ? '—' : stat.value}</strong>
            <small>{loading ? 'Loading…' : delta === null ? stat.count : <><b className={delta < 0 ? 'negative' : 'positive'}>{delta > 0 ? '↑' : delta < 0 ? '↓' : '→'} {Math.abs(delta).toFixed(1)}%</b> vs previous month</>}</small>
          </button>;
        })}
      </section>

      <div className="dashboard-v2-charts">
        <section className="dashboard-v2-card dashboard-v2-finance" aria-label="Financial trends">
          <div className="dashboard-v2-card-heading"><div><h2>Financial trends</h2><p>Monthly totals through {periodLabel}</p></div>
            <div className="dashboard-chart-options"><label>Window<select value={chartMonths} onChange={(event) => onChartMonthsChange?.(Number(event.target.value))}><option value={3}>3 mo</option><option value={6}>6 mo</option><option value={12}>12 mo</option></select></label><div className="dashboard-chart-type" role="group" aria-label="Chart type"><button type="button" aria-pressed={chartPreferences.type === 'line'} onClick={() => setChartPreferences((previous) => ({ ...previous, type: 'line' }))}>Line</button><button type="button" aria-pressed={chartPreferences.type === 'bar'} onClick={() => setChartPreferences((previous) => ({ ...previous, type: 'bar' }))}>Bar</button></div></div>
          </div>
          <div className="dashboard-chart-series" aria-label="Choose chart data">{CHART_SERIES.map((item) => <label key={item.key} className="dashboard-chart-toggle"><input type="checkbox" checked={chartPreferences.series.includes(item.key)} onChange={() => setChartPreferences((previous) => ({ ...previous, series: previous.series.includes(item.key) ? previous.series.filter((key) => key !== item.key) : [...previous.series, item.key] }))} /><i style={{ '--series-color': item.color }} />{item.label}</label>)}</div>
          {loading ? <div className="h-56 animate-pulse rounded-xl bg-[var(--surface-soft)]" /> : <RevenueChart months={data.months || []} selectedSeries={chartPreferences.series} chartType={chartPreferences.type} />}
        </section>
        <section className="dashboard-v2-card dashboard-v2-operations" aria-label="Business operations">
          <div className="dashboard-v2-card-heading"><div><h2>Business pulse</h2><p>Bookings, stock, and purchasing</p></div></div>
          {loading ? <div className="h-56 animate-pulse rounded-xl bg-[var(--surface-soft)]" /> : <div className="dashboard-pulse-list">
            <MiniBarChart title="Bookings" items={[{ label: 'Active', value: data.operationCharts?.bookings?.active || 0, color: 'bg-[color:var(--purple)]' }, { label: 'Completed', value: data.operationCharts?.bookings?.completed || 0, color: 'bg-emerald-500' }]} onClick={() => onNavigate('bookings')} />
            <MiniBarChart title="Material stock" items={[{ label: 'Healthy', value: data.operationCharts?.materials?.healthy || 0, color: 'bg-emerald-500' }, { label: 'Low', value: data.operationCharts?.materials?.low || 0, color: 'bg-amber-500' }, { label: 'Out', value: data.operationCharts?.materials?.out || 0, color: 'bg-rose-500' }]} onClick={() => onNavigate('materials')} />
            <MiniBarChart title="Purchasing" items={[{ label: 'Awaiting receipt', value: data.operationCharts?.purchasing?.awaitingReceipt || 0, color: 'bg-sky-500' }, { label: 'Balance due', value: data.operationCharts?.purchasing?.balanceDue || 0, color: 'bg-amber-500' }]} onClick={() => onNavigate('purchases')} />
          </div>}
          {!loading && <p className="dashboard-v2-note">{data.financialLimits?.profitReliable ? '' : 'Profit and customer balances aren’t shown because invoice allocations aren’t tracked.'}</p>}
        </section>
      </div>

      <div className="dashboard-v2-bottom">
        <section className="dashboard-v2-card dashboard-v2-transactions" aria-label="Recent transactions">
          <div className="dashboard-v2-card-heading"><div><h2>Recent transactions</h2><p>Latest income, expenses, bookings, and purchases.</p></div></div>
          {recent.length ? <div className="dashboard-v2-transaction-list">{recent.slice(0, 5).map((item) => {
            const label = item.type.charAt(0).toUpperCase() + item.type.slice(1);
            const sign = item.type === 'income' ? '+' : item.type === 'expenses' ? '−' : '';
            return <button type="button" className="dashboard-v2-transaction" key={item.id} onClick={() => onNavigate(item.type === 'purchases' ? 'purchases' : item.type)}>
              <IconBadge name={TONES[item.type] ? item.type : 'bookings'} tone={TONES[item.type] ? item.type : 'bookings'} />
              <span className="dashboard-v2-transaction-name"><strong>{item.name}</strong><small>{label} · {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></span>
              <b>{sign}{currency(item.amount)}</b>
            </button>;
          })}</div> : <div className="dashboard-v2-empty">No transactions yet.</div>}
          {!loading && <div className="dashboard-v2-table-summary"><span>Expense mix</span>{Object.keys(totals.expenseCategories || {}).length ? Object.entries(totals.expenseCategories).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([category, amount]) => <b key={category}>{category} · {currency(amount)}</b>) : <span>No expenses recorded</span>}</div>}
        </section>

        <section className="dashboard-v2-card dashboard-v2-health" aria-label="Business health">
          <div className="dashboard-v2-card-heading"><div><h2>Business health</h2><p>{attention.length ? `${attention.length} items need your attention.` : 'Nothing urgent needs your attention.'}</p></div></div>
          {loading ? <div className="dashboard-v2-health-empty">Loading…</div> : <>
            <div className="dashboard-v2-health-total"><span className={attention.length ? 'dashboard-v2-alert' : 'dashboard-v2-ok'}>{attention.length || '✓'}</span><strong>{attention.length ? 'Open items' : 'You’re caught up.'}</strong><small>{attention.length ? 'Review the open items by area.' : 'Bookings, stock, and pay runs look clear.'}</small></div>
            <div className="dashboard-v2-health-groups">{attentionGroups.map((group) => <button type="button" key={group.kind} onClick={() => onNavigate(group.target)}><span>{group.title}</span><b>{attention.filter((item) => item.kind === group.kind).length}</b></button>)}</div>
          </>}
        </section>

        <section className="dashboard-v2-card dashboard-v2-activity" aria-label="Recent activity">
          <div className="dashboard-v2-card-heading"><div><h2>Activity</h2><p>Latest updates in your workspace.</p></div></div>
          {recent.length ? <div className="dashboard-v2-activity-list">{recent.slice(0, 4).map((item) => <button type="button" key={item.id} onClick={() => onNavigate(item.type === 'purchases' ? 'purchases' : item.type)}><span className="dashboard-v2-activity-icon"><Glyph name={TONES[item.type] ? item.type : 'bookings'} size={17} /></span><span><strong>{item.name}</strong><small>{item.type.charAt(0).toUpperCase() + item.type.slice(1)} · {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small></span></button>)}</div> : <div className="dashboard-v2-empty">New activity will appear here.</div>}
        </section>
      </div>

      <div className="dashboard-v2-payroll-row">
        <section className="dashboard-v2-card dashboard-v2-payroll" aria-label="Payroll overview">
          <div className="dashboard-v2-card-heading"><div><h2>Payroll overview · {periodLabel}</h2><p>Saved pay runs for this period. Drafts are excluded from paid expense totals.</p></div><button className="dashboard-v2-link" onClick={() => onNavigate('payroll-runs')}>Review payroll →</button></div>
          <div className="dashboard-v2-payroll-grid"><PayrollMetric label="Employees in pay runs" value={payroll.employeeCount} detail={`${payroll.runCount} saved runs`} /><PayrollMetric label="Run status" value={`${payroll.draftCount + payroll.finalizedCount + payroll.partiallyPaidCount} open`} detail={`${payroll.draftCount} draft · ${payroll.finalizedCount} finalized · ${payroll.partiallyPaidCount} part-paid`} /><PayrollMetric label="Gross payroll" value={currency(payroll.gross)} detail={`${currency(payroll.overtime)} overtime`} /><PayrollMetric label="Deductions" value={currency(payroll.deductions)} detail="From saved pay runs" /><PayrollMetric label="Net payroll" value={currency(payroll.net)} detail="For selected pay period" /><PayrollMetric label="Paid" value={currency(payroll.paid)} detail={`${payroll.paidCount} fully paid runs`} /><PayrollMetric label="Finalized balance due" value={currency(payroll.outstandingFinalized)} detail="Finalized or partly paid" /></div>
        </section>
        <section className="dashboard-v2-card dashboard-v2-quick-actions" aria-label="Quick actions">
          <div className="dashboard-v2-card-heading"><div><h2>Quick actions</h2><p>Shortcuts to common tasks.</p></div></div>
          <div className="dashboard-v2-action-list">
            {[
              { icon: 'plus', title: 'Add product', description: 'Create a new product.', target: 'products' },
              { icon: 'bookings', title: 'Review bookings', description: 'Plan and complete jobs.', target: 'bookings' },
              { icon: 'purchases', title: 'Review purchases', description: 'Check orders and receipts.', target: 'purchases' },
              { icon: 'settings', title: 'Store settings', description: 'Manage appearance settings.', target: 'settings' }
            ].map((action) => <button type="button" className="dashboard-v2-action" key={action.title} onClick={() => onNavigate(action.target)}>
              <Glyph name={action.icon} size={16} /><span><strong>{action.title}</strong><small>{action.description}</small></span><Glyph name="chevron" size={15} />
            </button>)}
          </div>
        </section>
      </div>
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
