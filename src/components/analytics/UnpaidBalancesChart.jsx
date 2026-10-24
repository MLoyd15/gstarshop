const formatCurrency = (val) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(val || 0);

export default function UnpaidBalancesChart({ data, loading, error }) {
  const items = data?.items || [];
  const totalBalance = data?.totalBalance || 0;
  const totalCount = data?.totalCount || 0;
  const unverifiedCount = data?.unverifiedCount || 0;

  if (loading) {
    return (
      <div className="analytics-card" aria-busy="true">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Unpaid Balances</h3>
            <span className="analytics-card-desc">Client receivables</span>
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
          <h3 className="analytics-card-title">Unpaid Balances</h3>
        </div>
        <div className="analytics-state-box">
          <span className="analytics-prompt-symbol">!</span>
          <span>Failed to load customer receivables.</span>
        </div>
      </div>
    );
  }

  if (!items.length || totalBalance <= 0) {
    return (
      <div className="analytics-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">Unpaid Balances</h3>
            <span className="analytics-card-desc">Client receivables</span>
          </div>
          <span className="analytics-pill" style={{ color: 'var(--success)' }}>
            All Paid
          </span>
        </div>
        <div className="analytics-state-box">
          <span className="analytics-prompt-symbol">&gt;</span>
          <span>No outstanding customer balances. All jobs are fully paid.</span>
        </div>
      </div>
    );
  }

  const maxBalance = Math.max(...items.map((i) => i.balance), 1);

  return (
    <div className="analytics-card" role="region" aria-label="Customer unpaid balances bar list">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">
            Unpaid Balances
            <span className="analytics-pill danger">{totalCount} clients owe</span>
          </h3>
          <span className="analytics-card-desc">
            Ranked receivables list
            {unverifiedCount > 0 && ` (${unverifiedCount} unconfirmed legacy)`}
          </span>
        </div>
        <span className="analytics-pill danger">{formatCurrency(totalBalance)}</span>
      </div>

      <div className="analytics-canvas-wrap">
        <div className="analytics-unpaid-list">
          {items.map((item) => {
            const barWidthPct = Math.max(5, (item.balance / maxBalance) * 100);

            return (
              <div className="analytics-unpaid-row" key={item.id} style={{ position: 'relative', overflow: 'hidden' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${barWidthPct}%`,
                    background: 'color-mix(in srgb, var(--danger), transparent 90%)',
                    zIndex: 0
                  }}
                />
                <div className="analytics-unpaid-info" style={{ position: 'relative', zIndex: 1 }}>
                  <span className="analytics-unpaid-name">{item.name}</span>
                  <span className="analytics-unpaid-client">
                    {item.client}
                    {!item.paymentLedgerVerified && (
                      <span className="analytics-pill estimated" style={{ fontSize: 'var(--fs-caption)', padding: '1px 4px' }}>
                        Legacy ledger
                      </span>
                    )}
                    {item.isCompleted && (
                      <span className="analytics-pill" style={{ fontSize: 'var(--fs-caption)', padding: '1px 4px' }}>
                        Job completed
                      </span>
                    )}
                  </span>
                </div>

                <div className="analytics-unpaid-balance-wrap" style={{ position: 'relative', zIndex: 1 }}>
                  <span className="analytics-unpaid-balance">{formatCurrency(item.balance)}</span>
                  <div style={{ fontSize: 'var(--fs-caption)', color: 'var(--muted)' }}>
                    of {formatCurrency(item.totalAmount)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <table className="sr-only">
          <caption>Unpaid Customer Balances</caption>
          <thead>
            <tr>
              <th>Job Name</th>
              <th>Client</th>
              <th>Total Amount</th>
              <th>Paid Amount</th>
              <th>Balance Due</th>
              <th>Ledger Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td>
                <td>{i.client}</td>
                <td>{formatCurrency(i.totalAmount)}</td>
                <td>{formatCurrency(i.paidAmount)}</td>
                <td>{formatCurrency(i.balance)}</td>
                <td>{i.paymentLedgerVerified ? 'Verified' : 'Legacy / Unconfirmed'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

