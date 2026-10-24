import { useEffect, useMemo, useState } from 'react';

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 4 }).format(Number(value) || 0);

export default function SupplierPricesPage() {
  const [prices, setPrices] = useState([]); const [threshold, setThreshold] = useState(10); const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    fetch(`/api/supplier-prices?thresholdPercent=${encodeURIComponent(threshold)}`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load supplier price history.'); return data; })
      .then(setPrices).catch((cause) => { if (cause.name !== 'AbortError') setError(cause.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [threshold]);
  const visible = useMemo(() => prices.filter((row) => `${row.materialName} ${row.supplierName}`.toLowerCase().includes(search.toLowerCase())), [prices, search]);
  const alerts = prices.filter((row) => row.costIncreaseAlert).length;
  return <section className="materials-page supplier-prices-page">
    <header className="materials-heading"><div><div className="t-eyebrow">PURCHASING</div><h1 className="t-page-title">Supplier prices</h1><p>Price history is recorded automatically when purchase order stock is received.</p></div><label>Alert threshold (%) <input type="number" min="0" max="500" step="1" value={threshold} onChange={(event) => setThreshold(event.target.value)} /></label></header>
    {error && <div className="materials-alert" role="alert">{error}</div>}
    <div className="materials-summary"><article><span>Price history entries</span><strong>{prices.length}</strong></article><article><span>Latest cost increase alerts</span><strong>{alerts}</strong></article><article><span>Alert rule</span><strong>Above {threshold}%</strong></article></div>
    <div className="materials-panel"><div className="materials-toolbar"><div><h2>Material price history</h2><p>Change is compared with the previous recorded price from the same supplier.</p></div><div className="materials-filters"><input aria-label="Search supplier prices" placeholder="Search material or supplier…" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      {loading ? <div className="materials-empty">Loading supplier prices…</div> : !visible.length ? <div className="materials-empty">No supplier prices recorded yet. Submit a purchase order receipt to start the history.</div> : <div className="materials-table-wrap"><table className="materials-table"><thead><tr><th>Material</th><th>Supplier</th><th>Effective date</th><th>Unit cost</th><th>Previous</th><th>Change</th><th>Alert</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td><strong>{row.materialName}</strong></td><td>{row.supplierName}</td><td>{row.effectiveDate}</td><td>{money(row.unitCost)}</td><td>{row.previousUnitCost === null ? '—' : money(row.previousUnitCost)}</td><td>{row.changePercent === null ? '—' : `${row.changePercent > 0 ? '+' : ''}${row.changePercent}%`}</td><td>{row.costIncreaseAlert ? <span className="materials-status low">Above {row.alertThresholdPercent}%</span> : '—'}</td></tr>)}</tbody></table></div>}
    </div>
  </section>;
}
