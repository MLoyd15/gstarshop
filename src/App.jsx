import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardPage from './pages/DashboardPage.jsx';
import RecordManagementPage from './pages/RecordManagementPage.jsx';
import BookingsPage from './pages/BookingsPage.jsx';
import IncomePage from './pages/IncomePage.jsx';
import ExpensesPage from './pages/ExpensesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import { Icon, Butterfly } from './shared.jsx';

const sections = [
  { heading: 'Workspace', items: [{ id: 'home', label: 'Main dashboard', icon: '⌂' }] },
  { heading: 'G4 Sticker', items: [
    { id: 'supplier-dashboard', label: 'Dashboard', icon: '◫' },
    { id: 'suppliers', label: 'Suppliers', icon: '♙' },
    { id: 'products', label: 'Products', icon: '▧' },
    { id: 'inventory', label: 'Inventory', icon: '▤' },
    { id: 'prices', label: 'Prices', icon: '＄' },
    { id: 'purchases', label: 'Purchases', icon: '🛒' },
    { id: 'excel-sheet', label: 'Excel sheet', icon: '▦', badge: 'NEW' },
    { id: 'supplier-reports', label: 'Reports', icon: '▥' }
  ] },
  { heading: 'Excel business', items: [
    { id: 'excel-dashboard', label: 'Dashboard', icon: '◫' },
    { id: 'scheduler', label: 'Scheduler', icon: '▦' },
    { id: 'bookings', label: 'Bookings', icon: '▣' },
    { id: 'clients', label: 'Clients', icon: '◎' },
    { id: 'income', label: 'Income', icon: '↗' },
    { id: 'expenses', label: 'Expenses', icon: '↘' },
    { id: 'profit', label: 'Profit', icon: '◒' },
    { id: 'shareholders', label: 'Shareholders', icon: '♧' },
    { id: 'excel-reports', label: 'Excel reports', icon: '▥' }
  ] }
];

const resourceFor = {
  suppliers: 'suppliers', products: 'products', inventory: 'inventory', prices: 'prices',
  purchases: 'purchases', 'excel-sheet': 'excel-sheet', scheduler: 'scheduler',
  bookings: 'bookings', clients: 'clients', income: 'income', expenses: 'expenses', profit: 'profit',
  shareholders: 'shareholders', 'money-tracker': 'money-tracker', notepad: 'notepad'
};

const fieldsFor = {
  suppliers: [['name', 'Supplier name'], ['contact', 'Contact person'], ['email', 'Email'], ['phone', 'Phone'], ['status', 'Status']],
  products: [['name', 'Product name'], ['sku', 'SKU'], ['category', 'Category'], ['price', 'Unit price'], ['stock', 'In stock']],
  inventory: [['name', 'Product'], ['sku', 'SKU'], ['category', 'Category'], ['stock', 'In stock'], ['stockStatus', 'Stock status']],
  prices: [['name', 'Product'], ['supplier', 'Supplier'], ['price', 'Price'], ['effectiveDate', 'Effective date']],
  purchases: [['name', 'Order'], ['supplier', 'Supplier'], ['amount', 'Amount'], ['date', 'Date'], ['status', 'Status']],
  'excel-sheet': [['name', 'Sheet name'], ['category', 'Category'], ['owner', 'Owner'], ['updated', 'Last updated']],
  scheduler: [['name', 'Event'], ['date', 'Date'], ['time', 'Time'], ['status', 'Status']],
  bookings: [['name', 'Booking'], ['client', 'Client'], ['date', 'Date'], ['amount', 'Amount'], ['status', 'Status']],
  clients: [['name', 'Client name'], ['company', 'Company'], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['city', 'City'], ['region', 'State / region'], ['postalCode', 'Postal code'], ['country', 'Country'], ['preferredContact', 'Preferred contact'], ['status', 'Status'], ['notes', 'Notes']],
  income: [['name', 'Description'], ['category', 'Category'], ['amount', 'Amount'], ['date', 'Date']],
  expenses: [['name', 'Description'], ['category', 'Category'], ['amount', 'Amount'], ['date', 'Date']],
  profit: [['name', 'Period'], ['income', 'Income'], ['expenses', 'Expenses'], ['amount', 'Net profit']],
  shareholders: [['name', 'Shareholder'], ['email', 'Email'], ['shares', 'Shares'], ['percentage', 'Ownership %']],
  'money-tracker': [['name', 'Description'], ['category', 'Category'], ['amount', 'Amount'], ['date', 'Date']],
  notepad: [['name', 'Title'], ['content', 'Note'], ['updated', 'Last updated']]
};

