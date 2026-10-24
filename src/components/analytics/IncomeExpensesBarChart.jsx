import { useEffect, useRef, useState } from 'react';

const CHART_SERIES = [
  { key: 'income', label: 'Manual income', color: 'var(--chart-1)' },
  { key: 'salesRevenue', label: 'Sales revenue', color: 'var(--chart-2)' },
  { key: 'cashCollected', label: 'Customer payments', color: 'var(--chart-3)' },
  { key: 'expenses', label: 'Expenses', color: 'var(--chart-4)' },
  { key: 'payrollPaid', label: 'Payroll paid', color: 'var(--chart-3)' },
  { key: 'materialCost', label: 'Material costs', color: 'var(--chart-5)' },
  { key: 'grossMargin', label: 'Gross margin', color: 'var(--accent-hover)' }
];

const currency = (val) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(val || 0);

const compactCurrency = (val) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', notation: 'compact', maximumFractionDigits: 1 }).format(val || 0);

function readSavedPreferences() {
  try {
    const saved = JSON.parse(window.localStorage.getItem('g4-sticker-chart-preferences') || '{}');
    const validKeys = new Set(CHART_SERIES.map((s) => s.key));
    const series = Array.isArray(saved.series)
      ? saved.series.filter((k) => validKeys.has(k))
      : ['income', 'expenses'];
    return {
      series: series.length ? series : ['income', 'expenses'],
      type: saved.type === 'bar' ? 'bar' : 'line'
    };
  } catch {
    return { series: ['income', 'expenses'], type: 'line' };
  }
}

