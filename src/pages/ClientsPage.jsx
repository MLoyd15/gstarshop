import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/icons.jsx';
import { Plus } from '../components/icons.jsx';
import '../styles/ClientsPage.css';

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0);
const statusOf = (client) => String(client.status || 'Active').trim();
const isCancelled = (booking) => ['cancelled', 'canceled', 'void', 'refunded'].includes(String(booking.status || '').toLowerCase());
const collectedFrom = (booking) => (booking.payments || []).filter((payment) => !payment.voidedAt).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
const balanceOf = (booking) => Math.max(0, Number(booking.balance ?? booking.amount ?? 0));

export default function ClientsPage({ clients = [], loading, search = '', setSearch, onCreate, onEdit, onDelete }) {
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('name');
  const [bookings, setBookings] = useState([]);
  const [bookingsError, setBookingsError] = useState('');
  const [bookingsLoading, setBookingsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/records/bookings', { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load bookings.');
        setBookings(Array.isArray(result) ? result : result.bookings || result.records || []);
      })
      .catch((error) => { if (error.name !== 'AbortError') setBookingsError(error.message || 'Could not load bookings.'); })
      .finally(() => { if (!controller.signal.aborted) setBookingsLoading(false); });
    return () => controller.abort();
  }, []);

  const bookingsFor = (client) => bookings.filter((booking) => String(booking.client || '').trim().toLowerCase() === String(client.name || '').trim().toLowerCase());
  const activeCount = clients.filter((client) => !['inactive', 'archived'].includes(statusOf(client).toLowerCase())).length;
  const allCollected = bookings.reduce((sum, booking) => sum + collectedFrom(booking), 0);
  const allOutstanding = bookings.filter((booking) => !isCancelled(booking)).reduce((sum, booking) => sum + balanceOf(booking), 0);
  const listed = useMemo(() => clients
    .filter((client) => status === 'all' || (status === 'active' ? !['inactive', 'archived'].includes(statusOf(client).toLowerCase()) : ['inactive', 'archived'].includes(statusOf(client).toLowerCase())))
    .slice().sort((a, b) => sort === 'name'
      ? String(a.name || '').localeCompare(String(b.name || ''))
      : new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)), [clients, sort, status]);

  return <section className="clients-page">
    <header className="clients-welcome"><div><span className="t-eyebrow">CUSTOMER RELATIONSHIPS</span><h1 className="t-page-title">Clients</h1><p>Keep client details, booking value, and contact information together.</p></div><button className="btn btn-secondary" onClick={onCreate}><AppIcon icon={Plus} size="sm" /> Add client</button></header>
    <div className="clients-summary"><article><span>All clients</span><strong>{clients.length}</strong></article><article><span>Active clients</span><strong>{activeCount}</strong></article><article><span>Customer payments</span><strong>{money(allCollected)}</strong><small>Non-voided booking payments</small></article><article><span>Outstanding</span><strong>{money(allOutstanding)}</strong><small>Uncancelled booking balances</small></article></div>
    <section className="clients-panel"><header className="clients-toolbar"><div><h2>Client directory</h2><p>{listed.length} {listed.length === 1 ? 'client' : 'clients'} · Booking totals are matched by client name.</p></div><div className="clients-filters"><label><span className="sr-only">Search clients</span><input className="input input-sm" value={search} onChange={(event) => setSearch?.(event.target.value)} placeholder="Search clients…" /></label><select className="select" aria-label="Filter client status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><select className="select" aria-label="Sort clients" value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Name A–Z</option><option value="latest">Recently updated</option></select></div></header>
      {bookingsError && <div className="clients-message" role="status">Booking summaries are unavailable: {bookingsError}</div>}
      {loading || bookingsLoading ? <div className="clients-empty">Loading clients…</div> : !listed.length ? <div className="clients-empty"><strong>{clients.length ? 'No matching clients' : 'No clients yet'}</strong><p>{clients.length ? 'Change the search or status filter.' : 'Add a client to start tracking their bookings and contact details.'}</p>{!clients.length && <button className="btn btn-secondary" onClick={onCreate}><AppIcon icon={Plus} size="sm" /> Add client</button>}</div> : <div className="client-cards">{listed.map((client) => {
        const name = client.name || 'Unnamed client';
        const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'CL';
        const isInactive = ['inactive', 'archived'].includes(statusOf(client).toLowerCase());
        const clientBookings = bookingsFor(client);
        const collected = clientBookings.reduce((sum, booking) => sum + collectedFrom(booking), 0);
        const outstanding = clientBookings.filter((booking) => !isCancelled(booking)).reduce((sum, booking) => sum + balanceOf(booking), 0);
        const lifetime = clientBookings.filter((booking) => !isCancelled(booking)).reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);
        const location = [client.city, client.region, client.country].filter(Boolean).join(', ') || client.address || '—';
        return <article className="client-card" key={client.id}>
          <header className="client-card-heading"><div className="client-avatar">{initials}</div><div className="client-card-name"><strong>{name}</strong><span>{client.company || 'Individual client'} · Client since {client.createdAt ? new Date(client.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</span></div><span className={`client-state${isInactive ? ' inactive' : ''}`}>{statusOf(client)}</span></header>
          <div className="client-financials" aria-label="Client booking totals"><div><span>Paid</span><strong>{money(collected)}</strong></div><div><span>Outstanding</span><strong>{money(outstanding)}</strong></div><div><span>Booking value</span><strong>{money(lifetime)}</strong></div></div>
          <dl className="client-details"><div><dt>Email</dt><dd>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : '—'}</dd></div><div><dt>Phone</dt><dd>{client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : '—'}</dd></div><div className="client-detail-wide"><dt>Location</dt><dd>{location}</dd></div><div><dt>Preferred contact</dt><dd>{client.preferredContact || '—'}</dd></div><div><dt>Postal code</dt><dd>{client.postalCode || '—'}</dd></div></dl>
          <p className="client-booking-count">{clientBookings.length} {clientBookings.length === 1 ? 'booking' : 'bookings'} · non-cancelled booking totals</p>
          {clientBookings.some((booking) => !booking.paymentLedgerVerified) && <p className="client-payment-warning">Some bookings have unverified legacy payment history; balances may be incomplete.</p>}
          {client.notes && <p className="client-notes" title={client.notes}>{client.notes}</p>}
          <footer className="client-card-actions"><button className="btn client-edit-action btn-secondary btn-sm" onClick={() => onEdit?.(client)}>Edit client</button><button className="btn client-delete-action btn-secondary btn-sm" onClick={() => onDelete?.(client)}>Delete</button></footer>
        </article>;
      })}</div>}
    </section>
  </section>;
}
