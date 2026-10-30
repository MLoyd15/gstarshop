import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/icons.jsx';
import { Plus } from '../components/icons.jsx';
import '../styles/BookingsPage.css';
import { Alert } from '../components/ui/alert.tsx';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);
const completed = (booking) => booking.completion?.status === 'completed';

async function request(url, options) {
  const response = await fetch(url, options);
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || 'The request could not be completed.');
  return data;
}

export default function BookingsPage({ title, records, loading, search, setSearch, onCreate, onEdit, onDelete }) {
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [lines, setLines] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [confirmReturned, setConfirmReturned] = useState(false);
  const [date, setDate] = useState(today());
  const [refresh, setRefresh] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('latest');
  const [recipeProductId, setRecipeProductId] = useState('');
  const [recipeQuantity, setRecipeQuantity] = useState(1);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNote, setPaymentNote] = useState('');
  const [allowOverpayment, setAllowOverpayment] = useState(false);
  const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState('');

  useEffect(() => {
    request('/api/materials?active=true').then(setMaterials).catch((e) => setError(e.message));
    request('/api/products').then(setProducts).catch((e) => setError(e.message));
  }, [refresh]);
  const visible = useMemo(() => records
    .filter((record) => Object.values(record).some((value) => String(value ?? '').toLowerCase().includes(search.toLowerCase())))
    .filter((record) => statusFilter === 'all' || (statusFilter === 'completed' ? completed(record) : !completed(record) && !['cancelled', 'canceled'].includes(String(record.status || '').toLowerCase())))
    .slice().sort((a, b) => sort === 'name'
      ? String(a.name || '').localeCompare(String(b.name || ''))
      : new Date(b.date || b.updatedAt || b.createdAt || 0) - new Date(a.date || a.updatedAt || a.createdAt || 0)), [records, search, sort, statusFilter]);

  function openMaterials(booking) {
    setError(''); setDialog({ type: 'plan', booking });
    setLines((booking.materialPlan || []).map((line) => ({ ...line })));
    setRecipeProductId(''); setRecipeQuantity(1);
  }
  function addLine() {
    const material = materials.find((item) => !lines.some((line) => line.materialId === item.id));
    setLines((previous) => [...previous, { lineId: crypto.randomUUID(), materialId: material?.id || '', plannedQuantity: '' }]);
  }
  function openComplete(booking) {
    setError(''); setDate(today()); setDialog({ type: 'complete', booking });
    setLines((booking.materialPlan || []).map((line) => ({ ...line, usedQuantity: String(line.plannedQuantity), wasteQuantity: '0' })));
  }
  function openPayment(booking) {
    setError(''); setDate(today()); setPaymentAmount(''); setPaymentMethod('Cash'); setPaymentNote(''); setAllowOverpayment(false); setPaymentIdempotencyKey(crypto.randomUUID());
    setDialog({ type: 'payment', booking });
  }
  function openVoidPayment(booking, payment) {
    setError(''); setReason(''); setDialog({ type: 'void-payment', booking, payment });
  }
  function openPaymentHistory(booking) { setError(''); setDialog({ type: 'payment-history', booking }); }
  function openConfirmHistory(booking) {
    setError(''); setDialog({ type: 'confirm-history', booking });
  }
  function updateLine(index, patch) { setLines((previous) => previous.map((line, i) => i === index ? { ...line, ...patch } : line)); }
  function addProductRecipe() {
    const product = products.find((item) => item.id === recipeProductId);
    const multiplier = Number(recipeQuantity);
    if (!product?.recipe?.length) { setError('Choose a product that has a material recipe.'); return; }
    if (!Number.isFinite(multiplier) || multiplier <= 0) { setError('Enter a product quantity greater than zero.'); return; }
    setError('');
    setLines((previous) => {
      const next = previous.map((line) => ({ ...line }));
      for (const recipeLine of product.recipe) {
        const quantity = Number(recipeLine.qtyPerUnit) * multiplier;
        const existing = next.find((line) => line.materialId === recipeLine.materialId);
        if (existing) existing.plannedQuantity = Number(existing.plannedQuantity || 0) + quantity;
        else next.push({ lineId: crypto.randomUUID(), materialId: recipeLine.materialId, materialName: recipeLine.materialName, unit: recipeLine.unit, plannedQuantity: quantity });
      }
      return next;
    });
  }
  async function submit(url, body) {
    setBusy(true); setError('');
    try {
      const method = dialog.type === 'plan' ? 'PATCH' : dialog.type === 'void-payment' ? 'DELETE' : 'POST';
      await request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setDialog(null); setRefresh((n) => n + 1); window.location.reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  const estimated = lines.reduce((sum, line) => {
    const item = materials.find((material) => material.id === line.materialId);
    return sum + (Number(line.usedQuantity) + Number(line.wasteQuantity)) * Number(item?.avgCost || 0);
  }, 0);

  return <div className="records-page bookings-page">
    <div className="welcome-row records-welcome"><div><div className="t-eyebrow"><span className="accent-line" />BUSINESS HUB</div><h1 className="t-page-title">{title || 'Bookings'}</h1><p>Plan material use and record actual use when each job is complete.</p></div><button className="btn btn-secondary" onClick={onCreate}><AppIcon icon={Plus} size="sm" /> Add booking</button></div>
    <div className="records-summary"><div><span className="summary-label">Bookings</span><strong>{records.length}</strong></div><div><span className="summary-label">Completed jobs</span><strong>{records.filter(completed).length}</strong></div><div><span className="summary-label">Saved material cost</span><strong>{money(records.reduce((sum, booking) => sum + (completed(booking) ? Number(booking.completion.materialCost || 0) : 0), 0))}</strong></div></div>
    {error && !dialog && <Alert variant="error">{error}</Alert>}
    <section className="panel records-panel booking-directory"><header className="booking-toolbar"><div><h2>Booking directory</h2><p>{visible.length} {visible.length === 1 ? 'booking' : 'bookings'} · Stock changes only when a job is completed.</p></div><div className="booking-filters"><label><span className="sr-only">Search bookings</span><input className="input input-sm" aria-label="Search bookings" placeholder="Search bookings…" value={search} onChange={(e) => setSearch(e.target.value)} /></label><select className="select" aria-label="Filter booking status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="completed">Completed</option></select><select className="select" aria-label="Sort bookings" value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">Latest date</option><option value="name">Name A–Z</option></select></div></header>
      {loading ? <div className="booking-empty">Loading bookings…</div> : !visible.length ? <div className="booking-empty"><strong>{records.length ? 'No matching bookings' : 'No bookings yet'}</strong><p>{records.length ? 'Change the search or status filter.' : 'Add a booking to start planning materials and tracking job completion.'}</p>{!records.length && <button className="btn btn-secondary" onClick={onCreate}><AppIcon icon={Plus} size="sm" /> Add booking</button>}</div> : <div className="booking-cards">{visible.map((booking) => {
        const isComplete = completed(booking);
        const initials = String(booking.client || booking.name || 'BK').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('');
        return <article className="booking-card" key={booking.id}>
          <header className="booking-card-heading"><span className="booking-avatar">{initials || 'BK'}</span><div className="booking-card-name"><strong>{booking.name || 'Untitled booking'}</strong><span>{booking.client || 'No client assigned'} · {booking.date || 'No date set'}</span></div><span className={`booking-state ${isComplete ? 'completed' : String(booking.status || 'active').toLowerCase().replace(/\s+/g, '-')}`}>{isComplete ? 'Completed' : booking.status || 'Active'}</span></header>
          <div className="booking-payment-summary"><div><span>Paid</span><strong>{money(booking.paidAmount || 0)}</strong></div><div><span>Balance</span><strong>{money(booking.balance ?? booking.amount ?? 0)}</strong></div><div><span>Payment status</span><strong className={`booking-payment-status ${booking.paymentStatus || 'unpaid'}`}>{booking.paymentStatus || 'unpaid'}</strong></div>{!booking.paymentLedgerVerified && <small className="booking-legacy-payment-note">Legacy payment history is unverified. Add any earlier payments to correct the balance.</small>}</div>
          {isComplete && <div className={`booking-revenue-snapshot${booking.completion.revenueSource === 'migration-current-booking-amount' ? ' migrated' : ''}`}><span>Sales revenue snapshot</span><strong>{money(booking.completion.revenueAmount || 0)}</strong><small>{booking.completion.revenueSource === 'migration-current-booking-amount' ? 'Migrated from current booking amount · verify historical value' : 'Captured at completion'}</small></div>}
          <div className="booking-highlight"><span>{isComplete ? 'Material cost' : 'Planned materials'}</span><strong>{isComplete ? money(booking.completion.materialCost) : `${(booking.materialPlan || []).length} items`}</strong><small>{isComplete ? 'Recorded on completion' : 'Stock unchanged'}</small></div>
          <div className="booking-material-summary"><span className="booking-section-label">{isComplete ? 'Actual use and waste' : 'Material plan'}</span>{isComplete ? (booking.completion.materials || []).map((line, index) => <p key={line.lineId || index}><strong>{line.materialName}</strong><span>{line.usedQuantity} used · {line.wasteQuantity} waste {line.unit}</span></p>) : (booking.materialPlan || []).length ? booking.materialPlan.map((line) => <p key={line.lineId}><strong>{line.materialName}</strong><span>{line.plannedQuantity} {line.unit} planned</span></p>) : <p className="booking-no-materials">No materials planned yet.</p>}</div>
          {booking.payments?.length > 0 && <button className="booking-history-trigger" type="button" onClick={() => openPaymentHistory(booking)}>Payment history <span>{booking.payments.length}</span><span aria-hidden="true">View&nbsp;›</span></button>}
          {!isComplete && !(Number(booking.amount) > 0) && <p className="booking-amount-warning">Add a positive booking amount before completing this job.</p>}
          <footer className="booking-card-actions">{!isComplete && <><button className="btn btn-secondary btn-sm" onClick={() => onEdit(booking)}>Edit</button><button className="btn btn-secondary btn-sm" onClick={() => openMaterials(booking)}>Materials</button><button className="btn booking-complete-action btn-secondary btn-sm" onClick={() => openComplete(booking)} disabled={!booking.materialPlan?.length || !(Number(booking.amount) > 0)}>Complete job</button></>}{isComplete && <button className="btn booking-complete-action btn-secondary btn-sm" onClick={() => { setError(''); setReason(''); setConfirmReturned(false); setDate(today()); setDialog({ type: 'reverse', booking }); }}>Correct completion</button>}<button className="btn booking-delete-action btn-secondary btn-sm" onClick={() => onDelete(booking)}>Delete</button><button className="btn btn-secondary btn-sm" type="button" onClick={() => openPayment(booking)} disabled={['cancelled', 'canceled'].includes(String(booking.status || '').toLowerCase())}><AppIcon icon={Plus} size="sm" /> Payment</button>{!booking.paymentLedgerVerified && <button className="btn btn-secondary btn-sm" type="button" onClick={() => openConfirmHistory(booking)}>Confirm payment history</button>}</footer>
        </article>;
      })}</div>}
    </section>
    {dialog && <Dialog open onOpenChange={(open) => { if (!open && !busy) setDialog(null); }}><DialogContent size="md" busy={busy} className="booking-shell" onPointerDownOutside={(event) => event.preventDefault()}>
      <DialogHeader className="booking-header"><div><span className="t-eyebrow">{dialog.booking.name || 'Booking'}</span><DialogTitle>{dialog.type === 'plan' ? 'Planned materials' : dialog.type === 'complete' ? 'Complete job' : dialog.type === 'reverse' ? 'Correct completed job' : dialog.type === 'payment' ? 'Record customer payment' : dialog.type === 'payment-history' ? 'Payment history' : dialog.type === 'void-payment' ? 'Void customer payment' : 'Confirm payment history'}</DialogTitle></div><DialogClose disabled={busy} /></DialogHeader>
      <DialogBody className="booking-body">
      {dialog.type === 'payment-history' && <div className="booking-payment-history">{dialog.booking.payments.map((payment) => <div className={`booking-payment-row${payment.voidedAt ? ' voided' : ''}`} key={payment.id}><span><strong>{money(payment.amount)}</strong><small>{payment.date} · {payment.method}{payment.note ? ` · ${payment.note}` : ''}</small>{payment.voidedAt && <small>Voided: {payment.voidReason}</small>}</span>{!payment.voidedAt && <button className="btn btn-secondary btn-sm" type="button" onClick={() => openVoidPayment(dialog.booking, payment)}>Void</button>}</div>)}</div>}
      {dialog.type === 'plan' && <><p>Planned quantities are saved with the booking and do not change stock.</p><div className="booking-recipe-picker"><label>Product recipe<select className="select" value={recipeProductId} onChange={(e) => setRecipeProductId(e.target.value)}><option value="">Select a product recipe</option>{products.filter((product) => product.recipe?.length).map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.unitCost)} material cost / {product.unit}</option>)}</select></label><label>Quantity<input className="input" aria-label="Product quantity" type="number" min="0.001" step="0.001" value={recipeQuantity} onChange={(e) => setRecipeQuantity(e.target.value)} /></label><button type="button" className="btn btn-secondary" onClick={addProductRecipe}>Add recipe to plan</button>{recipeProductId && products.find((product) => product.id === recipeProductId) && <small>Recipe estimate: {money(Number(products.find((product) => product.id === recipeProductId).unitCost || 0) * Number(recipeQuantity || 0))} for this quantity</small>}</div>{lines.map((line, index) => <div className="booking-material-line" key={line.lineId}><select className="select" value={line.materialId} onChange={(e) => updateLine(index, { materialId: e.target.value })}><option value="">Select material</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}</select><input className="input" aria-label="Planned quantity" type="number" min="0.001" step="0.001" value={line.plannedQuantity} onChange={(e) => updateLine(index, { plannedQuantity: e.target.value })} placeholder="Planned qty"/><button className="btn btn-secondary" type="button" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}>Remove</button></div>)}<button type="button" className="btn btn-secondary" onClick={addLine}><AppIcon icon={Plus} size="sm" /> Add material</button></>}
      {dialog.type === 'complete' && <><p>Enter actual quantities. Stock is deducted now using each material’s current average cost.</p>{lines.map((line, index) => <div className="booking-actual-line" key={line.lineId}><strong>{line.materialName} <small>({line.unit})</small></strong><label>Used<input className="input" type="number" min="0" step="0.001" value={line.usedQuantity} onChange={(e) => updateLine(index, { usedQuantity: e.target.value })}/></label><label>Waste<input className="input" type="number" min="0" step="0.001" value={line.wasteQuantity} onChange={(e) => updateLine(index, { wasteQuantity: e.target.value })}/></label></div>)}<label className="booking-full-field">Completion date<input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)}/></label><div className="booking-cost-preview">Estimated material cost <strong>{money(estimated)}</strong></div></>}
      {dialog.type === 'reverse' && <><p>This restores all quantities deducted by this completion and adds linked reversing movements to stock history.</p><label className="booking-check"><input type="checkbox" checked={confirmReturned} onChange={(e) => setConfirmReturned(e.target.checked)}/>I confirm all recorded material is physically returned and reusable.</label><label className="booking-full-field">Correction reason<textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} maxLength="500"/></label><label className="booking-full-field">Correction date<input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)}/></label></>}
      {dialog.type === 'payment' && <><p>Booking value: <strong>{money(dialog.booking.amount)}</strong> · Balance: <strong>{money(dialog.booking.balance ?? dialog.booking.amount)}</strong></p>{!dialog.booking.paymentLedgerVerified && <p className="booking-form-warning">This is a legacy booking. Enter any earlier customer payments too; old status values are not treated as payment records.</p>}<label className="booking-full-field">Payment date<input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><label className="booking-full-field">Amount<input className="input" type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} /></label><label className="booking-full-field">Method<select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option>Cash</option><option>Bank transfer</option><option>Cheque</option><option>Card</option><option>Other</option></select></label><label className="booking-full-field">Note (optional)<textarea className="textarea" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} maxLength="500" /></label><label className="booking-check"><input type="checkbox" checked={allowOverpayment} onChange={(e) => setAllowOverpayment(e.target.checked)} />Allow payment to exceed the booking amount</label></>}
      {dialog.type === 'void-payment' && <><p>Void {money(dialog.payment.amount)} paid on {dialog.payment.date}? This keeps the payment in the audit history.</p><label className="booking-full-field">Reason<textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} maxLength="500" /></label></>}
      {dialog.type === 'confirm-history' && <p>Only confirm after you have added every earlier customer payment for this booking. The app will then treat the displayed balance as verified. No payment will be created from the booking’s old status.</p>}
      {error && <Alert variant="error">{error}</Alert>}
      </DialogBody>
      <DialogFooter className="booking-footer"><button type="button" className="btn btn-secondary" onClick={() => setDialog(null)} disabled={busy}>Cancel</button>
        {dialog.type === 'plan' && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => submit(`/api/bookings/${dialog.booking.id}/materials`, { materials: lines.map(({ lineId, materialId, plannedQuantity }) => ({ lineId, materialId, plannedQuantity })) })}>Save plan</button>}
        {dialog.type === 'complete' && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => submit(`/api/bookings/${dialog.booking.id}/complete`, { date, materials: lines.map(({ lineId, usedQuantity, wasteQuantity }) => ({ lineId, usedQuantity, wasteQuantity })) })}>Complete job</button>}
        {dialog.type === 'reverse' && <button type="button" className="btn btn-secondary" disabled={busy || !confirmReturned || !reason.trim()} onClick={() => submit(`/api/bookings/${dialog.booking.id}/reverse-completion`, { date, reason, confirmReturned })}>Reverse completion</button>}
        {dialog.type === 'payment' && <button type="button" className="btn btn-secondary" disabled={busy || !paymentAmount || Number(paymentAmount) <= 0} onClick={() => submit(`/api/bookings/${dialog.booking.id}/payments`, { amount: paymentAmount, date, method: paymentMethod, note: paymentNote, idempotencyKey: paymentIdempotencyKey, allowOverpayment })}>Record payment</button>}
        {dialog.type === 'void-payment' && <button type="button" className="btn btn-secondary" disabled={busy || !reason.trim()} onClick={() => submit(`/api/bookings/${dialog.booking.id}/payments/${dialog.payment.id}`, { reason })}>Void payment</button>}
        {dialog.type === 'confirm-history' && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => submit(`/api/bookings/${dialog.booking.id}/payments/confirm-history`, { confirmed: true })}>Confirm complete history</button>}
      </DialogFooter>
    </DialogContent></Dialog>}
  </div>;
}
