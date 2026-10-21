import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DashboardPage from './pages/DashboardPage.jsx';
import RecordManagementPage from './pages/RecordManagementPage.jsx';
import BookingsPage from './pages/BookingsPage.jsx';
import IncomePage from './pages/IncomePage.jsx';
import ExpensesPage from './pages/ExpensesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import PayrollPage from './pages/PayrollPage.jsx';
import EmployeeMonthlySheet from './pages/EmployeeMonthlySheet.jsx';
import EmployeesPage from './pages/EmployeesPage.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import MaterialsPage from './pages/MaterialsPage.jsx';
import SuppliersPage from './pages/SuppliersPage.jsx';
import PurchasesPage from './pages/PurchasesPage.jsx';
import SupplierPricesPage from './pages/SupplierPricesPage.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import logo from './assets/logo.png';
import { Icon } from './shared.jsx';

const sections = [
  { heading: 'Workspace', items: [{ id: 'home', label: 'Main dashboard', icon: '⌂' }] },
  { heading: 'G4 Sticker', items: [
    { id: 'supplier-dashboard', label: 'Dashboard', icon: '◫' },
    { id: 'suppliers', label: 'Suppliers', icon: '♙' },
    { id: 'products', label: 'Products', icon: '▧' },
    { id: 'materials', label: 'Materials', icon: '▦' },
    { id: 'prices', label: 'Supplier prices', icon: '＄' },
    { id: 'purchases', label: 'Purchases', icon: '🛒' },
    { id: 'bookings', label: 'Bookings', icon: '▣' },
    { id: 'supplier-reports', label: 'Reports', icon: '▥' },
    { id: 'clients', label: 'Clients', icon: '◎' }
  ] },
  { heading: 'Payroll system', items: [
    { id: 'employees', label: 'Employees', icon: '♙' },
    { id: 'payroll-runs', label: 'Pay runs', icon: '＄' }
  ] }
];

const resourceFor = {
  'excel-sheet': 'excel-sheet', scheduler: 'scheduler',
  bookings: 'bookings', clients: 'clients', income: 'income', expenses: 'expenses', profit: 'profit',
  employees: 'employees', 'payroll-runs': 'payroll-runs',
  shareholders: 'shareholders', 'money-tracker': 'money-tracker', notepad: 'notepad'
};

const fieldsFor = {
  suppliers: [['name', 'Supplier name'], ['contact', 'Contact person'], ['email', 'Email'], ['phone', 'Phone'], ['status', 'Status']],
  products: [['name', 'Product name'], ['sku', 'SKU'], ['category', 'Category'], ['price', 'Unit price'], ['stock', 'In stock']],
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
  employees: [['employeeId', 'Employee ID'], ['name', 'Full name'], ['position', 'Position'], ['email', 'Email'], ['phone', 'Phone'], ['salary', 'Hourly rate / pay rate'], ['overtimeRate', 'Overtime rate per hour'], ['salaryType', 'Pay basis'], ['allowances', 'Regular allowances'], ['bonus', 'Regular bonus'], ['commission', 'Regular commission'], ['regularDeductions', 'Regular deductions'], ['effectiveDate', 'Rate effective date'], ['payFrequency', 'Pay frequency'], ['status', 'Status']],
  'payroll-runs': [],
  'money-tracker': [['name', 'Description'], ['category', 'Category'], ['amount', 'Amount'], ['date', 'Date']],
  notepad: [['name', 'Title'], ['content', 'Note'], ['updated', 'Last updated']]
};

const titles = {
  home: 'Main dashboard', 'supplier-dashboard': 'G4 Sticker dashboard', suppliers: 'Suppliers',
  products: 'Products', materials: 'Materials', prices: 'Supplier prices', purchases: 'Purchases',
  'excel-sheet': 'Excel sheet', 'supplier-reports': 'G4 Sticker reports',
  scheduler: 'Scheduler', bookings: 'Bookings', clients: 'Clients', income: 'Income', expenses: 'Expenses', profit: 'Profit',
  shareholders: 'Shareholders', employees: 'Employees', 'payroll-runs': 'Pay runs', 'money-tracker': 'Money tracker',
  notepad: 'Notepad', settings: 'Settings'
};

