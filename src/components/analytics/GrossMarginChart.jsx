const formatCurrency = (val) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(val || 0);

export default function GrossMarginChart({ data, loading, error }) {
  const months = data?.months || [];
  const totalRevenue = data?.totalRevenue || 0;
  const totalGrossMargin = data?.totalGrossMargin || 0;
  const totalMaterialCost = data?.totalMaterialCost || 0;
  const overallMarginPct =
    totalRevenue > 0 ? Math.round((totalGrossMargin / totalRevenue) * 1000) / 10 : 0;
  const hasAnyEstimated = months.some((m) => m.hasEstimated);

  if (loading) {
    return (
      <div className="analytics-card" aria-busy="true">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Monthly Gross Margin</h3>
            <span className="analytics-card-desc">Revenue minus material cost</span>
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
          <h3 className="analytics-card-title">Monthly Gross Margin</h3>
        </div>
        <div className="analytics-state-box">
          <span className="analytics-prompt-symbol">!</span>
          <span>Failed to load gross margin data.</span>
        </div>
      </div>
    );
  }

  const hasData = months.some((m) => m.salesRevenue > 0 || m.materialCost > 0);
  if (!months.length || !hasData) {
    return (
      <div className="analytics-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Monthly Gross Margin</h3>
            <span className="analytics-card-desc">Revenue minus material cost</span>
          </div>
          <span className="analytics-pill">0 Jobs</span>
        </div>
        <div className="analytics-state-box">
          <span className="analytics-prompt-symbol">&gt;</span>
          <span>No completed jobs with recorded revenue in this window.</span>
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...months.map((m) => Math.max(m.salesRevenue, m.materialCost)), 100);

  return (
    <div className="analytics-card" role="region" aria-label="Monthly gross margin chart">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">
            Monthly Gross Margin
            <span className="analytics-pill" style={{ color: 'var(--success)' }}>
              {overallMarginPct}% Margin
            </span>
            {hasAnyEstimated && <span className="analytics-pill estimated">Includes Migrated</span>}
          </h3>
          <span className="analytics-card-desc">Completed job revenue minus actual material costs</span>
        </div>
        <span className="analytics-pill">{formatCurrency(totalGrossMargin)}</span>
      </div>

      <div className="analytics-canvas-wrap">
        <div className="analytics-custom-bar-container">
          {months.map((m) => {
            const revenueHeightPct = Math.max(4, (m.salesRevenue / maxVal) * 100);
            const costHeightPct = Math.max(2, (m.materialCost / maxVal) * 100);

            return (
              <div
                key={m.key}
                className="analytics-bar-col"
                title={`${m.label}: Revenue ${formatCurrency(m.salesRevenue)}, Materials ${formatCurrency(m.materialCost)}, Margin ${formatCurrency(m.grossMargin)} (${m.marginPercentage}%)${m.hasEstimated ? ' [Includes Migrated/Estimated]' : ''}`}
              >
                {m.hasEstimated && (
                  <span className="analytics-peak-indicator" style={{ color: 'var(--warning)', borderColor: 'var(--warning)' }}>
                    ~ EST
                  </span>
                )}
                <div className="analytics-bar-track">
                  {/* Revenue / Margin Bar */}
                  <div
                    className="analytics-bar-seg"
                    style={{
                      height: `${m.salesRevenue > 0 ? revenueHeightPct : 0}%`,
                      background: m.hasEstimated
                        ? 'repeating-linear-gradient(45deg, var(--success), var(--success) 4px, color-mix(in srgb, var(--success), transparent 30%) 4px, color-mix(in srgb, var(--success), transparent 30%) 8px)'
                        : 'var(--success)',
                      opacity: m.salesRevenue > 0 ? 1 : 0.2
                    }}
                  />
                  {/* Material Cost Bar */}
                  <div
                    className="analytics-bar-seg"
                    style={{
                      height: `${m.materialCost > 0 ? costHeightPct : 0}%`,
                      background: 'color-mix(in srgb, var(--danger), transparent 30%)',
                      opacity: m.materialCost > 0 ? 1 : 0.2
                    }}
                  />
                </div>
                <span className="analytics-bar-label">{m.label}</span>
              </div>
            );
          })}
        </div>

        <table className="sr-only">
          <caption>Monthly Gross Margin Data</caption>
          <thead>
            <tr>
              <th>Month</th>
              <th>Sales Revenue</th>
              <th>Material Cost</th>
              <th>Gross Margin</th>
              <th>Margin %</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key}>
                <td>{m.label}</td>
                <td>{formatCurrency(m.salesRevenue)}</td>
                <td>{formatCurrency(m.materialCost)}</td>
                <td>{formatCurrency(m.grossMargin)}</td>
                <td>{m.marginPercentage}%</td>
                <td>{m.hasEstimated ? 'Migrated / Estimated' : 'Completion Snapshot'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span style={{ color: 'var(--success)' }}>■ Gross Revenue</span>
          <span style={{ color: 'var(--danger)' }}>■ Material Cost</span>
          {hasAnyEstimated && <span style={{ color: 'var(--warning)' }}>▨ Estimated snapshot</span>}
        </div>
        <span>Total Materials: {formatCurrency(totalMaterialCost)}</span>
      </div>
    </div>
  );
}

