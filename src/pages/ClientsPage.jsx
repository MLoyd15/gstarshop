import '../styles/ClientsPage.css';

import { useEffect, useMemo, useState } from "react";



function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "").join("") || "CL";
}

function clientKey(name = "") {
  return String(name || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function money(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value, options = {}) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}

function normalizedStatus(value = "") {
  return String(value || "pending").trim().toLowerCase();
}

function isPaid(booking) {
  const status = normalizedStatus(booking.status);
  return ["paid", "completed"].includes(status);
}

function isCancelled(booking) {
  return ["cancelled", "canceled", "void", "refunded"].includes(
    normalizedStatus(booking.status)
  );
}

function Detail({ label, value, href, wide = false }) {
  return (
    <div className={`cp-detail${wide ? " wide" : ""}`}>
      <dt>{label}</dt>
      <dd>
        {value ? (
          href ? <a href={href}>{value}</a> : value
        ) : (
          <span style={{ color: "#aaaabd", fontWeight: 450 }}>Not provided</span>
        )}
      </dd>
    </div>
  );
}

function SummaryCard({ icon, label, value, note }) {
  return (
    <article className="cp-stat">
      <div className="cp-stat-top">
        <span className="cp-stat-label">{label}</span>
        <span className="cp-stat-icon" aria-hidden="true">{icon}</span>
      </div>
      <strong className="cp-stat-value">{value}</strong>
      <div className="cp-stat-note">{note}</div>
    </article>
  );
}

export default function ClientsPage({
  clients = [],
  loading = false,
  search = "",
  setSearch,
  onCreate,
  onEdit,
  onDelete,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsError, setBookingsError] = useState("");
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingFilter, setBookingFilter] = useState("all");

  useEffect(() => {
    const controller = new AbortController();

    async function loadBookings() {
      setBookingsLoading(true);
      setBookingsError("");

      try {
        const response = await fetch("/api/records/bookings", {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Could not load bookings.");
        }

        // Supports either an array or an object containing a bookings array.
        const list = Array.isArray(result)
          ? result
          : Array.isArray(result.bookings)
            ? result.bookings
            : Array.isArray(result.records)
              ? result.records
              : [];

        setBookings(list);
      } catch (error) {
        if (error.name !== "AbortError") {
          setBookingsError(error.message || "Could not load bookings.");
        }
      } finally {
        if (!controller.signal.aborted) setBookingsLoading(false);
      }
    }

    loadBookings();
    return () => controller.abort();
  }, []);

  const selected = clients.find(client => client.id === selectedId)
    || clients[0]
    || null;

  const clientBookings = useMemo(() => {
    if (!selected) return [];

    return bookings
      .filter(booking => {
        // Current schema matches bookings to clients by client name.
        return clientKey(booking.client) === clientKey(selected.name);
      })
      .sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0).getTime();
        const dateB = new Date(b.date || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
  }, [bookings, selected]);

  const collectedIncome = clientBookings
    .filter(isPaid)
    .reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);

  const outstanding = clientBookings
    .filter(booking => !isPaid(booking) && !isCancelled(booking))
    .reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);

  const lifetimeValue = clientBookings
    .filter(booking => !isCancelled(booking))
    .reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);

  const filteredBookings = clientBookings.filter(booking => {
    if (bookingFilter === "paid") return isPaid(booking);
    if (bookingFilter === "pending") {
      return !isPaid(booking) && !isCancelled(booking);
    }
    if (bookingFilter === "cancelled") return isCancelled(booking);
    return true;
  });

  const activeClients = clients.filter(client => {
    return !["inactive", "archived"].includes(
      normalizedStatus(client.status === undefined ? "active" : client.status)
    );
  }).length;

  const allCollectedIncome = bookings
    .filter(isPaid)
    .reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);

  const allOutstanding = bookings
    .filter(booking => !isPaid(booking) && !isCancelled(booking))
    .reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);

  function handleSearch(event) {
    setSearch?.(event.target.value);
  }

  return (
    <div className="clients-page">
      

      <header className="cp-header">
        <div>
          <p className="cp-eyebrow">Customer relationships</p>
          <h1 className="cp-title">Clients</h1>
          <p className="cp-subtitle">
            Your client profiles, revenue, and booking activity in one place.
          </p>
        </div>
        <button className="cp-primary" type="button" onClick={onCreate}>
          <span aria-hidden="true">＋</span> Add client
        </button>
      </header>

      <section className="cp-stats" aria-label="Business summary">
        <SummaryCard
          icon="♙"
          label="Total clients"
          value={clients.length}
          note="Clients in your directory"
        />
        <SummaryCard
          icon="↗"
          label="Active clients"
          value={activeClients}
          note="Available for follow-up"
        />
        <SummaryCard
          icon="＄"
          label="Income collected"
          value={money(allCollectedIncome)}
          note="Bookings marked paid or completed"
        />
        <SummaryCard
          icon="◷"
          label="Outstanding"
          value={money(allOutstanding)}
          note="Bookings not yet paid or cancelled"
        />
      </section>

      <div className="cp-workspace">
        <section className="cp-panel" aria-label="Client directory">
          <div className="cp-panel-head">
            <div>
              <h2 className="cp-heading">Client directory</h2>
              <p className="cp-muted">Select a client to see their details.</p>
            </div>
            <span className="cp-count">{clients.length} clients</span>
          </div>

          <div style={{ padding: "14px 12px 3px" }}>
            <input
              className="cp-search"
              type="search"
              aria-label="Search clients"
              placeholder="Search name, company, email..."
              value={search}
              onChange={handleSearch}
            />
          </div>

          <div className="cp-directory">
            {loading ? (
              <div className="cp-empty">Loading clients…</div>
            ) : clients.length > 0 ? (
              clients.map(client => {
                const active = selected?.id === client.id;
                const isInactive = ["inactive", "archived"].includes(
                  normalizedStatus(client.status)
                );

                return (
                  <button
                    type="button"
                    key={client.id}
                    className={`cp-client${active ? " active" : ""}`}
                    onClick={() => {
                      setSelectedId(client.id);
                      setBookingFilter("all");
                    }}
                    aria-pressed={active}
                  >
                    <span className="cp-avatar">{initials(client.name)}</span>
                    <span className="cp-client-info">
                      <span className="cp-client-name">{client.name || "Unnamed client"}</span>
                      <span className="cp-client-sub">
                        {client.company || client.email || client.phone || "No contact details"}
                      </span>
                    </span>
                    <span
                      className={`cp-dot${isInactive ? " inactive" : ""}`}
                      title={isInactive ? "Inactive client" : "Active client"}
                    />
                  </button>
                );
              })
            ) : (
              <div className="cp-empty">
                <strong>{search ? "No matching clients" : "No clients yet"}</strong>
                {search
                  ? "Try another search term."
                  : "Add a client to start tracking their profile and income."}
                {!search && (
                  <div style={{ marginTop: 13 }}>
                    <button className="cp-primary" type="button" onClick={onCreate}>
                      ＋ Add your first client
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {!selected ? (
          <section className="cp-panel">
            <div className="cp-empty" style={{ padding: 60 }}>
              <strong>Select a client</strong>
              Choose someone from the directory to view their profile and income.
            </div>
          </section>
        ) : (
          <main className="cp-profile">
            {/* Client profile */}
            <section className="cp-panel">
              <div className="cp-profile-banner">
                <div className="cp-profile-person">
                  <span className="cp-avatar large">{initials(selected.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <p className="cp-eyebrow" style={{ marginBottom: 6 }}>Client profile</p>
                    <h2 className="cp-profile-name">{selected.name || "Unnamed client"}</h2>
                    <p className="cp-profile-company">
                      {selected.company || "Individual client"}
                      {" · "}
                      {selected.status || "Active"}
                    </p>
                  </div>
                </div>

                <div className="cp-actions">
                  <button
                    type="button"
                    className="cp-secondary"
                    onClick={() => onEdit?.(selected)}
                  >
                    ✎ Edit profile
                  </button>
                  <button
                    type="button"
                    className="cp-danger"
                    onClick={() => onDelete?.(selected)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <dl className="cp-details">
                <Detail
                  label="Email address"
                  value={selected.email}
                  href={selected.email ? `mailto:${selected.email}` : undefined}
                />
                <Detail
                  label="Phone number"
                  value={selected.phone}
                  href={selected.phone ? `tel:${selected.phone}` : undefined}
                />
                <Detail label="Company" value={selected.company} />
                <Detail label="Preferred contact" value={selected.preferredContact} />
                <Detail label="Address" value={selected.address} wide />
                <Detail label="City" value={selected.city} />
                <Detail label="Region / state" value={selected.region} />
                <Detail label="Postal code" value={selected.postalCode} />
                <Detail label="Country" value={selected.country} />
                <Detail label="Client since" value={formatDate(selected.createdAt)} />
                <Detail label="Notes" value={selected.notes} wide />
              </dl>
            </section>

            {/* Per-client financial summary */}
            <section className="cp-panel">
              <div className="cp-panel-head">
                <div>
                  <h2 className="cp-heading">Client financial overview</h2>
                  <p className="cp-muted">Revenue and payment status for {selected.name}.</p>
                </div>
                <span className="cp-count">Lifetime overview</span>
              </div>

              <div className="cp-mini-stats">
                <div className="cp-mini">
                  <span className="cp-mini-label">Income collected</span>
                  <strong className="cp-mini-value" style={{ color: "#14845b" }}>
                    {money(collectedIncome)}
                  </strong>
                </div>
                <div className="cp-mini">
                  <span className="cp-mini-label">Outstanding</span>
                  <strong className="cp-mini-value" style={{ color: "#b57920" }}>
                    {money(outstanding)}
                  </strong>
                </div>
                <div className="cp-mini">
                  <span className="cp-mini-label">Total booking value</span>
                  <strong className="cp-mini-value">{money(lifetimeValue)}</strong>
                </div>
              </div>
            </section>

            {/* Booking history */}
            <section className="cp-panel">
              <div className="cp-panel-head" style={{ flexWrap: "wrap" }}>
                <div>
                  <h2 className="cp-heading">Booking history</h2>
                  <p className="cp-muted">
                    {clientBookings.length} booking{clientBookings.length === 1 ? "" : "s"} linked by client name.
                  </p>
                </div>

                <div className="cp-booking-controls">
                  <select
                    className="cp-filter"
                    aria-label="Filter bookings by payment status"
                    value={bookingFilter}
                    onChange={event => setBookingFilter(event.target.value)}
                  >
                    <option value="all">All bookings</option>
                    <option value="paid">Paid / completed</option>
                    <option value="pending">Outstanding</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {bookingsLoading ? (
                <div className="cp-empty">Loading booking history…</div>
              ) : bookingsError ? (
                <div className="cp-message">
                  {bookingsError}
                  <button
                    type="button"
                    className="cp-secondary"
                    style={{ marginLeft: 10 }}
                    onClick={() => window.location.reload()}
                  >
                    Reload page
                  </button>
                </div>
              ) : filteredBookings.length > 0 ? (
                <>
                  <div className="cp-booking-list">
                    {filteredBookings.map((booking, index) => {
                      const status = normalizedStatus(booking.status);
                      const cancelled = isCancelled(booking);
                      const paid = isPaid(booking);
                      const badgeClass = cancelled
                        ? "cancelled"
                        : paid
                          ? "paid"
                          : "pending";

                      return (
                        <article
                          className="cp-booking"
                          key={booking.id ?? `${booking.name}-${booking.date}-${index}`}
                        >
                          <div style={{ minWidth: 0 }}>
                            <span className="cp-booking-name">
                              {booking.name || booking.title || "Client booking"}
                            </span>
                            <span className="cp-booking-date">
                              {formatDate(booking.date || booking.createdAt)}
                              {booking.reference ? ` · Ref. ${booking.reference}` : ""}
                            </span>
                          </div>

                          <div className="cp-booking-right">
                            <span className={`cp-badge ${badgeClass}`}>
                              {booking.status || "Pending"}
                            </span>
                            <strong className="cp-amount">
                              {money(booking.amount)}
                            </strong>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="cp-booking-total">
                    <span>Filtered booking value</span>
                    <strong>
                      {money(
                        filteredBookings
                          .filter(booking => !isCancelled(booking))
                          .reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0)
                      )}
                    </strong>
                  </div>
                </>
              ) : (
                <div className="cp-empty">
                  <strong>
                    {clientBookings.length === 0
                      ? "No bookings for this client yet"
                      : "No bookings match this filter"}
                  </strong>
                  {clientBookings.length === 0
                    ? "Bookings need to have a client name matching this profile to appear here."
                    : "Choose another filter to view more bookings."}
                </div>
              )}
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