export default function IncomeExpensesBarChart({
  data,
  loading,
  error,
  chartMonths = 6,
  onChartMonthsChange
}) {
  const months = data?.months || [];
  const [prefs, setPrefs] = useState(readSavedPreferences);
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);

  // Persist preferences
  useEffect(() => {
    try {
      window.localStorage.setItem('g4-sticker-chart-preferences', JSON.stringify(prefs));
    } catch {
      /* Session fallback */
    }
  }, [prefs]);

  // Reliable ResizeObserver that attaches after loading is complete
  useEffect(() => {
    if (loading) return undefined;
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 50) {
        setWidth(Math.round(rect.width));
      }
    };
    measure();

    const ro = new ResizeObserver(([entry]) => {
      if (entry?.contentRect?.width > 50) {
        setWidth(Math.round(entry.contentRect.width));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, data]);

  const toggleSeries = (key) => {
    setPrefs((prev) => {
      const exists = prev.series.includes(key);
      const nextSeries = exists
        ? prev.series.filter((k) => k !== key)
        : [...prev.series, key];
      return { ...prev, series: nextSeries.length ? nextSeries : [key] };
    });
  };

  if (loading) {
    return (
      <div className="analytics-card analytics-card-full-width" aria-busy="true">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Financial Trends</h3>
            <span className="analytics-card-desc">Monthly breakdown & comparisons</span>
          </div>
        </div>
        <div className="analytics-skeleton" style={{ height: '340px' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-card analytics-card-full-width">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">Financial Trends</h3>
        </div>
        <div className="analytics-state-box">
          <span className="analytics-prompt-symbol">!</span>
          <span>Failed to load financial trends data.</span>
        </div>
      </div>
    );
  }

  const n = months.length;
  const latestMonth = months[n - 1] || {};
  const activeSeries = CHART_SERIES.filter((s) => prefs.series.includes(s.key));
  const rawMax = Math.max(0, ...months.flatMap((m) => activeSeries.map((s) => Number(m[s.key]) || 0)));

  // Responsive active width: fallback to measured or parent container width
  const chartWidth = width || wrapRef.current?.clientWidth || 800;
  const H = 340;
  const pad = { l: 56, r: 24, t: 28, b: 38 };
  const iw = Math.max(10, chartWidth - pad.l - pad.r);
  const ih = Math.max(10, H - pad.t - pad.b);

  // Y-axis tick calculations
  const base = 10 ** Math.floor(Math.log10((rawMax || 1) / 4));
  const axisMax = rawMax || 1;
  const step = [1, 2, 2.5, 5, 10].map((f) => f * base).find((s) => s * 4 >= axisMax) || 100;
  const tickCount = Math.min(8, Math.max(2, Math.ceil(axisMax / step)));
  const max = step * tickCount;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => step * i);

  const x = (i) => pad.l + (n < 2 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => pad.t + ih - Math.min(1, Math.max(0, v / max)) * ih;

  const smoothPath = (key) =>
    months
      .map((month, i) => {
        const px = x(i);
        const py = y(Number(month[key]) || 0);
        if (i === 0) return `M${px},${py}`;
        const cx = (x(i - 1) + px) / 2;
        return `C${cx},${y(Number(months[i - 1][key]) || 0)} ${cx},${py} ${px},${py}`;
      })
      .join(' ');

  const areaPath = (key) => {
    if (n < 2) return '';
    const lineP = smoothPath(key);
    const lastX = x(n - 1);
    const firstX = x(0);
    const bottomY = y(0);
    return `${lineP} L${lastX},${bottomY} L${firstX},${bottomY} Z`;
  };

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = e.clientX - rect.left - pad.l;
    const idx = n < 2 ? 0 : Math.round((relativeX / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, idx)));
  };

  const activeIdx = hover === null ? n - 1 : hover;
  const activeMonth = months[activeIdx];
  const barWidth = Math.min(24, (iw / Math.max(1, n) * 0.76) / Math.max(1, activeSeries.length));

  // Determine peak month across active series
  let peakVal = 0;
  let peakIdx = -1;
  months.forEach((m, i) => {
    const mTotal = Math.max(...activeSeries.map((s) => Number(m[s.key]) || 0), 0);
    if (mTotal > peakVal) {
      peakVal = mTotal;
      peakIdx = i;
    }
  });

  return (
    <div className="analytics-card analytics-card-full-width" role="region" aria-label="Customizable Financial Trends">
      {/* Top Header */}
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">
            Financial Trends
            {peakVal > 0 && peakIdx >= 0 && (
              <span className="analytics-pill peak">
                Peak: {currency(peakVal)} ({months[peakIdx]?.label})
              </span>
            )}
          </h3>
          <span className="analytics-card-desc">
            Performance through {months[months.length - 1]?.label || 'now'}
          </span>
        </div>
      </div>

      {/* 75% Graph on Left, 25% Side Controls & Series List on Right */}
      <div className="analytics-trends-body-grid">
        {/* Left Column (75% width): Spacious Graph */}
        <div className="analytics-trends-chart-area">
          <div className="analytics-canvas-wrap" ref={wrapRef} style={{ position: 'relative', width: '100%', minHeight: '340px' }}>
            {!activeSeries.length ? (
              <div className="analytics-state-box">
                <span className="analytics-prompt-symbol">&gt;</span>
                <span>Select at least one series on the right panel to plot on the chart.</span>
              </div>
            ) : (
              <>
                <svg
                  className="block w-full touch-pan-y"
                  width="100%"
                  height={H}
                  viewBox={`0 0 ${chartWidth} ${H}`}
                  role="img"
                  aria-label={`${prefs.type === 'bar' ? 'Bar' : 'Line'} chart comparing ${activeSeries.map((s) => s.label).join(', ')} over ${n} months`}
                  onPointerMove={onMove}
                  onPointerLeave={() => setHover(null)}
                  style={{ overflow: 'visible', width: '100%', display: 'block' }}
                >
                  <defs>
                    {activeSeries.map((s) => (
                      <linearGradient key={`grad-${s.key}`} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={s.color} stopOpacity="0.0" />
                      </linearGradient>
                    ))}
                  </defs>

                  {/* Y-Axis Horizontal Gridlines & Labels */}
                  {ticks.map((t) => (
                    <g key={t}>
                      <line
                        x1={pad.l}
                        x2={chartWidth - pad.r}
                        y1={y(t)}
                        y2={y(t)}
                        stroke="var(--line)"
                        strokeDasharray="2 3"
                        strokeWidth="1"
                      />
                      <text
                        x={pad.l - 10}
                        y={y(t) + 4}
                        textAnchor="end"
                        fill="var(--muted)"
                        fontSize="var(--fs-caption)"
                        fontFamily="ui-monospace, monospace"
                      >
                        {compactCurrency(t)}
                      </text>
                    </g>
                  ))}

                  {/* Active Hover Crosshair Line */}
                  {hover !== null && (
                    <line
                      x1={x(activeIdx)}
                      x2={x(activeIdx)}
                      y1={pad.t}
                      y2={y(0)}
                      stroke="var(--line-strong)"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Chart Series (Bar or Line Mode) */}
                  {activeSeries.map((series, sIdx) => {
                    if (prefs.type === 'bar') {
                      return months.map((m, mIdx) => {
                        const val = Number(m[series.key]) || 0;
                        const barH = Math.max(0, y(0) - y(val));
                        const barX =
                          x(mIdx) -
                          (activeSeries.length * barWidth) / 2 +
                          sIdx * barWidth;
                        const barY = y(val);
                        const isMActive = mIdx === activeIdx;

                        return (
                          <rect
                            key={`${series.key}-${m.key}`}
                            x={barX}
                            y={barY}
                            width={Math.max(2, barWidth - 2)}
                            height={barH}
                            rx="3"
                            fill={series.color}
                            opacity={isMActive ? 1 : 0.76}
                            style={{ transition: 'height 150ms ease, y 150ms ease' }}
                          />
                        );
                      });
                    }

                    // Line mode
                    return (
                      <g key={series.key}>
                        {/* Area under curve */}
                        <path
                          d={areaPath(series.key)}
                          fill={`url(#grad-${series.key})`}
                          aria-hidden="true"
                        />
                        {/* Main smooth curve */}
                        <path
                          d={smoothPath(series.key)}
                          fill="none"
                          stroke={series.color}
                          strokeWidth={series.key === 'income' ? 2.8 : 2.2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Circular points on each month */}
                        {months.map((m, mIdx) => {
                          const val = Number(m[series.key]) || 0;
                          const isPointActive = mIdx === activeIdx;
                          return (
                            <circle
                              key={m.key}
                              cx={x(mIdx)}
                              cy={y(val)}
                              r={isPointActive ? 4.8 : 3}
                              fill="var(--surface-strong)"
                              stroke={series.color}
                              strokeWidth="2"
                            />
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* X-Axis Month Labels */}
                  {months.map((mo, i) => {
                    const isMoActive = i === activeIdx;
                    const isPeak = i === peakIdx && peakVal > 0;
                    return (
                      <g key={mo.key}>
                        {isPeak && (
                          <text
                            x={x(i)}
                            y={pad.t - 8}
                            textAnchor="middle"
                            fill="var(--accent)"
                            fontSize="var(--fs-caption)"
                            fontWeight="700"
                            fontFamily="ui-monospace, monospace"
                          >
                            ▲ PEAK
                          </text>
                        )}
                        <text
                          x={x(i)}
                          y={H - 14}
                          textAnchor="middle"
                          fill={isMoActive ? 'var(--text)' : 'var(--muted)'}
                          fontWeight={isMoActive ? '700' : '500'}
                          fontSize="var(--fs-caption)"
                          fontFamily="ui-monospace, monospace"
                        >
                          {mo.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Accessible Screen Reader Table */}
                <table className="sr-only">
                  <caption>Financial Trends Data by Month</caption>
                  <thead>
                    <tr>
                      <th>Month</th>
                      {activeSeries.map((s) => (
                        <th key={s.key}>{s.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => (
                      <tr key={m.key}>
                        <td>{m.label}</td>
                        {activeSeries.map((s) => (
                          <td key={s.key}>{currency(m[s.key] || 0)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Floating Tooltip */}
                {hover !== null && activeMonth && (
                  <div
                    className="analytics-chart-tooltip"
                    style={{
                      left: Math.min(Math.max(130, x(activeIdx)), chartWidth - 130),
                      top: '12px'
                    }}
                  >
                    <div className="analytics-tooltip-header">
                      <strong>{activeMonth.label} ({activeMonth.key})</strong>
                    </div>
                    <div className="analytics-tooltip-body">
                      {activeSeries.map((s) => (
                        <div className="analytics-tooltip-row" key={s.key}>
                          <div className="analytics-tooltip-row-label">
                            <span className="analytics-tooltip-dot" style={{ background: s.color }} />
                            <span>{s.label}</span>
                          </div>
                          <strong className="analytics-tooltip-row-val">
                            {currency(activeMonth[s.key] || 0)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column (25% width): Side Panel for Controls & Series Selection */}
        <div className="analytics-trends-sidebar" role="region" aria-label="Chart controls and data series">
          {/* Controls: Window & Line/Bar Toggle */}
          <div className="analytics-sidebar-top">
            <label className="analytics-control-group" style={{ margin: 0 }}>
              <span className="analytics-control-label">Window</span>
              <select
                className="select analytics-window-select"
                value={chartMonths}
                onChange={(e) => onChartMonthsChange?.(Number(e.target.value))}
              >
                <option value={3}>3 mo</option>
                <option value={6}>6 mo</option>
                <option value={12}>12 mo</option>
              </select>
            </label>

            <div className="analytics-type-toggle" role="group" aria-label="Chart type toggle">
              <button
                type="button"
                className={`btn analytics-type-btn btn-secondary${prefs.type === 'line' ? 'active' : ''}`}
                aria-pressed={prefs.type === 'line'}
                onClick={() => setPrefs((prev) => ({ ...prev, type: 'line' }))}
              >
                Line
              </button>
              <button
                type="button"
                className={`btn analytics-type-btn btn-secondary${prefs.type === 'bar' ? 'active' : ''}`}
                aria-pressed={prefs.type === 'bar'}
                onClick={() => setPrefs((prev) => ({ ...prev, type: 'bar' }))}
              >
                Bar
              </button>
            </div>
          </div>

          {/* Series Selection Checklist */}
          <div className="analytics-sidebar-title">
            <span>Series Toggles</span>
            <span style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)', fontWeight: 'normal' }}>
              {activeSeries.length} active
            </span>
          </div>

          <div className="analytics-sidebar-list" role="group" aria-label="Data series list">
            {CHART_SERIES.map((s) => {
              const isChecked = prefs.series.includes(s.key);
              const latestVal = latestMonth[s.key] || 0;

              return (
                <button
                  type="button"
                  key={s.key}
                  className={`btn analytics-sidebar-item btn-secondary${isChecked ? 'is-active' : ''}`}
                  style={{ '--series-color': s.color }}
                  onClick={() => toggleSeries(s.key)}
                  aria-pressed={isChecked}
                >
                  <div className="analytics-sidebar-item-left">
                    <span className="analytics-sidebar-item-dot" />
                    <span className="analytics-sidebar-item-label">{s.label}</span>
                  </div>
                  <span className="analytics-sidebar-item-val">{currency(latestVal)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
