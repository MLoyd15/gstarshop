import { useEffect, useState } from 'react';
import { Alert } from '../components/ui/alert.tsx';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { ConfirmDialog } from '../components/ui/alert-dialog.tsx';
import '../styles/SuppliersPage.css';

const initial = { name: '', contact: '', email: '', phone: '', leadTimeDays: 0, notes: '', status: 'active', suppliedMaterialIds: [] };
async function call(path, method = 'GET', body) {
  const response = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || 'Supplier request failed.');
  return data;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [form, setForm] = useState(null);
  const [detail, setDetail] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [rows, materialRows] = await Promise.all([call('/api/suppliers'), call('/api/materials')]);
    setSuppliers(rows);
    setMaterials(materialRows);
  }

  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await call(form.id ? `/api/suppliers/${form.id}` : '/api/suppliers', form.id ? 'PATCH' : 'POST', form);
      setNotice(form.id ? 'Supplier details updated.' : 'Supplier added.');
      setForm(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(supplier) {
    setError('');
    try {
      setDetail(await call(`/api/suppliers/${supplier.id}`));
    } catch (e) {
      setError(e.message);
    }
  }

  async function deleteSupplier() {
    if (!deleteTarget) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await call(`/api/suppliers/${deleteTarget.id}`, 'DELETE');
      setNotice(`Supplier "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setError(e.message);
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  }

  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const materialNames = new Map(materials.map((material) => [material.id, material.name]));

  return <section className="materials-page suppliers-page">
    <div className="materials-header">
      <div>
        <h1 className="t-page-title">Suppliers</h1>
        <p>Supplier contacts and purchasing history</p>
      </div>
      <button className="btn btn-primary" onClick={() => setForm({ ...initial })}>Add supplier</button>
    </div>

    {error && <Alert variant="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
    {notice && <Alert variant="success" dismissible onDismiss={() => setNotice('')}>{notice}</Alert>}

    <div className="materials-panel">
      <div className="materials-toolbar">
        <div>
          <h2>Suppliers</h2>
          <p>Supplier contacts and purchasing history.</p>
        </div>
      </div>
      {!suppliers.length ? <div className="materials-empty">No suppliers yet. Add a supplier to start creating purchase orders.</div> : <div className="materials-table-wrap"><table className="materials-table"><thead><tr><th>Supplier</th><th>Contact</th><th>Lead time</th><th>Status</th><th>Supplied materials</th><th /></tr></thead><tbody>
        {suppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.name}</strong><small>{supplier.email}</small></td><td>{supplier.contact || supplier.phone || '—'}</td><td>{supplier.leadTimeDays || 0} days</td><td>{supplier.status || 'active'}</td><td>{(supplier.suppliedMaterialIds || []).map((id) => materialNames.get(id)).filter(Boolean).join(', ') || '—'}</td><td className="suppliers-table-actions"><button className="btn btn-secondary btn-sm" onClick={() => openDetail(supplier)}>Details</button> <button className="btn btn-secondary btn-sm" onClick={() => setForm({ ...initial, ...supplier })}>Edit</button> <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(supplier)}>Delete</button></td></tr>)}
      </tbody></table></div>}
    </div>

    {form && <Dialog open onOpenChange={(open) => { if (!open && !busy) setForm(null); }}><DialogContent size="md" busy={busy}><form className="dialog-form" onSubmit={save}><DialogHeader><div><DialogTitle>{form.id ? 'Edit supplier' : 'Add supplier'}</DialogTitle><DialogDescription>Supplier identity and contact information</DialogDescription></div><DialogClose disabled={busy} /></DialogHeader><DialogBody><div className="materials-form-grid">
      <label>Supplier name<input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} /></label><label>Contact person<input className="input" value={form.contact || ''} onChange={(e) => set('contact', e.target.value)} /></label><label>Email<input className="input" type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} /></label><label>Phone<input className="input" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></label><label>Lead time (days)<input className="input" type="number" min="0" value={form.leadTimeDays ?? 0} onChange={(e) => set('leadTimeDays', e.target.value)} /></label><label>Status<select className="select" value={form.status || 'active'} onChange={(e) => set('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <label className="materials-form-wide">Supplied material<select className="select" value={form.suppliedMaterialIds?.[0] || ''} onChange={(e) => set('suppliedMaterialIds', e.target.value ? [e.target.value] : [])}><option value="">No material selected</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select></label><label className="materials-form-wide">Notes<textarea className="textarea" value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} /></label>
    </div></DialogBody><DialogFooter style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>{form.id ? <button type="button" className="btn btn-danger" disabled={busy} onClick={() => { const toDelete = form; setForm(null); setDeleteTarget(toDelete); }}>Delete supplier</button> : <span />}<div style={{ display: 'flex', gap: '8px' }}><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setForm(null)}>Cancel</button><button className="btn btn-primary" aria-busy={busy || undefined} disabled={busy}>{busy ? 'Saving…' : 'Save supplier'}</button></div></DialogFooter></form></DialogContent></Dialog>}

    {detail && <Dialog open onOpenChange={(open) => { if (!open) setDetail(null); }}><DialogContent size="md"><DialogHeader><div><DialogTitle>{detail.supplier.name}</DialogTitle><DialogDescription>{detail.supplier.email || detail.supplier.phone}</DialogDescription></div><DialogClose /></DialogHeader><DialogBody><h3>Supplied materials</h3><p>{detail.materials.map((m) => m.name).join(', ') || 'No materials linked.'}</p><h3>Purchase orders</h3>{detail.orders.map((order) => <p key={order.id}>{order.number} · {order.status} · {Number(order.subtotal).toFixed(2)}</p>)}<p><strong>Amount owed: {Number(detail.amountOwed).toFixed(2)}</strong></p><h3>Recent supplier prices</h3>{detail.prices.map((price) => <p key={price.id}>{price.materialName} · {Number(price.unitCost).toFixed(4)} · {price.effectiveDate}</p>)}{!detail.prices.length && <p>No received stock price history yet.</p>}</DialogBody><DialogFooter style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}><button type="button" className="btn btn-danger" onClick={() => { const toDelete = detail.supplier; setDetail(null); setDeleteTarget(toDelete); }}>Delete supplier</button><button className="btn btn-secondary" onClick={() => setDetail(null)}>Close</button></DialogFooter></DialogContent></Dialog>}

    <ConfirmDialog open={Boolean(deleteTarget)} title={`Delete ${deleteTarget?.name || 'supplier'}?`} description="This permanently deletes this supplier and its associated purchasing history. This action cannot be undone." confirmLabel="Delete supplier" busy={busy} onCancel={() => setDeleteTarget(null)} onConfirm={deleteSupplier} />
  </section>;
}
