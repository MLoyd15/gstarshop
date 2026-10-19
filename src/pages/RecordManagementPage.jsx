import '../styles/RecordManagementPage.css';
import '../styles/SuppliersPage.css';
import '../styles/ProductsPage.css';
import '../styles/InventoryPage.css';
const dateFromValue=(value)=>{if(!value)return null;const [year,month,day]=value.split('-').map(Number);const date=new Date(year,month-1,day);return Number.isNaN(date.getTime())?null:date;};




export default function RecordManagementPage({ active, title, fields, records, loading, search, setSearch, onCreate, onEdit, onDelete, pageClass = '' }) {
  const lower = active === 'income' || active === 'expenses' || active === 'profit' || active === 'money-tracker';
  const isInventory = active === 'inventory';
  const totalStock = records.reduce((total, record) => total + (Number(record.stock) || 0), 0);
  const lowStockCount = records.filter((record) => Number(record.stock) <= 5).length;
  return <div className={`records-page ${pageClass}`}><div className="welcome-row records-welcome"><div><div className="eyebrow"><span className="eyebrow-line" />BUSINESS HUB</div>
    <h1>{title}</h1><p>{isInventory ? 'See current stock levels for every product in your catalog.' : `Keep your ${title.toLowerCase()} organized and up to date.`}</p></div><button className="primary-button" onClick={onCreate}><span>＋</span>{isInventory ? 'Manage products' : `Add ${title.replace(/s$/, '')}`}</button></div>
    <div className="records-summary">
      {isInventory ? <>
        <div><span className="summary-label">Products tracked</span><strong>{records.length}</strong></div>
        <div><span className="summary-label">Total units in stock</span><strong>{totalStock.toLocaleString()}</strong></div>
        <div><span className="summary-label">Low or out of stock</span><strong>{lowStockCount}</strong></div>
      </> : <>
        <div><span className="summary-label">Total records</span><strong>{records.length}</strong></div>
        <div><span className="summary-label">Last updated</span><strong>{records.length ? 'Just now' : '—'}</strong></div>
        <div className="summary-hint"><span className="summary-spark">✳</span><span>Your business, all in one place.</span></div>
      </>}
    </div>
    <section className="panel records-panel"><div className="records-toolbar"><div><h2>All {title.toLowerCase()}</h2><p>Manage and keep track of your records</p></div>
      <label className="table-search"><span>⌕</span><input aria-label={`Search ${title}`} placeholder={`Search ${title.toLowerCase()}...`} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <button className="filter-button">☷ <span>Filter</span></button><button className="select-button">Latest first <span>⌄</span></button></div>
      <div className="table-wrap"><table><thead><tr>{fields.map(([, label]) => <th key={label}>{label}</th>)}{!isInventory && <><th>Added</th><th aria-label="Actions" /></>}</tr></thead>
        <tbody>{loading ? <tr><td className="empty-state" colSpan={fields.length + (isInventory ? 0 : 2)}>Loading your records…</td></tr>
          : records.length === 0 ? <tr><td className="empty-state" colSpan={fields.length + (isInventory ? 0 : 2)}><span className="empty-icon">{lower ? '↗' : '▤'}</span><strong>{search ? 'No matches found' : isInventory ? 'No products to track yet' : `No ${title.toLowerCase()} yet`}</strong><span>{search ? 'Try a different search term.' : isInventory ? 'Add products with stock quantities to see them here.' : `Add your first ${title.toLowerCase().replace(/s$/, '')} to get started.`}</span></td></tr>
          : records.map((record) => <tr key={record.id}>{fields.map(([key]) => <td key={key}>{key === 'status'
            || key === 'stockStatus'
            ? <span className={`record-status ${String(record[key] || 'active').toLowerCase().replace(/\s/g, '-')}`}>{record[key] || 'Active'}</span>
            : (key.toLowerCase().includes('date') || key === 'updated') && record[key]
              ? <span className="date-cell"><span>▦</span>{dateFromValue(String(record[key]).slice(0, 10))?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || record[key]}</span>
              : record[key] !== undefined && record[key] !== null && record[key] !== '' ? record[key] : '—'}</td>)}
            {!isInventory && <><td>{record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '—'}</td><td><div className="row-actions"><button aria-label="Edit record" onClick={() => onEdit(record)}>✎</button><button aria-label="Delete record" onClick={() => onDelete(record)}>×</button></div></td></>}</tr>)}</tbody></table></div>
      <div className="table-footer"><span>Showing <strong>{records.length ? 1 : 0}–{records.length}</strong> of <strong>{records.length}</strong> results</span><div><button disabled>← Previous</button><button disabled>Next →</button></div></div>
    </section>
  </div>;
}
