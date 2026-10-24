import { useMemo } from 'react';

const PALETTE = [
  'var(--accent)',
  'var(--success)',
  'var(--chart-3)',
  'var(--warning)',
  'var(--chart-5)',
  'var(--accent-hover)',
  'var(--muted)'
];

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(val || 0);

export default function ExpensesDonutChart({ data, loading, error }) {
  const categories = data?.categories || [];
  const totalAmount = data?.totalAmount || 0;
  const totalCount = data?.totalCount || 0;

  // Compute SVG Donut paths
  const slices = useMemo(() => {
    if (!categories.length || totalAmount <= 0) return [];
    let currentAngle = -90; // Start at top
    return categories.map((cat, idx) => {
      const sliceAngle = (cat.amount / totalAmount) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      // Arc calculation
      const rOuter = 70;
      const rInner = 48;
      const cx = 90;
      const cy = 90;

      const rad = (deg) => (deg * Math.PI) / 180;
      const x1 = cx + rOuter * Math.cos(rad(startAngle));
      const y1 = cy + rOuter * Math.sin(rad(startAngle));
      const x2 = cx + rOuter * Math.cos(rad(endAngle));
      const y2 = cy + rOuter * Math.sin(rad(endAngle));
      const x3 = cx + rInner * Math.cos(rad(endAngle));
      const y3 = cy + rInner * Math.sin(rad(endAngle));
      const x4 = cx + rInner * Math.cos(rad(startAngle));
      const y4 = cy + rInner * Math.sin(rad(startAngle));

      const largeArc = sliceAngle > 180 ? 1 : 0;
      const pathData =
        sliceAngle >= 359.9
          ? `M ${cx} ${cy - rOuter} A ${rOuter} ${rOuter} 0 1 0 ${cx} ${cy + rOuter} A ${rOuter} ${rOuter} 0 1 0 ${cx} ${cy - rOuter} M ${cx} ${cy - rInner} A ${rInner} ${rInner} 0 1 1 ${cx} ${cy + rInner} A ${rInner} ${rInner} 0 1 1 ${cx} ${cy - rInner} Z`
          : `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;

      return {
        ...cat,
        color: PALETTE[idx % PALETTE.length],
        pathData
      };
    });
  }, [categories, totalAmount]);

  if (loading) {
    return (
      <div className="analytics-card" aria-busy="true">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Expenses by Category</h3>
            <span className="analytics-card-desc">Period breakdown</span>
          </div>
        </div>
        <div className="analytics-skeleton" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-card">
        <div className="analytics-card-header">
          <h3 className="analytics-card-title">Expenses by Category</h3>
        </div>
        <div className="analytics-state-box">
          <span className="analytics-prompt-symbol">!</span>
          <span>Failed to load expense category data.</span>
        </div>
      </div>
    );
  }

  if (!categories.length || totalAmount <= 0) {
    return (
      <div className="analytics-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Expenses by Category</h3>
            <span className="analytics-card-desc">Operating costs</span>
          </div>
          <span className="analytics-pill">0 Entries</span>
        </div>
        <div className="analytics-state-box">
          <span className="analytics-prompt-symbol">&gt;</span>
          <span>No operating expenses recorded for this period.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-card" role="region" aria-label="Expenses by category donut chart">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">
            Expenses by Category
            <span className="analytics-pill">{totalCount} entries</span>
          </h3>
          <span className="analytics-card-desc">Operating costs (payroll excluded)</span>
        </div>
        <span className="analytics-pill">{formatCurrency(totalAmount)}</span>
      </div>

      <div className="analytics-canvas-wrap" style={{ alignItems: 'center' }}>
        <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-hidden="true">
          {slices.map((slice) => (
            <path
              key={slice.category}
              d={slice.pathData}
              fill={slice.color}
              stroke="var(--surface-strong)"
              strokeWidth="1.5"
            />
          ))}
          <text
            x="90"
            y="86"
            textAnchor="middle"
            fill="var(--text-secondary)"
            fontSize="var(--fs-caption)"
            fontFamily="ui-monospace, monospace"
          >
            TOTAL
          </text>
          <text
            x="90"
            y="102"
            textAnchor="middle"
            fill="var(--text)"
            fontSize="var(--fs-caption)"
            fontWeight="700"
            fontFamily="ui-monospace, monospace"
          >
            {formatCurrency(totalAmount)}
          </text>
        </svg>

        <table className="sr-only">
          <caption>Expenses by Category</caption>
          <thead>
            <tr>
              <th>Category</th>
              <th>Amount</th>
              <th>Percentage</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.category}>
                <td>{c.category}</td>
                <td>{formatCurrency(c.amount)}</td>
                <td>{c.percentage}%</td>
                <td>{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="analytics-legend-grid">
        {slices.map((slice) => (
          <div className="analytics-legend-item" key={slice.category}>
            <div className="analytics-legend-left">
              <span className="analytics-legend-dot" style={{ background: slice.color }} />
              <span className="analytics-legend-name">{slice.category}</span>
              <span className="analytics-legend-count">({slice.count})</span>
            </div>
            <div className="analytics-legend-right">
              <span className="analytics-legend-amount">{formatCurrency(slice.amount)}</span>
              <span className="analytics-legend-pct">{slice.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