const titles = {
  home: 'Main dashboard', 'supplier-dashboard': 'G4 Sticker dashboard', suppliers: 'Suppliers',
  products: 'Products', inventory: 'Inventory', prices: 'Prices', purchases: 'Purchases',
  'excel-sheet': 'Excel sheet', 'supplier-reports': 'G4 Sticker reports', 'excel-dashboard': 'Excel dashboard',
  scheduler: 'Scheduler', bookings: 'Bookings', clients: 'Clients', income: 'Income', expenses: 'Expenses', profit: 'Profit',
  shareholders: 'Shareholders', 'excel-reports': 'Excel reports', 'money-tracker': 'Money tracker',
  notepad: 'Notepad', settings: 'Settings'
};

const defaultAppearance = { accent: '#6967d9', textScale: 1.15 };
const accentPresets = [
  { label: 'Violet', value: '#6967d9' },
  { label: 'Ocean', value: '#2878c7' },
  { label: 'Forest', value: '#26836b' },
  { label: 'Coral', value: '#d46a70' },
  { label: 'Amber', value: '#bd7d28' }
];

function readAppearance() {
  try {
    const saved = JSON.parse(window.localStorage.getItem('g4-sticker-appearance') || '{}');
    const textScale = Number(saved.textScale);
    return {
      accent: /^#[\da-f]{6}$/i.test(saved.accent) ? saved.accent : defaultAppearance.accent,
      textScale: Number.isFinite(textScale) && textScale >= 0.9 && textScale <= 1.4
        ? textScale
        : defaultAppearance.textScale
    };
  } catch (error) {
    console.error('Could not read saved appearance settings:', error);
    return defaultAppearance;
  }
}

function toDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromValue(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function DatePicker({ name, value, required }) {
  const wrapperRef = useRef(null);
  const [selectedValue, setSelectedValue] = useState(value);
  const selectedDate = dateFromValue(selectedValue);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = selectedDate || new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function changeMonth(offset) {
    setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  function chooseDate(date) {
    setSelectedValue(toDateValue(date));
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setOpen(false);
  }

  const firstWeekday = visibleMonth.getDay();
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const todayValue = toDateValue(new Date());
  const monthLabel = visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="date-picker" ref={wrapperRef}>
      <input type="hidden" name={name} value={selectedValue} />
      <button type="button" className={`date-picker-trigger ${open ? 'is-open' : ''}`}
        aria-label={selectedDate ? `Selected date: ${selectedDate.toLocaleDateString()}` : 'Choose a date'}
        aria-haspopup="dialog" aria-expanded={open} aria-required={required || undefined}
        onClick={() => {
          if (!open && selectedDate) setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
          setOpen((current) => !current);
        }}>
        <span className={selectedDate ? '' : 'date-placeholder'}>
          {selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Choose a date'}
        </span>
        <span className="date-trigger-icon" aria-hidden="true">▦</span>
      </button>
      {open && (
        <div className="calendar-popover" role="dialog" aria-label="Choose a date">
          <div className="calendar-heading">
            <div className="calendar-heading-copy"><span>SELECT DATE</span><strong>{monthLabel}</strong></div>
            <div className="calendar-month-nav">
              <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button>
              <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>›</button>
            </div>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-days">
            {Array.from({ length: cellCount }, (_, index) => {
              const dayNumber = index - firstWeekday + 1;
              const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), dayNumber);
              const dateValue = toDateValue(date);
              const outsideMonth = dayNumber < 1 || dayNumber > daysInMonth;
              const dayClasses = [
                'calendar-day',
                outsideMonth ? 'outside-month' : '',
                dateValue === selectedValue ? 'selected' : '',
                dateValue === todayValue ? 'today' : ''
              ].filter(Boolean).join(' ');
              return <button type="button" className={dayClasses} key={dateValue}
                aria-label={date.toLocaleDateString('en-US', { dateStyle: 'full' })}
                aria-pressed={dateValue === selectedValue}
                onClick={() => chooseDate(date)}>{date.getDate()}</button>;
            })}
          </div>
          <div className="calendar-footer">
            <button type="button" className="calendar-clear" onClick={() => { setSelectedValue(''); setOpen(false); }}>Clear date</button>
            <button type="button" className="calendar-today" onClick={() => chooseDate(new Date())}>Today</button>
          </div>
        </div>
      )}
    </div>
  );
}


