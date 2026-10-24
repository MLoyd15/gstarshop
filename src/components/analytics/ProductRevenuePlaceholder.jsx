export default function ProductRevenuePlaceholder() {
  return (
    <div className="analytics-card analytics-card-placeholder" role="region" aria-label="Product revenue schema notice">
      <span className="analytics-placeholder-tag">TODO · PHASE B REQUIREMENT</span>
      <h3 className="analytics-card-title" style={{ marginBottom: '8px' }}>
        Revenue by Product
      </h3>
      <p className="analytics-placeholder-msg">
        Bookings currently record total booking price and material consumption, but do not record itemized product sales or quantities.
      </p>
      <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--muted)', fontFamily: 'ui-monospace, monospace' }}>
        &gt; Requires line-item products on booking records
      </div>
    </div>
  );
}