const defaultAppearance = { accent: '#6967d9', textScale: 1.15, nightMode: true };
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
        : defaultAppearance.textScale,
      nightMode: saved.nightMode !== false
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
  const popoverRef = useRef(null);
  const [selectedValue, setSelectedValue] = useState(value);
  const selectedDate = dateFromValue(selectedValue);
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = selectedDate || new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });

  function updatePopoverPosition() {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(290, window.innerWidth - 32);
    const height = 320;
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    const below = rect.bottom + 8;
    const top = below + height <= window.innerHeight - 12
      ? below
      : Math.max(12, rect.top - height - 8);
    setPopoverPosition({ top, left });
  }

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(event) {
      if (!wrapperRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', updatePopoverPosition, true);
    window.addEventListener('resize', updatePopoverPosition);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', updatePopoverPosition, true);
      window.removeEventListener('resize', updatePopoverPosition);
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
          if (!open) updatePopoverPosition();
          setOpen((current) => !current);
        }}>
        <span className={selectedDate ? '' : 'date-placeholder'}>
          {selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Choose a date'}
        </span>
        <span className="date-trigger-icon" aria-hidden="true">▦</span>
      </button>
      {open && createPortal(
        <div className="calendar-popover" ref={popoverRef} style={{ top: popoverPosition.top, left: popoverPosition.left }} role="dialog" aria-label="Choose a date">
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
        </div>, document.body
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
  const [modalError, setModalError] = useState('');
  const [editing, setEditing] = useState(null);
  const [sheetEmployee, setSheetEmployee] = useState(null);
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState('checking');
  const [notice, setNotice] = useState('');
  const [appearance, setAppearance] = useState(readAppearance);
  const [appearanceError, setAppearanceError] = useState('');
  const [notifications, setNotifications] = useState({ count: 0, bookings: [] });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [dashboard, setDashboard] = useState({
    totals: { income: 0, expenses: 0, materialCosts: 0, costedBookings: 0, incomeEntries: 0, expenseEntries: 0, bookings: 0, clients: 0, materials: 0, lowStockMaterials: 0, suppliers: 0, products: 0, inventory: 0 },
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
    document.documentElement.dataset.theme = appearance.nightMode ? 'dark' : 'light';
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = appearance.nightMode ? '#05050A' : '#f2f6fb';
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
    if (!['home', 'supplier-dashboard', 'supplier-reports'].includes(active)) return;
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
    fetch(`/api/records/${resource}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load records.');
        return data;
      })
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
    setModalError('');
    setModal(true);
  }

  function openEdit(record) {
    setEditing(record);
    setModalError('');
    setModal(true);
  }

  async function saveRecord(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(fields.map(([key]) => [key, form.get(key)]));
    if (resource === 'payroll-runs') {
      body.netPay = Math.round(((Number(body.grossPay) || 0) - (Number(body.deductions) || 0)) * 100) / 100;
    }
    const url = editing
      ? resource === 'bookings' ? `/api/bookings/${editing.id}` : `/api/records/${resource}/${editing.id}`
      : `/api/records/${resource}`;
    setModalError('');
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
      setModalError(saveError.message);
    }
  }

  async function deleteRecord(record) {
    if (!window.confirm(`Delete "${record[fields[0]?.[0]] || 'this record'}"? This can’t be undone.`)) return;
    try {
      const url = resource === 'bookings' ? `/api/bookings/${record.id}` : `/api/records/${resource}/${record.id}`;
      const response = await fetch(url, { method: 'DELETE' });
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
          <div className="brand-mark"><img className="brand-logo" src={logo} alt="G Sticker Works logo" /></div>
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
            <span aria-hidden="true">↗</span>
          </div>
          <div className="profile-button">
            <div className="profile-avatar">JD</div>
            <div className="profile-copy"><strong>Jamie Davis</strong><span>Workspace admin</span></div>
            <span className="profile-menu">···</span>
          </div>
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
              onCreate={openCreate} onEdit={openEdit} onDelete={deleteRecord} />
          ) : ['supplier-dashboard', 'supplier-reports'].includes(active) ? (
            <DashboardPage onNavigate={navigate} data={dashboard} compact="G4 Sticker" />
          ) : active === 'settings' ? (
            <SettingsPage health={health} appearance={appearance} onAppearanceChange={setAppearance} appearanceError={appearanceError} />
          ) : active === 'materials' ? (
            <MaterialsPage />
          ) : active === 'suppliers' ? (
            <SuppliersPage />
          ) : active === 'purchases' ? (
            <PurchasesPage />
          ) : active === 'prices' ? (
            <SupplierPricesPage />
          ) : active === 'products' ? (
            <ProductsPage />
          ) : active === 'bookings' ? (
            <BookingsPage active={active} title={activeLabel} fields={fields} records={filteredRecords} loading={loading}
              search={search} setSearch={setSearch} onCreate={openCreate}
              onEdit={openEdit} onDelete={deleteRecord} />
          ) : active === 'income' ? (
            <IncomePage active={active} title={activeLabel} fields={fields} records={filteredRecords} loading={loading}
              search={search} setSearch={setSearch} onCreate={openCreate}
              onEdit={openEdit} onDelete={deleteRecord} />
          ) : active === 'expenses' ? (
            <ExpensesPage active={active} title={activeLabel} fields={fields} records={filteredRecords} loading={loading}
              search={search} setSearch={setSearch} onCreate={openCreate}
              onEdit={openEdit} onDelete={deleteRecord} />
          ) : active === 'payroll-runs' ? (
            <PayrollPage onOpenEmployee={setSheetEmployee} onEditEmployee={openEdit} />
          ) : active === 'employees' ? (
            <EmployeesPage employees={filteredRecords} loading={loading} search={search} setSearch={setSearch}
              onCreate={openCreate} onEdit={openEdit} onDelete={deleteRecord} onSelect={setSheetEmployee} />
          ) : (
            <RecordManagementPage active={active} title={activeLabel} fields={fields} records={filteredRecords} loading={loading}
              search={search} setSearch={setSearch}
              onCreate={openCreate}
              onEdit={openEdit} onDelete={deleteRecord}
              onSelect={active === 'employees' ? setSheetEmployee : undefined}
              pageClass={active === 'suppliers' ? 'suppliers-page' : active === 'products' ? 'products-page' : 'record-management-page'} />
          )}
        </div>
      </main>
      {modal && <RecordModal title={activeLabel} active={active} fields={fields} record={editing} saveError={modalError} onClose={() => setModal(false)} onSave={saveRecord} />}
      {sheetEmployee && <EmployeeMonthlySheet employee={sheetEmployee} onClose={() => setSheetEmployee(null)} />}
    </div>
  );
}

function RecordModal({ title, active, fields, record, saveError, onClose, onSave }) {
  const [dateError, setDateError] = useState('');
  const [bookingClients, setBookingClients] = useState([]);
  const [grossPay, setGrossPay] = useState(Number(record?.grossPay) || 0);
  const [deductions, setDeductions] = useState(Number(record?.deductions) || 0);
  const calculatedNetPay = Math.round((grossPay - deductions) * 100) / 100;
  useEffect(() => {
    if (active !== 'bookings') return undefined;
    const controller = new AbortController();
    fetch('/api/records/clients', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Could not load clients.'); return response.json(); })
      .then(setBookingClients)
      .catch((error) => { if (error.name !== 'AbortError') setBookingClients([]); });
    return () => controller.abort();
  }, [active]);
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
      <div className="modal-fields">{fields.map(([key, label]) => (
        <RecordField key={key} active={active} keyName={key} label={label} record={record}
          clients={bookingClients}
          grossPay={grossPay} deductions={deductions} calculatedNetPay={calculatedNetPay}
          onGrossPayChange={setGrossPay} onDeductionsChange={setDeductions} />
      ))}</div>
      {dateError && <p className="date-validation-error" role="alert">{dateError}</p>}
      {saveError && <p className="modal-save-error" role="alert">{saveError}</p>}
      <div className="modal-footer"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button">{record ? 'Save changes' : 'Add record'}</button></div>
    </form>
  </div>;
}

function RecordField({ active, keyName: key, label, record, clients = [], grossPay, deductions, calculatedNetPay, onGrossPayChange, onDeductionsChange }) {
  const isNumeric = ['amount', 'price', 'income', 'expenses', 'stock', 'shares', 'percentage', 'salary', 'overtimeRate', 'allowances', 'bonus', 'commission', 'regularDeductions', 'grossPay', 'deductions', 'netPay'].includes(key);
  const step = ['amount', 'price', 'income', 'expenses', 'percentage', 'salary', 'overtimeRate', 'allowances', 'bonus', 'commission', 'regularDeductions', 'grossPay', 'deductions', 'netPay'].includes(key) ? '0.01' : undefined;
  const isCalculatedNetPay = active === 'payroll-runs' && key === 'netPay';
  return <label className={key === 'content' ? 'wide-field' : ''}><span>{label}</span>
    {['content', 'notes', ...(active === 'clients' ? ['address'] : [])].includes(key)
      ? <textarea name={key} placeholder={label} defaultValue={record?.[key] || ''} rows={key === 'notes' ? 4 : 3} required={active === 'clients' ? key === 'name' : key === 'content'} />
      : key === 'category' && active === 'products'
        ? <select name={key} defaultValue={record?.[key] || ''} required><option value="" disabled>Select a product type</option>{['Sticker', 'Cap', 'Mug', 'Tarpaulin', ...(record?.[key] && !['Sticker', 'Cap', 'Mug', 'Tarpaulin'].includes(record[key]) ? [record[key]] : [])].map((category) => <option key={category} value={category}>{category}</option>)}</select>
        : key === 'client' && active === 'bookings'
          ? <select name={key} defaultValue={record?.[key] || ''} required><option value="" disabled>Select a client</option>{record?.[key] && !clients.some((client) => client.name === record.client) && <option value={record.client}>{record.client}</option>}{clients.map((client) => <option key={client.id} value={client.name}>{client.name}</option>)}</select>
        : key === 'payFrequency' && active === 'employees'
          ? <select name={key} defaultValue={record?.[key] || 'Monthly'}><option>Weekly</option><option>Biweekly</option><option>Semimonthly</option><option>Monthly</option></select>
          : key === 'salaryType' && active === 'employees'
            ? <select name={key} defaultValue={record?.[key] || 'hourly'}><option value="hourly">Hourly rate</option><option value="daily">Daily rate</option><option value="monthly">Monthly salary</option></select>
          : key === 'status' && active === 'employees'
            ? <select name={key} defaultValue={record?.[key] || 'Active'}><option>Active</option><option>On leave</option><option>Inactive</option></select>
            : key === 'status' && active === 'bookings'
              ? <select name={key} defaultValue={record?.[key] || 'Scheduled'}><option>Scheduled</option><option>In progress</option><option>On hold</option><option>Cancelled</option>{record?.[key] && !['Scheduled', 'In progress', 'On hold', 'Cancelled'].includes(record.status) && <option>{record.status}</option>}</select>
            : key === 'status' && active === 'payroll-runs'
              ? <select name={key} defaultValue={record?.[key] || 'Draft'}><option>Draft</option><option>Processing</option><option>Paid</option><option>Failed</option></select>
              : key.toLowerCase().includes('date') || key === 'updated'
                ? <DatePicker name={key} value={record?.[key] || ''} required={key !== 'updated'} />
                : <input name={key} placeholder={label} type={isNumeric ? 'number' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} step={step}
                    min={['salary', 'overtimeRate', 'grossPay', 'deductions'].includes(key) ? '0' : undefined}
                    value={isCalculatedNetPay ? calculatedNetPay : undefined}
                    defaultValue={isCalculatedNetPay ? undefined : record?.[key] || ''}
                    readOnly={isCalculatedNetPay}
                    onChange={key === 'grossPay' && active === 'payroll-runs' ? (event) => onGrossPayChange(Number(event.target.value) || 0) : key === 'deductions' && active === 'payroll-runs' ? (event) => onDeductionsChange(Number(event.target.value) || 0) : undefined}
                    required={active === 'clients' ? key === 'name' : active === 'employees' ? ['employeeId', 'name', 'salary'].includes(key) : key !== 'phone'} />}
  </label>;
}

export default App;