function App() {
  const [active, setActive] = useState('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState('checking');
  const [notice, setNotice] = useState('');
  const [appearance, setAppearance] = useState(readAppearance);
  const [appearanceError, setAppearanceError] = useState('');
  const [notifications, setNotifications] = useState({ count: 0, bookings: [] });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [dashboard, setDashboard] = useState({
    totals: { income: 0, expenses: 0, incomeEntries: 0, expenseEntries: 0, bookings: 0, suppliers: 0, products: 0, inventory: 0 },
    months: [],
    recent: []
  });

  const allItems = useMemo(() => sections.flatMap((section) => section.items), []);
  const activeLabel = titles[active] || allItems.find((item) => item.id === active)?.label || 'Dashboard';
  const resource = resourceFor[active];
  const fields = fieldsFor[active] || [];

  useEffect(() => {
    document.documentElement.style.setProperty('--purple', appearance.accent);
    document.documentElement.style.setProperty('--type-scale', String(appearance.textScale));
    try {
      window.localStorage.setItem('g4-sticker-appearance', JSON.stringify(appearance));
      setAppearanceError('');
    } catch (storageError) {
      console.error('Could not save appearance settings:', storageError);
      setAppearanceError('Your appearance changes are active for now, but could not be saved on this device.');
    }
  }, [appearance]);

  async function refreshNotifications(signal) {
    try {
      const response = await fetch('/api/notifications', { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load booking notifications.');
      setNotifications(data);
      setNotificationsError('');
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setNotificationsError(requestError.message);
    }
  }

  useEffect(() => {
    fetch('/api/health')
      .then(async (response) => {
        if (!response.ok) throw new Error('The API server is unavailable.');
        return response.json();
      })
      .then((data) => setHealth(data.database === 'connected' ? 'connected' : 'disconnected'))
      .catch(() => setHealth('disconnected'));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refreshNotifications(controller.signal);
    const interval = window.setInterval(() => refreshNotifications(), 60000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!['home', 'supplier-dashboard', 'excel-dashboard', 'supplier-reports', 'excel-reports'].includes(active)) return;
    const controller = new AbortController();
    fetch('/api/dashboard', { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load dashboard data.');
        return data;
      })
      .then(setDashboard)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      });
    return () => controller.abort();
  }, [active]);

  useEffect(() => {
    if (!resource) {
      setRecords([]);
      setError('');
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/api/records/${active === 'inventory' ? 'products' : resource}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load records.');
        return data;
      })
      .then((data) => active === 'inventory' ? data.map((record) => {
        const stock = Number(record.stock) || 0;
        return { ...record, stockStatus: stock <= 0 ? 'Out of stock' : stock <= 5 ? 'Low stock' : 'In stock' };
      }) : data)
      .then(setRecords)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [resource]);

  function navigate(id) {
    setActive(id);
    setMobileOpen(false);
    setNotificationsOpen(false);
    setSearch('');
  }

  function openCreate() {
    setEditing(null);
    setModal(true);
  }

  async function saveRecord(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(fields.map(([key]) => [key, form.get(key)]));
    const url = editing ? `/api/records/${resource}/${editing.id}` : `/api/records/${resource}`;
    try {
      const response = await fetch(url, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save this record.');
      setRecords((previous) => editing
        ? previous.map((record) => record.id === editing.id ? result : record)
        : [result, ...previous]);
      if (resource === 'bookings') refreshNotifications();
      setModal(false);
      setNotice(editing ? 'Changes saved successfully.' : 'Record added successfully.');
      window.setTimeout(() => setNotice(''), 3000);
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function deleteRecord(record) {
    if (!window.confirm(`Delete "${record[fields[0]?.[0]] || 'this record'}"? This can’t be undone.`)) return;
    try {
      const response = await fetch(`/api/records/${resource}/${record.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Could not delete this record.');
      }
      setRecords((previous) => previous.filter((item) => item.id !== record.id));
      if (resource === 'bookings') refreshNotifications();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  const filteredRecords = records.filter((record) =>
    Object.values(record).some((value) => String(value).toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Butterfly /></div>
          <span className="brand-name">G4 <span>Sticker</span></span>
          <button className="collapse-button" aria-label="Toggle navigation" onClick={() => setMobileOpen(false)}>‹</button>
        </div>
        <nav className="navigation" aria-label="Main navigation">
          {sections.map((section) => (
            <div className="nav-section" key={section.heading}>
              <div className="nav-heading">{section.heading}</div>
              {section.items.map((item) => (
                <button key={`${section.heading}-${item.id}`} className={`nav-item ${active === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}>
                  <Icon>{item.icon}</Icon><span className="nav-label">{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </button>
              ))}
            </div>
          ))}
          <div className="nav-divider" />
          {[{ id: 'money-tracker', label: 'Money tracker', icon: '＄' }, { id: 'notepad', label: 'Notepad', icon: '▤' }].map((item) => (
            <button key={item.id} className={`nav-item ${active === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
              <Icon>{item.icon}</Icon><span className="nav-label">{item.label}</span>
            </button>
          ))}
          <button className={`nav-item ${active === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}>
            <Icon>⚙</Icon><span className="nav-label">Settings</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✳</div>
            <div><strong>Need a hand?</strong><span>We’re here to help.</span></div>
            <button aria-label="Get help">↗</button>
          </div>
          <button className="profile-button">
            <div className="profile-avatar">JD</div>
            <div className="profile-copy"><strong>Jamie Davis</strong><span>Workspace admin</span></div>
            <span className="profile-menu">···</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>☰</button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeLabel}</strong></div>
          <div className="topbar-actions">
            <span className={`connection-status ${health}`}><span className="status-dot" />{health === 'connected' ? 'All systems live' : health === 'checking' ? 'Connecting…' : 'Offline'}</span>
            <button className="icon-button search-shortcut" aria-label="Search" onClick={() => document.querySelector('.global-search')?.focus()}>⌕</button>
            <label className="global-search"><span>⌕</span><input placeholder="Search anything..." aria-label="Search records" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label>
            <div className="notification-wrap">
              <button className={`icon-button notification-button ${notificationsOpen ? 'is-open' : ''}`}
                aria-label={`Notifications${notifications.count ? `, ${notifications.count} ongoing bookings` : ''}`}
                aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>
                ♧{notifications.count > 0 && <span className="notification-count">{notifications.count > 99 ? '99+' : notifications.count}</span>}
              </button>
              {notificationsOpen && <div className="notification-popover">
                <div className="notification-heading"><div><strong>Notifications</strong><span>Ongoing bookings</span></div><span className="notification-heading-count">{notifications.count}</span></div>
                {notificationsError ? <p className="notification-empty">{notificationsError}</p>
                  : notifications.bookings.length ? <div className="notification-list">{notifications.bookings.map((booking) => (
                    <button className="notification-item" key={booking.id} onClick={() => { setNotificationsOpen(false); navigate('bookings'); }}>
                      <span className="notification-item-icon">▣</span>
                      <span className="notification-item-copy"><strong>{booking.name}</strong>
                        <span>{[booking.client, booking.date ? new Date(`${booking.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '', booking.status].filter(Boolean).join(' · ')}</span>
                      </span><span className="notification-item-arrow">→</span>
                    </button>
                  ))}</div> : <p className="notification-empty">No ongoing bookings right now. New active bookings will appear here.</p>}
                <button className="notification-view-all" onClick={() => { setNotificationsOpen(false); navigate('bookings'); }}>View all bookings <span>→</span></button>
              </div>}
            </div>
            <div className="top-avatar">JD</div>
          </div>
        </header>
        <div className="content">
          {error && <div className="error-banner"><span>!</span><div><strong>Couldn’t load your data</strong><p>{error} Check your server and MongoDB connection, then refresh.</p></div><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
          {notice && <div className="success-banner">✓ &nbsp;{notice}</div>}
          {active === 'home' ? (
            <DashboardPage onNavigate={navigate} data={dashboard} />
          ) : active === 'clients' ? (
            <ClientsPage clients={filteredRecords} loading={loading} search={search} setSearch={setSearch}
              onCreate={openCreate} onEdit={(record) => { setEditing(record); setModal(true); }} onDelete={deleteRecord} />
          ) : ['supplier-dashboard', 'excel-dashboard', 'supplier-reports', 'excel-reports'].includes(active) ? (
            <DashboardPage onNavigate={navigate} data={dashboard} compact={active.includes('supplier') ? 'G4 Sticker' : 'Excel business'} />
          ) : active === 'settings' ? (
            <SettingsPage health={health} appearance={appearance} onAppearanceChange={setAppearance} appearanceError={appearanceError} />
          ) : active === 'bookings' ? (
            <BookingsPage active={active} title={activeLabel} fields={fields} records={filteredRecords} loading={loading}
              search={search} setSearch={setSearch} onCreate={openCreate}
              onEdit={(record) => { setEditing(record); setModal(true); }} onDelete={deleteRecord} />
          ) : active === 'income' ? (
            <IncomePage active={active} title={activeLabel} fields={fields} records={filteredRecords} loading={loading}
              search={search} setSearch={setSearch} onCreate={openCreate}
              onEdit={(record) => { setEditing(record); setModal(true); }} onDelete={deleteRecord} />
          ) : active === 'expenses' ? (
            <ExpensesPage active={active} title={activeLabel} fields={fields} records={filteredRecords} loading={loading}
              search={search} setSearch={setSearch} onCreate={openCreate}
              onEdit={(record) => { setEditing(record); setModal(true); }} onDelete={deleteRecord} />
          ) : (
            <RecordManagementPage active={active} title={activeLabel} fields={fields} records={filteredRecords} loading={loading}
              search={search} setSearch={setSearch}
              onCreate={active === 'inventory' ? () => navigate('products') : openCreate}
              onEdit={(record) => { setEditing(record); setModal(true); }} onDelete={deleteRecord}
              pageClass={active === 'suppliers' ? 'suppliers-page' : active === 'products' ? 'products-page' : active === 'inventory' ? 'inventory-page' : 'record-management-page'} />
          )}
        </div>
      </main>
      {modal && <RecordModal title={activeLabel} active={active} fields={fields} record={editing} onClose={() => setModal(false)} onSave={saveRecord} />}
    </div>
  );
}

function RecordModal({ title, active, fields, record, onClose, onSave }) {
  const [dateError, setDateError] = useState('');
  function handleSubmit(event) {
    const formData = new FormData(event.currentTarget);
    const requiredDate = fields.find(([key]) =>
      key.toLowerCase().includes('date') && key !== 'updated' && !formData.get(key)
    );
    if (requiredDate) {
      event.preventDefault();
      setDateError(`${requiredDate[1]} is required.`);
      return;
    }
    setDateError('');
    onSave(event);
  }

  return <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="record-modal" onSubmit={handleSubmit}><div className="modal-header"><div><div className="eyebrow"><span className="eyebrow-line" />BUSINESS HUB</div><h2>{record ? 'Edit' : 'Add'} {title.replace(/s$/, '')}</h2></div>
      <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button></div>
      <div className="modal-fields">{fields.map(([key, label]) => <label key={key} className={key === 'content' ? 'wide-field' : ''}><span>{label}</span>
        {['content', 'notes', ...(active === 'clients' ? ['address'] : [])].includes(key) ? <textarea name={key} defaultValue={record?.[key] || ''} rows={key === 'notes' ? 4 : 3} required={active === 'clients' ? key === 'name' : key === 'content'} /> : key === 'category' && active === 'products' ? <select name={key} defaultValue={record?.[key] || ''} required><option value="" disabled>Select a product type</option>{['Sticker', 'Cap', 'Mug', 'Tarpaulin', ...(record?.[key] && !['Sticker', 'Cap', 'Mug', 'Tarpaulin'].includes(record[key]) ? [record[key]] : [])].map((category) => <option key={category} value={category}>{category}</option>)}</select> : key.toLowerCase().includes('date') || key === 'updated' ? <DatePicker name={key} value={record?.[key] || ''} required={key !== 'updated'} /> : <input name={key} type={['amount', 'price', 'income', 'expenses', 'stock', 'shares', 'percentage'].includes(key) ? 'number' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} step={['amount', 'price', 'income', 'expenses', 'percentage'].includes(key) ? '0.01' : undefined} defaultValue={record?.[key] || ''} required={active === 'clients' ? key === 'name' : key !== 'phone'} />}</label>)}</div>
      {dateError && <p className="date-validation-error" role="alert">{dateError}</p>}
      <div className="modal-footer"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">{record ? 'Save changes' : 'Add record'}</button></div>
    </form>
  </div>;
}

export default App;
