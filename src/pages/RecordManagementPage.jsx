import '../styles/RecordManagementPage.css';
import '../styles/SuppliersPage.css';
import '../styles/ProductsPage.css';
import '../styles/InventoryPage.css';
import '../styles/EmployeeLink.css';
import { useEffect, useMemo, useState } from 'react';
const dateFromValue=(value)=>{if(!value)return null;const [year,month,day]=value.split('-').map(Number);const date=new Date(year,month-1,day);return Number.isNaN(date.getTime())?null:date;};
const moneyFields = new Set(['amount','price','salary','income','expenses','grossPay','netPay']);
const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);




export default function RecordManagementPage({ active, title, fields, records, loading, search, setSearch, onCreate, onEdit, onDelete, onSelect, pageClass = '' }) {
  const lower = active === 'income' || active === 'expenses' || active === 'profit' || active === 'money-tracker';
  const isInventory = active === 'inventory';
  const totalStock = records.reduce((total, record) => total + (Number(record.stock) || 0), 0);
  const lowStockCount = records.filter((record) => Number(record.stock) <= 5).length;
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const statusField = fields.find(([key]) => key === 'status' || key === 'stockStatus')?.[0];
  const statusOptions = useMemo(() => [...new Set(records.map((record) => record[statusField]).filter(Boolean).map(String))].sort(), [records, statusField]);
  const matchingRecords = useMemo(() => records.filter((record) => statusFilter === 'all' || String(record[statusField] || '').toLowerCase() === statusFilter.toLowerCase()), [records, statusFilter, statusField]);
  const sortedRecords = useMemo(() => matchingRecords.slice().sort((a, b) => {
    if (sortOrder === 'name') return String(a[fields[0]?.[0]] || '').localeCompare(String(b[fields[0]?.[0]] || ''));
    const dateOf = (record) => new Date(record.createdAt || record.updatedAt || record.date || record.paymentDate || 0).getTime() || 0;
    return sortOrder === 'oldest' ? dateOf(a) - dateOf(b) : dateOf(b) - dateOf(a);
  }), [fields, matchingRecords, sortOrder]);
  const pageCount = Math.ceil(sortedRecords.length / pageSize);
  const pageRecords = sortedRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstResult = sortedRecords.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastResult = Math.min(currentPage * pageSize, sortedRecords.length);

  useEffect(() => setCurrentPage(1), [search, statusFilter]);
  useEffect(() => setCurrentPage((page) => Math.min(page, Math.max(1, pageCount))), [pageCount]);
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
      {statusField && <label className="filter-control"><span className="sr-only">Filter by status</span><select className="filter-button" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>}
      <label className="sort-control"><span className="sr-only">Sort records</span><select className="select-button" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="latest">Latest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></label></div>
      <div className="table-wrap"><table><thead><tr>{fields.map(([, label]) => <th key={label}>{label}</th>)}{!isInventory && <><th>Added</th><th aria-label="Actions" /></>}</tr></thead>
        <tbody>{loading ? <tr><td className="empty-state" colSpan={fields.length + (isInventory ? 0 : 2)}>Loading your records…</td></tr>
          : matchingRecords.length === 0 ? <tr><td className="empty-state" colSpan={fields.length + (isInventory ? 0 : 2)}><span className="empty-icon">{lower ? '↗' : '▤'}</span><strong>{search || statusFilter !== 'all' ? 'No matches found' : isInventory ? 'No products to track yet' : `No ${title.toLowerCase()} yet`}</strong><span>{search || statusFilter !== 'all' ? 'Try changing your search or status filter.' : isInventory ? 'Add products with stock quantities to see them here.' : `Add your first ${title.toLowerCase().replace(/s$/, '')} to get started.`}</span></td></tr>
          : pageRecords.map((record) => <tr key={record.id}>{fields.map(([key]) => <td key={key}>{active === 'employees' && key === 'name' && onSelect
            ? <button type="button" className="employee-sheet-link" onClick={() => onSelect(record)}>{record.name || 'Unnamed employee'}<small>Open monthly sheet →</small></button>
            : key === 'status'
            || key === 'stockStatus'
            ? <span className={`record-status ${String(record[key] || 'active').toLowerCase().replace(/\s/g, '-')}`}>{record[key] || 'Active'}</span>
            : (key.toLowerCase().includes('date') || key === 'updated') && record[key]
              ? <span className="date-cell"><span>▦</span>{dateFromValue(String(record[key]).slice(0, 10))?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) || record[key]}</span>
            : record[key] !== undefined && record[key] !== null && record[key] !== '' ? moneyFields.has(key) && Number.isFinite(Number(record[key])) ? money(record[key]) : record[key] : '—'}</td>)}
            {!isInventory && <><td>{record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '—'}</td><td><div className="row-actions"><button aria-label="Edit record" onClick={() => onEdit(record)}>✎</button><button aria-label="Delete record" onClick={() => onDelete(record)}>×</button></div></td></>}</tr>)}</tbody></table></div>
      <div className="table-footer"><span>Showing <strong>{firstResult}–{lastResult}</strong> of <strong>{sortedRecords.length}</strong> results</span><div><button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)}>← Previous</button><button type="button" disabled={currentPage >= pageCount} onClick={() => setCurrentPage((page) => page + 1)}>Next →</button></div></div>
    </section>
  </div>;
}
