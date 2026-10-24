import { useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '../components/icons.jsx';
import { Plus } from '../components/icons.jsx';
import '../styles/MaterialsPage.css';
import { Alert, NOTICE_TIMEOUT_MS } from '../components/ui/alert.tsx';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { ConfirmDialog } from '../components/ui/alert-dialog.tsx';

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const quantity = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
const idempotencyKey = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [reports, setReports] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('name');
  const [dialog, setDialog] = useState(null);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [toggleTarget, setToggleTarget] = useState(null);
  const noticeTimeoutRef = useRef(null);
  useEffect(() => () => {
    if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
  }, []);

  function showNotice(message) {
    setNotice(message);
    if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice('');
      noticeTimeoutRef.current = null;
    }, NOTICE_TIMEOUT_MS);
  }

  async function request(path, method = 'GET', body) {
    const response = await fetch(`/api/materials${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const result = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(result?.error || 'Inventory request failed.');
    return result;
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [materialRows, categoryRows, supplierRows, purchaseRows, reportRows, reorderRows] = await Promise.all([
        request(''),
        request('/categories'),
        fetch('/api/suppliers').then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Could not load suppliers.');
          return data;
        }),
        fetch('/api/records/purchases').then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load purchases.'); return data; }),
        request('/reports'),
        request('/reorder-suggestions')
      ]);
      setMaterials(materialRows);
      setCategories(categoryRows);
      setSuppliers(supplierRows);
      setPurchases(purchaseRows);
      setReports(reportRows);
      setSuggestions(reorderRows);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function previewCsv(file) {
    if (!file) return;
    try {
      const csv = await file.text();
      const response = await fetch('/api/materials/import/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csv }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not preview import.');
      setImportPreview(data);
    } catch (e) { setError(e.message); }
  }

  async function applyImport() {
    if (!importPreview || importPreview.invalid) return;
    await act(async () => {
      const response = await fetch('/api/materials/import/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: importPreview.rows }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Import failed.');
      setImportPreview(null);
    }, 'CSV changes applied. Stock quantities were not changed.');
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => materials.filter((material) => {
    const matchesFilter = filter === 'all' || (filter === 'active' ? material.active !== false : material.active === false)
      || (filter === 'low' && material.active !== false && Number(material.quantity) <= Number(material.reorderLevel));
    const text = `${material.name} ${material.category} ${material.unit} ${material.supplierNameSnapshot || ''}`.toLowerCase();
    return matchesFilter && text.includes(search.toLowerCase());
  }).slice().sort((a, b) => sort === 'quantity'
    ? Number(a.quantity || 0) - Number(b.quantity || 0)
    : String(a.name || '').localeCompare(String(b.name || ''))), [materials, filter, search, sort]);
  const lowCount = materials.filter((material) => material.active !== false && Number(material.quantity) <= Number(material.reorderLevel)).length;
  const reorderGroups = useMemo(() => {
    const groups = new Map();
    suggestions.forEach((material) => {
      const key = material.preferredSupplierId || 'none';
      if (!groups.has(key)) groups.set(key, { name: material.preferredSupplierName, supplierId: material.preferredSupplierId, rows: [] });
      groups.get(key).rows.push(material);
    });
    return [...groups.values()];
  }, [suggestions]);
  const inventoryValue = materials.reduce((sum, material) => sum + Number(material.quantity || 0) * Number(material.avgCost || 0), 0);

  async function act(action, success) {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
      setDialog(null);
      showNotice(success);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function createReorderOrder(group) {
    if (!group.supplierId) { setError('Assign a preferred supplier to these materials before creating a purchase order.'); return; }
    await act(async () => {
      const body = {
        supplierId: group.supplierId, orderDate: today(), notes: 'Created from Materials reorder suggestions.',
        lines: group.rows.map((material) => ({ materialId: material.id, qty: material.suggestedQty, unitCost: material.latestUnitCost }))
      };
      const response = await fetch('/api/purchases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const order = await response.json();
      if (!response.ok) throw new Error(order.error || 'Could not create the purchase order.');
      try {
        const placeResponse = await fetch(`/api/purchases/${order.id}/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        const result = await placeResponse.json();
        if (!placeResponse.ok) throw new Error(result.error || 'Could not place the purchase order.');
      } catch (error) {
        throw new Error(`${error.message} Draft ${order.number} was saved and can be placed from Purchases.`);
      }
    }, 'Reorder purchase order created. Stock will change when its receipt is submitted.');
  }

  async function openHistory(material) {
    setError('');
    setDialog({ type: 'history', material, movements: null });
    try {
      const movements = await request(`/${material.id}/movements`);
      setDialog((current) => current?.type === 'history' && current.material.id === material.id ? { ...current, movements } : current);
    } catch (e) { setDialog((current) => current?.type === 'history' && current.material.id === material.id ? { ...current, historyError: e.message } : current); }
  }

  function saveMaterial(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      name: form.name, category: form.category, unit: form.unit,
      rollWidth: form.rollWidth, rollWidthUnit: form.rollWidthUnit,
      reorderLevel: Number(form.reorderLevel || 0), supplierId: form.supplierId,
      active: form.active === 'true'
    };
    if (dialog.type === 'create') {
      body.openingQuantity = Number(form.openingQuantity || 0);
      body.openingUnitCost = Number(form.openingUnitCost || 0);
      body.openingDate = form.openingDate;
      body.openingNote = form.openingNote;
    }
    act(() => request(dialog.type === 'edit' ? `/${dialog.material.id}` : '', dialog.type === 'edit' ? 'PATCH' : 'POST', body), dialog.type === 'edit' ? 'Material details saved.' : 'Material added.');
  }

  async function saveCategory(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      await request('/categories', 'POST', { name: form.name });
      await load();
      setCategoryDialog(false);
      showNotice('Material category added.');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  function saveMovement(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      type: dialog.movementType,
      date: form.date,
      note: form.note,
      idempotencyKey: idempotencyKey()
    };
    if (dialog.movementType === 'adjustment') body.countedQuantity = Number(form.countedQuantity);
    else body.quantity = Number(form.quantity);
    if (['purchase_in', 'return_in'].includes(dialog.movementType)) body.unitCost = form.unitCost;
    if (dialog.movementType === 'purchase_in') {
      body.referenceType = form.purchaseId ? 'purchase' : '';
      body.referenceId = form.purchaseId || '';
    }
    if (dialog.movementType === 'reversal') {
      body.change = -Number(dialog.originalMovement.change);
      body.unitCost = form.unitCost;
      body.referenceType = 'reversal';
      body.referenceId = dialog.originalMovement.id;
    }
    act(() => request(`/${dialog.material.id}/movements`, 'POST', body), `${dialog.movementLabel} movement saved.`);
  }

  return <section className="materials-page">
    <header className="materials-heading"><div><div className="t-eyebrow">RAW MATERIALS</div><h1 className="t-page-title">Materials</h1><p>Track stock levels, suppliers, and the supplies used on customer orders.</p></div><div className="materials-header-actions"><button className="btn btn-secondary" onClick={() => setCategoryDialog(true)}><AppIcon icon={Plus} size="sm" /> Add category</button><button className="btn btn-secondary" onClick={() => setDialog({ type: 'create' })}><AppIcon icon={Plus} size="sm" /> Add material</button></div></header>
    {error && <Alert variant="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
    {notice && <Alert variant="success">{notice}</Alert>}
    <div className="materials-summary"><article><span>Materials</span><strong>{materials.length}</strong></article><article><span>Low or out of stock</span><strong>{lowCount}</strong></article><article><span>Estimated inventory value</span><strong>{money(inventoryValue)}</strong></article></div>
    <div className="materials-panel"><div className="materials-toolbar"><div><h2>Counts and reports</h2><p>Physical counts post adjustment movements; reports are derived from the stock ledger.</p></div><div className="materials-filters"><a className="btn btn-primary" href="/api/materials/export.csv">Export CSV</a><label className="btn btn-primary">Preview CSV import<input aria-label="Preview CSV import" type="file" accept=".csv,text/csv" onChange={(event) => previewCsv(event.target.files?.[0])} hidden /></label></div></div><div className="materials-report-grid"><section><h3>Waste history</h3>{reports?.waste?.length ? reports.waste.map((movement) => <p key={movement.id}>{movement.date} · {movement.materialName} · {quantity(Math.abs(movement.change))} · {movement.note}</p>) : <p>No waste movements recorded.</p>}</section><section><h3>Valuation</h3>{materials.map((material) => <p key={material.id}>{material.name} · {money(Number(material.quantity || 0) * Number(material.avgCost || 0))}</p>)}</section></div>{importPreview && <div className="csv-preview"><h3>CSV import preview</h3><p>{importPreview.valid} valid · {importPreview.invalid} invalid. Imports update material details only; stock changes require a submitted receipt or adjustment.</p><div className="csv-preview-rows">{importPreview.rows.map((row) => <p key={row.row} className={row.valid ? '' : 'invalid'}>Row {row.row}: {row.valid ? `${row.name} — valid` : row.error}</p>)}</div><button disabled={busy || importPreview.invalid > 0 || !importPreview.valid} className="btn btn-secondary" onClick={applyImport}>Apply import</button> <button className="btn btn-secondary" disabled={busy} onClick={() => setImportPreview(null)}>Cancel</button></div>}</div>
    <div className="materials-panel">
      <div className="materials-toolbar"><div><h2>Stock on hand</h2><p>{visible.length} {visible.length === 1 ? 'material' : 'materials'} · Balances change only through recorded stock movements.</p></div><div className="materials-filters"><label><span className="sr-only">Search materials</span><input className="input input-sm" aria-label="Search materials" placeholder="Search materials…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><select className="select" aria-label="Filter materials" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All materials</option><option value="active">Active</option><option value="low">Low stock</option><option value="inactive">Inactive</option></select><select className="select" aria-label="Sort materials" value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Name A–Z</option><option value="quantity">Lowest stock</option></select></div></div>
      {loading ? <div className="materials-empty">Loading materials…</div> : !visible.length ? <div className="materials-empty"><strong>{materials.length ? 'No matching materials' : 'No materials yet'}</strong><p>{materials.length ? 'Change the search or stock filter.' : 'Add a raw material to start tracking stock.'}</p>{!materials.length && <button className="btn btn-secondary" onClick={() => setDialog({ type: 'create' })}><AppIcon icon={Plus} size="sm" /> Add material</button>}</div> : <div className="material-cards">{visible.map((material) => {
        const quantityOnHand = Number(material.quantity || 0);
        const outOfStock = material.active !== false && quantityOnHand <= 0;
        const low = material.active !== false && quantityOnHand <= Number(material.reorderLevel);
        return <article className="material-card" key={material.id}>
          <header className="material-card-heading"><span className="material-avatar">{String(material.name || 'M').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('')}</span><div className="material-card-name"><strong>{material.name}</strong><span>{material.category || 'Uncategorized'}{material.rollWidth > 0 ? ` · ${material.rollWidth} ${material.rollWidthUnit} wide` : ''}</span></div><span className={`materials-status ${material.active === false ? 'inactive' : outOfStock ? 'out-of-stock' : low ? 'low' : 'active'}`}>{material.active === false ? 'Inactive' : outOfStock ? 'Out of stock' : low ? 'Low stock' : 'In stock'}</span></header>
          <div className="material-stock-highlight"><span>On hand</span><strong>{quantity(material.quantity)} <small>{material.unit}</small></strong><span className="material-reorder-copy">Reorder at {quantity(material.reorderLevel)} {material.unit}</span></div>
          <div className="material-card-extras"><div><span>Supplier</span><strong>{material.supplierNameSnapshot || 'No supplier'}</strong></div><div><span>Average cost</span><strong>{money(material.avgCost)} / {material.unit}</strong></div><div><span>Stock value</span><strong>{money(Number(material.quantity || 0) * Number(material.avgCost || 0))}</strong></div></div>
          <footer className="material-card-actions"><button className="btn material-receive-action btn-secondary btn-sm" onClick={() => setDialog({ type: 'movement', material, movementType: 'purchase_in', movementLabel: 'Receive stock' })}>Receive</button><button className="btn btn-secondary btn-sm" onClick={() => setDialog({ type: 'movement', material, movementType: 'job_use', movementLabel: 'Record use' })}>Use</button><button className="btn btn-secondary btn-sm" onClick={() => setDialog({ type: 'movement', material, movementType: 'waste', movementLabel: 'Record waste' })}>Waste</button><button className="btn btn-secondary btn-sm" onClick={() => setDialog({ type: 'movement', material, movementType: 'adjustment', movementLabel: 'Adjust count' })}>Adjust</button><button className="btn btn-secondary btn-sm" onClick={() => setDialog({ type: 'movement', material, movementType: 'return_in', movementLabel: 'Return to stock' })}>Return</button><button className="btn btn-secondary btn-sm" onClick={() => openHistory(material)}>History</button><button className="btn btn-secondary btn-sm" onClick={() => setDialog({ type: 'edit', material })}>Edit</button><button className="btn btn-secondary btn-sm" onClick={() => setToggleTarget(material)}>{material.active === false ? 'Activate' : 'Deactivate'}</button></footer>
        </article>;
      })}</div>}
    </div>

    <div className="materials-panel reorder-panel"><div className="materials-toolbar"><div><h2>Reorder suggestions</h2><p>Below-level materials grouped by preferred supplier. Suggested quantities return stock to a practical target level.</p></div></div>{!reorderGroups.length ? <div className="materials-empty">No materials need reordering.</div> : reorderGroups.map((group) => <section className="reorder-group" key={group.supplierId || 'none'}><h3>{group.name} <span>{group.rows.length}</span></h3><div>{group.rows.map((material) => <article key={material.id}><div><strong>{material.name}</strong><small>{quantity(material.quantity)} {material.unit} on hand · reorder level {quantity(material.reorderLevel)} · suggest {quantity(material.suggestedQty)} {material.unit} · unit cost {money(material.latestUnitCost)}</small></div></article>)}</div><button className="btn btn-secondary" disabled={busy || !group.supplierId} title={!group.supplierId ? 'Assign a supplier before creating a PO' : ''} onClick={() => createReorderOrder(group)}>Create PO</button></section>)}</div>

    {dialog && <Dialog open onOpenChange={(open) => { if (!open && !busy) setDialog(null); }}><DialogContent size={dialog.type === 'history' ? 'lg' : 'md'} busy={busy}>
      {(dialog.type === 'create' || dialog.type === 'edit') && <form className="dialog-form material-form" onSubmit={saveMaterial}>
        <DialogHeader><DialogTitle>{dialog.type === 'edit' ? 'Edit material details' : 'Add material'}</DialogTitle><DialogDescription>Quantity and average cost are maintained by the stock ledger.</DialogDescription><DialogClose disabled={busy} /></DialogHeader>
        <DialogBody>
        <label>Name<input className="input" name="name" required maxLength="120" defaultValue={dialog.material?.name || ''} /></label>
        <label>Category<select className="select" name="category" required defaultValue={dialog.material?.category || ''}><option value="">Choose category</option>{categories.map((category) => <option value={category.name} key={category.name}>{category.name}</option>)}</select></label>
        <div className="materials-form-row"><label>Base unit<input className="input" name="unit" required maxLength="24" placeholder="m, pc, bottle…" defaultValue={dialog.material?.unit || ''} /></label><label>Reorder level<input className="input" name="reorderLevel" type="number" min="0" max="99999999" step="0.001" defaultValue={dialog.material?.reorderLevel ?? 0} /></label></div>
        <div className="materials-form-row"><label>Roll width (optional)<input className="input" name="rollWidth" type="number" min="0" step="0.001" defaultValue={dialog.material?.rollWidth || ''} /></label><label>Width unit<select className="select" name="rollWidthUnit" defaultValue={dialog.material?.rollWidthUnit || 'ft'}><option value="ft">feet</option><option value="m">meters</option><option value="in">inches</option><option value="cm">centimeters</option><option value="mm">millimeters</option></select></label></div>
        <label>Supplier<select className="select" name="supplierId" defaultValue={dialog.material?.supplierId || ''}><option value="">No supplier selected</option>{suppliers.map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
        {dialog.type === 'edit' ? <label className="materials-check"><input type="checkbox" name="active" value="true" defaultChecked={dialog.material.active !== false} /> Active material</label> : <>
          <h3>Opening stock (optional)</h3><div className="materials-form-row"><label>Starting quantity<input className="input" name="openingQuantity" type="number" min="0" step="0.001" defaultValue="0" /></label><label>Unit cost<input className="input" name="openingUnitCost" type="number" min="0" step="0.0001" defaultValue="0" /></label></div>
          <div className="materials-form-row"><label>Opening date<input className="input" name="openingDate" type="date" defaultValue={today()} /></label><label>Note<input className="input" name="openingNote" defaultValue="Opening balance" maxLength="500" /></label></div>
        </>}
        </DialogBody><DialogFooter><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} aria-busy={busy || undefined}>{busy ? 'Saving…' : dialog.type === 'edit' ? 'Save details' : 'Add material'}</button></DialogFooter>
      </form>}

      {dialog.type === 'movement' && <form className="dialog-form material-form" onSubmit={saveMovement}>
        <DialogHeader><DialogTitle>{dialog.movementLabel}</DialogTitle><DialogDescription><strong>{dialog.material.name}</strong> · Current balance: {quantity(dialog.material.quantity)} {dialog.material.unit}</DialogDescription><DialogClose disabled={busy} /></DialogHeader>
        <DialogBody>
        {dialog.movementType === 'adjustment' ? <label>Counted quantity<input className="input" name="countedQuantity" type="number" min="0" step="0.001" defaultValue={dialog.material.quantity} required /></label> : <label>Quantity ({dialog.material.unit})<input className="input" name="quantity" type="number" min="0.001" step="0.001" required /></label>}
        {['purchase_in', 'return_in', 'reversal'].includes(dialog.movementType) && <label>Unit cost (PHP / {dialog.material.unit})<input className="input" name="unitCost" type="number" min="0" step="0.0001" defaultValue={dialog.material.avgCost || 0} required /></label>}
        {dialog.movementType === 'purchase_in' && <label>Purchase record (optional)<select className="select" name="purchaseId" defaultValue=""><option value="">No purchase record</option>{purchases.map((purchase) => <option value={purchase.id} key={purchase.id}>{purchase.name || purchase.supplier || 'Purchase'} · {purchase.date || ''}</option>)}</select></label>}
        <label>Date<input className="input" name="date" type="date" defaultValue={today()} required /></label>
        <label>{dialog.movementType === 'waste' ? 'Reason' : dialog.movementType === 'adjustment' ? 'Adjustment reason' : 'Note'}<textarea className="textarea" name="note" maxLength="500" required={['waste', 'adjustment'].includes(dialog.movementType)} placeholder={dialog.movementType === 'waste' ? 'Misprint, damaged offcut…' : ''} /></label>
        {dialog.movementType === 'adjustment' && <p className="materials-help">The movement will be the difference between this count and the current balance.</p>}
        </DialogBody><DialogFooter><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setDialog(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} aria-busy={busy || undefined}>{busy ? 'Saving…' : `Save ${dialog.movementLabel.toLowerCase()}`}</button></DialogFooter>
      </form>}

      {dialog.type === 'history' && <div className="dialog-form material-form"><DialogHeader><DialogTitle>Stock movement history</DialogTitle><DialogDescription><strong>{dialog.material.name}</strong> · Current balance: {quantity(dialog.material.quantity)} {dialog.material.unit}</DialogDescription><DialogClose /></DialogHeader><DialogBody>{dialog.historyError ? <Alert variant="error">{dialog.historyError}</Alert> : dialog.movements === null ? <div className="materials-empty">Loading movement history…</div> : !dialog.movements.length ? <div className="materials-empty">No movements recorded.</div> : <div className="materials-history-list">{dialog.movements.map((movement) => <article key={movement.id}><div><strong>{movement.type.replace('_', ' ')}</strong><time>{movement.date}</time></div><div><span className={movement.change < 0 ? 'negative' : 'positive'}>{movement.change > 0 ? '+' : ''}{quantity(movement.change)} {dialog.material.unit}</span><span>Balance: {quantity(movement.balanceAfter)} {dialog.material.unit}</span></div><p>{movement.note || '—'}</p><small>{money(movement.totalCost)} at {money(movement.unitCost)} / {dialog.material.unit}</small>{movement.type === 'purchase_in' && <button className="btn btn-secondary" onClick={() => setDialog({ type: 'movement', material: dialog.material, movementType: 'reversal', movementLabel: 'Reverse receipt', originalMovement: movement })}>Reverse receipt</button>}</article>)}</div>}</DialogBody><DialogFooter><button className="btn btn-secondary" type="button" onClick={() => setDialog(null)}>Close</button></DialogFooter></div>}
    </DialogContent></Dialog>}
    {categoryDialog && <Dialog open onOpenChange={(open) => { if (!open && !busy) setCategoryDialog(false); }}><DialogContent size="md" busy={busy}><form className="dialog-form material-form category-dialog" onSubmit={saveCategory}><DialogHeader><DialogTitle>Add material category</DialogTitle><DialogDescription>Create a category to use when adding or editing materials.</DialogDescription><DialogClose disabled={busy} /></DialogHeader><DialogBody><label>Category name<input className="input" name="name" required maxLength="80" autoFocus placeholder="Vinyl, laminate, ink…" /></label></DialogBody><DialogFooter><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setCategoryDialog(false)}>Cancel</button><button className="btn btn-primary" disabled={busy} aria-busy={busy || undefined}>{busy ? 'Saving…' : 'Add category'}</button></DialogFooter></form></DialogContent></Dialog>}
    <ConfirmDialog open={Boolean(toggleTarget)} title={`${toggleTarget?.active === false ? 'Activate' : 'Deactivate'} ${toggleTarget?.name || ''}?`} description="" confirmLabel={toggleTarget?.active === false ? 'Activate' : 'Deactivate'} busy={busy} onCancel={() => setToggleTarget(null)} onConfirm={async () => { const material = toggleTarget; await act(() => request(`/${material.id}`, 'PATCH', { active: material.active === false }), material.active === false ? 'Material activated.' : 'Material deactivated.'); setToggleTarget(null); }} />
  </section>;
}
