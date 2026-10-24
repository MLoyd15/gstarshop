const formatCurrency = (val) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(val || 0);

export default function BookingFunnelChart({ data, loading, error }) {
  const booked = data?.booked;
  const completed = data?.completed;
  const paid = data?.paid;

  if (loading) {
    return (
      <div className="analytics-card" aria-busy="true">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Booking Pipeline Funnel</h3>
            <span className="analytics-card-desc">Job progression</span>
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
          <h3 className="analytics-card-title">Booking Pipeline Funnel</h3>
        </div>
        <div className="analytics-state-box">
          <span className="analytics-prompt-symbol">!</span>
          <span>Failed to load booking pipeline data.</span>
        </div>
      </div>
    );
  }

  const totalBookedCount = booked?.count || 0;
  if (totalBookedCount === 0) {
    return (
      <div className="analytics-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Booking Pipeline Funnel</h3>
            <span className="analytics-card-desc">Job progression</span>
          </div>
          <span className="analytics-pill">0 Bookings</span>
        </div>
        <div className="analytics-state-box">
          <span className="analytics-prompt-symbol">&gt;</span>
          <span>No bookings created yet.</span>
        </div>
      </div>
    );
  }

  const steps = [
    {
      idx: '01',
      title: 'Booked',
      count: booked?.count || 0,
      value: booked?.value || 0,
      pctOfBooked: 100,
      pill: '100%'
    },
    {
      idx: '02',
      title: 'Completed',
      count: completed?.count || 0,
      value: completed?.value || 0,
      pctOfBooked: booked?.count > 0 ? ((completed?.count || 0) / booked.count) * 100 : 0,
      pill: `${completed?.conversionRate || 0}% of booked`
    },
    {
      idx: '03',
      title: 'Fully Paid',
      count: paid?.count || 0,
      value: paid?.value || 0,
      pctOfBooked: booked?.count > 0 ? ((paid?.count || 0) / booked.count) * 100 : 0,
      pill: `${paid?.conversionRate || 0}% of completed`
    }
  ];

  return (
    <div className="analytics-card" role="region" aria-label="Booking pipeline funnel chart">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">
            Booking Pipeline Funnel
            <span className="analytics-pill">{totalBookedCount} jobs</span>
          </h3>
          <span className="analytics-card-desc">Booked → Completed → Fully Paid</span>
        </div>
        <span className="analytics-pill" style={{ color: 'var(--success)' }}>
          {paid?.overallConversionRate || 0}% Cash Realized
        </span>
      </div>

      <div className="analytics-canvas-wrap">
        <div className="analytics-funnel-pipeline">
          {steps.map((step) => (
            <div className="analytics-funnel-step" key={step.title}>
              <div className="analytics-funnel-progress" style={{ width: `${Math.max(4, step.pctOfBooked)}%` }} />
              <div className="analytics-funnel-content">
                <div className="analytics-funnel-label-wrap">
                  <span className="analytics-funnel-idx">{step.idx}</span>
                  <div>
                    <span className="analytics-funnel-title">{step.title}</span>
                  </div>
                </div>

                <div className="analytics-funnel-stat-wrap">
                  <span className="analytics-funnel-count">{step.count} jobs</span>
                  <span className="analytics-funnel-val">{formatCurrency(step.value)}</span>
                  <span className="analytics-funnel-rate-badge">{step.pill}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <table className="sr-only">
          <caption>Booking Pipeline Funnel Data</caption>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Count</th>
              <th>Value</th>
              <th>Conversion Rate</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.title}>
                <td>{s.title}</td>
                <td>{s.count}</td>
                <td>{formatCurrency(s.value)}</td>
                <td>{s.pill}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

