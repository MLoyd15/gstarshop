import { useEffect, useId, useRef, useState } from 'react';
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
  style: 'currency', currency: 'PHP', maximumFractionDigits: 0
}).format(value);
const compactCurrency = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1
}).format(value);

export default function DashboardPage({ onNavigate, data, compact, name = 'Jamie' }) {
  const today = new Date();
  const hour = today.getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const { totals } = data;
  const profit = totals.income - totals.expenses;
  const margin = totals.income > 0 ? Math.round((profit / totals.income) * 100) : null;

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
            {compact ? `Your ${compact.toLowerCase()}, at a glance` : <>Good {timeOfDay}, {name} <Butterfly className="ml-1 -mb-1 h-[26px] w-[31px] drop-shadow-[0_3px_3px_rgba(119,115,223,0.15)] max-sm:h-[22px] max-sm:w-[25px]" /></>}
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

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <section className={panel} aria-label="Financial summary">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-5">
            <div>
              <div className="text-sm text-slate-500">Net profit, all time</div>
              <div className={`font-[family-name:Manrope,sans-serif] mt-1 profit-amount font-semibold leading-none tracking-tight tabular-nums ${profit < 0 ? 'text-red-700' : ''}`}>
                {profit < 0 ? '−' : ''}{currency(Math.abs(profit))}
              </div>
              {margin !== null && <div className="mt-1.5 text-sm text-slate-500">{margin}% of revenue is kept as profit</div>}
            </div>
            <div className="flex gap-8 lg:ml-auto">
              <Figure label="Revenue" value={currency(totals.income)} note={`${totals.incomeEntries} entries`} />
              <Figure label="Expenses" value={currency(totals.expenses)} note={`${totals.expenseEntries} entries`} />
            </div>
          </div>

          <div className="mb-1.5 mt-6 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
            <span>Last 6 months</span>
            <span className="flex gap-4">
              <span className="inline-flex items-center gap-1.5"><i className="block w-[18px] rounded border-t-[3px] border-[color:var(--purple)]" />Income</span>
              <span className="inline-flex items-center gap-1.5"><i className="block w-[18px] border-t-2 border-dashed border-slate-400" />Expenses</span>
            </span>
          </div>
          <RevenueChart months={data.months} />
        </section>

        <section className={panel} aria-label="Workspace">
          <h2 className="font-[family-name:Manrope,sans-serif] m-0 text-base font-semibold">Your workspace</h2>
          <p className="mt-1 text-sm text-slate-500">Counts update as you add records.</p>
          <div className="mt-3">
            <CountRow icon="bookings" tone="bookings" label="Active bookings" value={totals.bookings} onClick={() => onNavigate('bookings')} />
            <CountRow icon="purchases" tone="purchases" label="Products" value={totals.products} onClick={() => onNavigate('products')} />
            <CountRow icon="inventory" tone="neutral" label="Inventory items" value={totals.inventory} onClick={() => onNavigate('inventory')} />
            <CountRow icon="suppliers" tone="neutral" label="Suppliers" value={totals.suppliers} onClick={() => onNavigate('suppliers')} />
          </div>
        </section>
      </div>

      <section className={panel} aria-label="Recent transactions">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:Manrope,sans-serif] m-0 text-base font-semibold">Recent transactions</h2>
            <p className="mt-1 text-sm text-slate-500">Your latest income, expenses, bookings and purchases.</p>
          </div>
          <button className={`py-1 text-sm font-medium text-[color:var(--purple)] hover:underline ${focusRing}`} onClick={() => onNavigate('money-tracker')}>
            View all transactions
          </button>
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
                <div className={`${txGrid} border-t border-slate-100 py-3 text-sm`} key={t.id}>
                  <IconBadge name={tone} tone={tone} />
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="hidden text-slate-500 sm:block">{label}</span>
                  <span className="hidden text-slate-500 sm:block">
                    {new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className={`text-right font-semibold tabular-nums ${t.type === 'income' ? 'text-emerald-700' : ''}`}>{sign}{currency(t.amount)}</span>
                </div>
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

/* Responsive line chart: measured width (no stretched SVG), axis labels aligned with
   gridlines, and a hover/touch readout for each month. */
function RevenueChart({ months }) {
  const wrapRef = useRef(null);
  const gradId = useId().replace(/:/g, '');
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
  const H = 240;
  const pad = { l: 52, r: 14, t: 14, b: 28 };
  const iw = width - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const rawMax = Math.max(0, ...months.flatMap((m) => [m.income, m.expenses]));

  if (!n || rawMax === 0) {
    return <div ref={wrapRef} className="pt-6 text-sm text-slate-500">Income and expenses will chart here once you add entries.</div>;
  }

  // Round the axis up to a clean step so gridline labels read like $2K, $4K, $6K…
  const base = 10 ** Math.floor(Math.log10(rawMax / 4));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * base).find((s) => s * 4 >= rawMax);
  const tickCount = Math.ceil(rawMax / step);
  const max = step * tickCount;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => step * i);

  const x = (i) => pad.l + (n < 2 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const smooth = (key) => months.map((m, i) => {
    const px = x(i), py = y(m[key]);
    if (i === 0) return `M${px},${py}`;
    const cx = (x(i - 1) + px) / 2;
    return `C${cx},${y(months[i - 1][key])} ${cx},${py} ${px},${py}`;
  }).join(' ');

  const incomePath = smooth('income');
  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const idx = n < 2 ? 0 : Math.round(((e.clientX - rect.left - pad.l) / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, idx)));
  };
  const active = hover === null ? n - 1 : hover;
  const m = months[active];
  const accent = 'var(--purple,#6c5ce7)';

  return (
    <div className="relative" ref={wrapRef}>
      <svg className="block w-full touch-pan-y" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img"
        aria-label={`Income and expenses over the last ${n} months`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity=".18" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} className="stroke-slate-100" />
            <text x={pad.l - 10} y={y(t) + 4} textAnchor="end" className="fill-slate-500 text-xs tabular-nums">{compactCurrency(t)}</text>
          </g>
        ))}
        {n > 1 && <path d={`${incomePath} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${gradId})`} />}
        <path d={smooth('expenses')} fill="none" className="stroke-slate-400" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
        <path d={incomePath} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {hover !== null && <line x1={x(active)} x2={x(active)} y1={pad.t} y2={y(0)} className="stroke-slate-300" />}
        <circle cx={x(active)} cy={y(m.expenses)} r="4" fill="#fff" className="stroke-slate-400" strokeWidth="2" />
        <circle cx={x(active)} cy={y(m.income)} r="5" fill="#fff" stroke={accent} strokeWidth="3" />
        {months.map((mo, i) => (
          <text key={mo.key} x={x(i)} y={H - 8} textAnchor="middle"
            className={`text-xs ${i === active ? 'fill-slate-800 font-semibold' : 'fill-slate-500'}`}>{mo.label}</text>
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-slate-800 px-3 py-2 text-xs leading-relaxed text-white"
          style={{ left: Math.min(width - 70, Math.max(70, x(active))) }}>
          <b className="mb-0.5 block font-semibold">{m.label}</b>
          Income {currency(m.income)}<br />Expenses {currency(m.expenses)}
        </div>
      )}
    </div>
  );
}
