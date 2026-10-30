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
import GuidePage from './pages/GuidePage.jsx';
import logo from './assets/logo.png';
import { AppIcon, navIcons } from './components/icons.jsx';
import { ArrowRight, Bell, CalendarDays, ChevronLeft, ChevronRight, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, X } from './components/icons.jsx';
import { Alert, NOTICE_TIMEOUT_MS } from './components/ui/alert.tsx';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog.tsx';
import { ConfirmDialog } from './components/ui/alert-dialog.tsx';
import AccountMenu from './components/auth/AccountMenu.jsx';
import { useAuth } from './components/auth/AuthProvider.jsx';

const sections = [
  { heading: 'Overview', items: [
    { id: 'supplier-dashboard', label: 'Dashboard' },
    { id: 'supplier-reports', label: 'Reports' }
  ] },
  { heading: 'Sales', items: [
    { id: 'clients', label: 'Clients' },
    { id: 'bookings', label: 'Bookings' }
  ] },
  { heading: 'Inventory', items: [
    { id: 'materials', label: 'Materials' },
    { id: 'products', label: 'Products' }
  ] },
  { heading: 'Purchasing', items: [
    { id: 'suppliers', label: 'Suppliers' },
    { id: 'prices', label: 'Supplier prices' },
    { id: 'purchases', label: 'Purchases' }
  ] },
  { heading: 'Finance', items: [
    { id: 'income', label: 'Income' },
    { id: 'expenses', label: 'Expenses' }
  ] },
  { heading: 'Payroll system', items: [
    { id: 'employees', label: 'Employees' },
    { id: 'payroll-runs', label: 'Pay runs' }
  ] },
  { heading: 'Help', items: [
    { id: 'guide', label: 'Learn the flow' }
  ] }
];

const resourceFor = {
  'excel-sheet': 'excel-sheet', scheduler: 'scheduler',
  bookings: 'bookings', clients: 'clients', income: 'income', expenses: 'expenses', profit: 'profit',
  employees: 'employees', 'payroll-runs': 'payroll-runs',
  shareholders: 'shareholders', notepad: 'notepad'
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
  employees: [['employeeId', 'Employee ID'], ['name', 'Full name'], ['position', 'Position'], ['email', 'Email'], ['phone', 'Phone'], ['salary', 'Hourly rate / pay rate'], ['holidayRate', 'Holiday rate per hour'], ['salaryType', 'Pay basis'], ['allowances', 'Regular allowances'], ['bonus', 'Regular bonus'], ['commission', 'Regular commission'], ['regularDeductions', 'Regular deductions'], ['effectiveDate', 'Rate effective date'], ['payFrequency', 'Pay frequency'], ['status', 'Status']],
  'payroll-runs': [],
  notepad: [['name', 'Title'], ['content', 'Note'], ['updated', 'Last updated']]
};

const OVERTIME_RATE_KEY = 'gstarshop.defaultOvertimeRate';
const HOLIDAY_RATE_KEY = 'gstarshop.defaultHolidayRate';
const SIDEBAR_COLLAPSED_KEY = 'gstarshop.sidebarCollapsed';
function readDefaultRate(key) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value >= 0 ? String(value) : '0';
  } catch { return '0'; }
}

function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch { return false; }
}

const titles = {
  'supplier-dashboard': 'G4 Sticker dashboard', suppliers: 'Suppliers',
  products: 'Products', materials: 'Materials', prices: 'Supplier prices', purchases: 'Purchases',
  'excel-sheet': 'Excel sheet', 'supplier-reports': 'G4 Sticker reports',
  scheduler: 'Scheduler', bookings: 'Bookings', clients: 'Clients', income: 'Income', expenses: 'Expenses', profit: 'Profit',
  shareholders: 'Shareholders', employees: 'Employees', 'payroll-runs': 'Pay runs',
  notepad: 'Notepad', settings: 'Settings', guide: 'Learn the flow'
};

const defaultAppearance = { accent: '#0878b8', textScale: 1.15, nightMode: true };
const accentPresets = [
  { label: 'Cyan', value: '#0878b8' },
  { label: 'Violet', value: '#6967d9' },
  { label: 'Forest', value: '#26836b' },
  { label: 'Coral', value: '#b94753' },
  { label: 'Amber', value: '#a66a10' }
];

function accentTextColor(hex) {
  const channel = (start) => { const value = parseInt(hex.slice(start, start + 2), 16) / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? '#ffffff' : '#04101c';
}

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
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function DatePicker({ name, value, required }) {
  const wrapperRef = useRef(null);
  const popoverRef = useRef(null);
  const normalizedValue = dateFromValue(value) ? toDateValue(dateFromValue(value)) : '';
  const [selectedValue, setSelectedValue] = useState(normalizedValue);
  const selectedDate = dateFromValue(selectedValue);
  const [open, setOpen] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initialDate = selectedDate || new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });

  useEffect(() => {
    setSelectedValue(normalizedValue);
    const nextDate = dateFromValue(normalizedValue);
    if (nextDate) setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  }, [normalizedValue]);

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
      <button type="button" className={`input date-picker-trigger${open ? 'is-open' : ''}`}
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
        <AppIcon icon={CalendarDays} size="sm" className="date-trigger-icon" />
      </button>
      {open && createPortal(
        <div className="calendar-popover" ref={popoverRef} style={{ top: popoverPosition.top, left: popoverPosition.left }} role="group" aria-label="Choose a date">
          <div className="calendar-heading">
            <div className="calendar-heading-copy"><span>SELECT DATE</span><strong>{monthLabel}</strong></div>
            <div className="calendar-month-nav">
              <button className="btn btn-icon btn-ghost" type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}><AppIcon icon={ChevronLeft} /></button>
              <button className="btn btn-icon btn-ghost" type="button" aria-label="Next month" onClick={() => changeMonth(1)}><AppIcon icon={ChevronRight} /></button>
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
              return <button type="button" className={`btn btn-ghost btn-sm ${dayClasses}`} key={dateValue}
                aria-label={date.toLocaleDateString('en-US', { dateStyle: 'full' })}
                aria-pressed={dateValue === selectedValue}
                onClick={() => chooseDate(date)}>{date.getDate()}</button>;
            })}
          </div>
          <div className="calendar-footer">
            <button type="button" className="btn calendar-clear btn-secondary" onClick={() => { setSelectedValue(''); setOpen(false); }}>Clear date</button>
            <button type="button" className="btn calendar-today btn-secondary" onClick={() => chooseDate(new Date())}>Today</button>
          </div>
        </div>, document.body
      )}
    </div>
  );
}


function App() {
  const auth = useAuth();
  const [active, setActive] = useState('supplier-dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches);
  const sidebarRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const globalSearchRef = useRef(null);
  const drawerWasOpen = useRef(false);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [sheetEmployee, setSheetEmployee] = useState(null);
  const [search, setSearch] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [systemSearchResults, setSystemSearchResults] = useState([]);
  const [systemSearchLoading, setSystemSearchLoading] = useState(false);
  const [systemSearchError, setSystemSearchError] = useState('');
  const [health, setHealth] = useState('checking');
  const [notice, setNotice] = useState('');
  const noticeTimeoutRef = useRef(null);
  const [appearance, setAppearance] = useState(readAppearance);
  const [defaultOvertimeRate, setDefaultOvertimeRate] = useState(() => readDefaultRate(OVERTIME_RATE_KEY));
  const [defaultHolidayRate, setDefaultHolidayRate] = useState(() => readDefaultRate(HOLIDAY_RATE_KEY));
  const [dashboardPeriod, setDashboardPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [dashboardMonths, setDashboardMonths] = useState(6);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [appearanceError, setAppearanceError] = useState('');
  const [notifications, setNotifications] = useState({ count: 0, bookings: [] });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [dashboard, setDashboard] = useState({
    period: new Date().toISOString().slice(0, 7), previousPeriod: '',
    totals: { income: 0, expenses: 0, payrollPaid: 0, materialCosts: 0, expenseCategories: {}, incomeEntries: 0, expenseEntries: 0, bookings: 0, clients: 0, materials: 0, lowStockMaterials: 0, suppliers: 0, products: 0 },
    comparison: { current: { income: 0, expenses: 0, payrollPaid: 0, materialCosts: 0 }, previous: { income: 0, expenses: 0, payrollPaid: 0, materialCosts: 0 } },
    payroll: { runCount: 0, employeeCount: 0, draftCount: 0, finalizedCount: 0, partiallyPaidCount: 0, paidCount: 0, gross: 0, overtime: 0, deductions: 0, net: 0, paid: 0, outstandingFinalized: 0 },
    financialLimits: { salesRevenueTrackedSeparately: false, customerReceivablesTracked: false, profitReliable: false },
    months: [],
    recent: [], attention: [], operationCharts: { bookings: { active: 0, completed: 0 }, materials: { healthy: 0, low: 0, out: 0 }, purchasing: { awaitingReceipt: 0, balanceDue: 0 } }
  });

  const allItems = useMemo(() => sections.flatMap((section) => section.items), []);
  const activeLabel = titles[active] || allItems.find((item) => item.id === active)?.label || 'Dashboard';
  const resource = resourceFor[active];
  const fields = fieldsFor[active] || [];

  useEffect(() => () => {
    if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 800px)');
    const updateViewport = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(media.matches);
    media.addEventListener('change', updateViewport);
    return () => media.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    function handleGlobalSearchKeys(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchExpanded(true);
        globalSearchRef.current?.focus();
      } else if (event.key === 'Escape' && document.activeElement === globalSearchRef.current) {
        if (searchPanelOpen) setSearchPanelOpen(false);
        else if (search) setSearch('');
        else {
          globalSearchRef.current?.blur();
          setSearchExpanded(false);
        }
      }
    }
    window.addEventListener('keydown', handleGlobalSearchKeys);
    return () => window.removeEventListener('keydown', handleGlobalSearchKeys);
  }, [search, searchPanelOpen]);

  useEffect(() => {
    if (searchExpanded) globalSearchRef.current?.focus();
  }, [searchExpanded]);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setSystemSearchResults([]);
      setSystemSearchLoading(false);
      setSystemSearchError('');
      return undefined;
    }
    setSystemSearchResults([]);
    setSystemSearchLoading(true);
    setSystemSearchError('');
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSystemSearchLoading(true);
      setSystemSearchError('');
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Search is unavailable right now.');
        setSystemSearchResults(Array.isArray(data.results) ? data.results : []);
      } catch (error) {
        if (error.name !== 'AbortError') setSystemSearchError(error.message);
      } finally {
        if (!controller.signal.aborted) setSystemSearchLoading(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search]);

  useEffect(() => {
    if (!mobileOpen || !isMobileViewport) return undefined;
    sidebarRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen, isMobileViewport]);

  useEffect(() => {
    if (isMobileViewport && drawerWasOpen.current && !mobileOpen) mobileMenuRef.current?.focus();
    drawerWasOpen.current = mobileOpen;
  }, [mobileOpen, isMobileViewport]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', appearance.accent);
    document.documentElement.style.setProperty('--accent-contrast', accentTextColor(appearance.accent));
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

  useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed)); }
    catch { /* Sidebar preference remains active for the current session. */ }
  }, [sidebarCollapsed]);

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
    if (!['supplier-dashboard', 'supplier-reports'].includes(active)) return;
    const controller = new AbortController();
    setDashboardLoading(true);
    fetch(`/api/dashboard?period=${dashboardPeriod}&months=${dashboardMonths}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load dashboard data.');
        return data;
      })
      .then(setDashboard)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => { if (!controller.signal.aborted) setDashboardLoading(false); });
    return () => controller.abort();
  }, [active, dashboardPeriod, dashboardMonths]);

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
    setSearchExpanded(false);
    setSearchPanelOpen(false);
  }

  function openSearchResult(result) {
    const resourcePages = {
      suppliers: 'suppliers', products: 'products', inventory: 'materials', materials: 'materials',
      prices: 'prices', 'supplier-prices': 'prices', purchases: 'purchases', 'purchase-orders': 'purchases',
      'purchase-order-counters': 'purchases', 'excel-sheet': 'excel-sheet', scheduler: 'scheduler',
      bookings: 'bookings', clients: 'clients', income: 'income', expenses: 'expenses', profit: 'profit',
      shareholders: 'shareholders', employees: 'employees', 'payroll-runs': 'payroll-runs',
      'payroll-timesheets': 'employees', 'stock-movements': 'materials', notepad: 'notepad',
      'material-categories': 'materials'
    };
    const destination = resourcePages[result.resource];
    if (!destination) return;
    setActive(destination);
    setMobileOpen(false);
    setNotificationsOpen(false);
    setSearchPanelOpen(false);
    setSearchExpanded(false);
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
    setModalSaving(true);
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
      if (noticeTimeoutRef.current !== null) window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = window.setTimeout(() => {
        setNotice('');
        noticeTimeoutRef.current = null;
      }, NOTICE_TIMEOUT_MS);
    } catch (saveError) {
      setModalError(saveError.message);
    } finally {
      setModalSaving(false);
    }
  }

  function deleteRecord(record) {
    setConfirmDialog({ record, title: `Delete "${record[fields[0]?.[0]] || 'this record'}"?` });
  }

  async function confirmDelete() {
    if (!confirmDialog) return;
    setConfirmBusy(true);
    try {
      const { record } = confirmDialog;
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
    } finally {
      setConfirmDialog(null);
      setConfirmBusy(false);
    }
  }

  const filteredRecords = records.filter((record) =>
    Object.values(record).some((value) => String(value).toLowerCase().includes(search.toLowerCase()))
  );
  const query = search.trim().toLowerCase();
  const matchingPages = query ? allItems.filter((item) => item.label.toLowerCase().includes(query)).slice(0, 5) : [];

  return (
    <div className={`app-shell${sidebarCollapsed && !isMobileViewport ? ' sidebar-collapsed' : ''}`}>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside id="app-sidebar" ref={sidebarRef} tabIndex={-1} inert={isMobileViewport && !mobileOpen ? '' : undefined} className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><img className="brand-logo" src={logo} alt="G Sticker Works logo" /></div>
          <span className="brand-name">G4 <span>Sticker</span></span>
          <button type="button" className="btn btn-icon btn-ghost sidebar-collapse-toggle" aria-expanded={!sidebarCollapsed} aria-controls="app-sidebar" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>
            <AppIcon icon={sidebarCollapsed ? PanelLeftOpen : PanelLeftClose} />
          </button>
        </div>
        <nav className="navigation" aria-label="Main">
          {sections.map((section) => (
            <div className="nav-section" key={section.heading}>
              <div className="nav-heading">{section.heading}</div>
              <ul className="nav-list">
                {section.items.map((item) => (
                  <li key={`${section.heading}-${item.id}`}>
                    <button type="button" className={`btn nav-item btn-ghost${active === item.id ? ' active' : ''}`}
                      aria-label={item.label} aria-current={active === item.id ? 'page' : undefined} title={item.label}
                      onClick={() => navigate(item.id)}>
                      <AppIcon icon={navIcons[item.id]} /><span className="nav-label">{item.label}</span>
                      {item.badge && <span className="nav-badge">{item.badge}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="nav-divider" />
          <ul className="nav-list nav-utility-list">
            {['notepad', 'settings'].map((id) => {
              const label = id === 'notepad' ? 'Notepad' : 'Settings';
              return <li key={id}><button type="button" className={`btn nav-item btn-ghost${active === id ? ' active' : ''}`}
                aria-label={label} aria-current={active === id ? 'page' : undefined} title={label} onClick={() => navigate(id)}>
                <AppIcon icon={navIcons[id]} /><span className="nav-label">{label}</span>
              </button></li>;
            })}
          </ul>
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button ref={mobileMenuRef} type="button" className="btn mobile-menu-button btn-icon btn-ghost" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileOpen} aria-controls="app-sidebar" title={mobileOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMobileOpen((open) => !open)}><AppIcon icon={Menu} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{activeLabel}</strong></div>
          <div className="topbar-actions">
            <span className={`connection-status ${health}`}><span className="status-dot" />{health === 'connected' ? 'All systems live' : health === 'checking' ? 'Connecting…' : 'Offline'}</span>
            {active !== 'guide' && <>
              <button type="button" className="btn icon-button search-shortcut btn-icon btn-ghost" aria-label="Search" title="Search" onClick={() => document.querySelector('.global-search input')?.focus()}><AppIcon icon={Search} /></button>
              <div className="global-search-wrap">
                <label className={`global-search${searchExpanded ? ' search-expanded' : ''}`} onClick={() => { if (isMobileViewport) setSearchExpanded(true); }}><span aria-hidden="true"><AppIcon icon={Search} size="sm" /></span><input ref={globalSearchRef} className="input input-sm" placeholder="Search anything..." aria-label="Search anything..." value={search} onFocus={() => setSearchPanelOpen(true)} onChange={(event) => { setSearch(event.target.value); setSearchPanelOpen(true); }} /><kbd>⌘ K</kbd></label>
                {search && (!isMobileViewport || searchExpanded) && <button type="button" className="search-clear" aria-label="Clear search" title="Clear search" onClick={() => { setSearch(''); setSearchPanelOpen(true); globalSearchRef.current?.focus(); }}><AppIcon icon={X} size="sm" /></button>}
                {searchPanelOpen && query && <div className="global-search-results" role="region" aria-label="Search results">
                  {matchingPages.length > 0 && <><div className="global-search-group-label">Sections</div>{matchingPages.map((item) => <button type="button" className="global-search-result" key={item.id} onClick={() => navigate(item.id)}><AppIcon icon={navIcons[item.id] || Search} size="sm" /><span>{item.label}</span><small>Open section</small></button>)}</>}
                  {systemSearchResults.length > 0 && <><div className="global-search-group-label">Records across G4 Sticker</div>{systemSearchResults.map((result) => <button type="button" className="global-search-result" key={`${result.resource}-${result.id}`} onClick={() => openSearchResult(result)}><AppIcon icon={navIcons[result.resource] || Search} size="sm" /><span>{result.title}{result.summary && <small className="global-search-summary">{result.summary}</small>}</span><small>{result.resource.replaceAll('-', ' ')}</small></button>)}</>}
                  {systemSearchLoading && <p className="global-search-empty">Searching all sections…</p>}
                  {systemSearchError && <p className="global-search-empty" role="alert">{systemSearchError}</p>}
                  {!systemSearchLoading && !systemSearchError && query.length < 2 && !matchingPages.length && <p className="global-search-empty">Type at least 2 characters to search records.</p>}
                  {!systemSearchLoading && !systemSearchError && query.length >= 2 && !matchingPages.length && !systemSearchResults.length && <p className="global-search-empty">No matching sections or records.</p>}
                </div>}
              </div>
            </>}
            <button
              type="button"
              className="btn icon-button theme-toggle btn-icon btn-ghost"
              aria-label={appearance.nightMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={appearance.nightMode ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setAppearance((prev) => ({ ...prev, nightMode: !prev.nightMode }))}
            >
              <AppIcon icon={appearance.nightMode ? Sun : Moon} />
            </button>
            <div className="notification-wrap">
              <button className={`btn icon-button notification-button btn-icon btn-ghost${notificationsOpen ? 'is-open' : ''}`}
                aria-label="Notifications" aria-expanded={notificationsOpen}
                title="Notifications" onClick={() => setNotificationsOpen((open) => !open)}>
                <AppIcon icon={Bell} />{notifications.count > 0 && <span className="notification-count">{notifications.count > 99 ? '99+' : notifications.count}</span>}
              </button>
              {notificationsOpen && <div id="notifications-popover" className="notification-popover">
                <div className="notification-heading"><div><strong>Notifications</strong><span>Ongoing bookings</span></div><span className="notification-heading-count">{notifications.count}</span></div>
                {notificationsError ? <p className="notification-empty">{notificationsError}</p>
                  : notifications.bookings.length ? <div className="notification-list">{notifications.bookings.map((booking) => (
                    <button className="notification-item" key={booking.id} onClick={() => { setNotificationsOpen(false); navigate('bookings'); }}>
                      <span className="notification-item-icon" aria-hidden="true"><AppIcon icon={navIcons.bookings} size="sm" /></span>
                      <span className="notification-item-copy"><strong>{booking.name}</strong>
                        <span>{[booking.client, booking.date ? new Date(`${booking.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '', booking.status].filter(Boolean).join(' · ')}</span>
                      </span><span className="notification-item-arrow" aria-hidden="true"><AppIcon icon={ArrowRight} size="sm" /></span>
                    </button>
                  ))}</div> : <p className="notification-empty">No ongoing bookings right now. New active bookings will appear here.</p>}
                <button type="button" className="btn notification-view-all btn-secondary" onClick={() => { setNotificationsOpen(false); navigate('bookings'); }}>View all bookings <span aria-hidden="true"><AppIcon icon={ArrowRight} size="sm" /></span></button>
              </div>}
            </div>
            <AccountMenu />
          </div>
        </header>
        <div className="content">
          {error && <Alert variant="error" title="Couldn’t load your data" dismissible onDismiss={() => setError('')}>{error} Check your server and MongoDB connection, then refresh.</Alert>}
          {notice && <Alert variant="success">{notice}</Alert>}
          {active === 'guide' ? (
            <GuidePage onNavigate={navigate} />
          ) : active === 'clients' ? (
            <ClientsPage clients={filteredRecords} loading={loading} search={search} setSearch={setSearch}
              onCreate={openCreate} onEdit={openEdit} onDelete={deleteRecord} />
          ) : ['supplier-dashboard', 'supplier-reports'].includes(active) ? (
            <DashboardPage onNavigate={navigate} data={dashboard} loading={dashboardLoading} period={dashboardPeriod} onPeriodChange={setDashboardPeriod} chartMonths={dashboardMonths} onChartMonthsChange={setDashboardMonths} compact="G4 Sticker" />
          ) : active === 'settings' ? (
            <SettingsPage health={health} appearance={appearance} onAppearanceChange={setAppearance} appearanceError={appearanceError} onNavigate={navigate} auth={auth} />
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
            <PayrollPage defaultOvertimeRate={defaultOvertimeRate} onOpenEmployee={setSheetEmployee} onEditEmployee={openEdit} />
          ) : active === 'employees' ? (
            <EmployeesPage employees={filteredRecords} loading={loading} search={search} setSearch={setSearch}
              defaultOvertimeRate={defaultOvertimeRate} onDefaultOvertimeRateChange={(value) => {
                setDefaultOvertimeRate(value);
                try { window.localStorage.setItem(OVERTIME_RATE_KEY, value); } catch { /* Storage may be unavailable. */ }
              }}
              defaultHolidayRate={defaultHolidayRate} onDefaultHolidayRateChange={(value) => {
                setDefaultHolidayRate(value);
                try { window.localStorage.setItem(HOLIDAY_RATE_KEY, value); } catch { /* Storage may be unavailable. */ }
              }}
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
      {modal && <RecordModal title={activeLabel} active={active} fields={fields} record={editing} defaultHolidayRate={defaultHolidayRate} saveError={modalError} saving={modalSaving} onClose={() => setModal(false)} onSave={saveRecord} />}
      <ConfirmDialog open={Boolean(confirmDialog)} title={confirmDialog?.title || ''} description="This can’t be undone." confirmLabel="Delete" busy={confirmBusy} onCancel={() => setConfirmDialog(null)} onConfirm={confirmDelete} />
      {sheetEmployee && <EmployeeMonthlySheet employee={sheetEmployee} overtimeRate={defaultOvertimeRate} onClose={() => setSheetEmployee(null)} />}
    </div>
  );
}

function RecordModal({ title, active, fields, record, defaultHolidayRate, saveError, saving, onClose, onSave }) {
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

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent size="md" busy={saving}>
      <form className="dialog-form" onSubmit={handleSubmit}>
        <DialogHeader>
          <div className="t-eyebrow"><span className="accent-line" />BUSINESS HUB</div>
          <DialogTitle>{record ? 'Edit' : 'Add'} {title.replace(/s$/, '')}</DialogTitle>
          <DialogClose disabled={saving} />
        </DialogHeader>
        <DialogBody>
          {saveError && <Alert variant="error">{saveError}</Alert>}
          <div className="record-fields">{fields.map(([key, label]) => (
        <RecordField key={key} active={active} keyName={key} label={label} record={record} defaultHolidayRate={defaultHolidayRate}
          clients={bookingClients}
          grossPay={grossPay} deductions={deductions} calculatedNetPay={calculatedNetPay}
          onGrossPayChange={setGrossPay} onDeductionsChange={setDeductions} />
          ))}</div>
          {dateError && <p className="field-error" role="alert">{dateError}</p>}
        </DialogBody>
        <DialogFooter>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" aria-busy={saving || undefined} disabled={saving}>{record ? 'Save changes' : 'Add record'}</button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function RecordField({ active, keyName: key, label, record, defaultHolidayRate, clients = [], grossPay, deductions, calculatedNetPay, onGrossPayChange, onDeductionsChange }) {
  const isNumeric = ['amount', 'price', 'income', 'expenses', 'stock', 'shares', 'percentage', 'salary', 'holidayRate', 'allowances', 'bonus', 'commission', 'regularDeductions', 'grossPay', 'deductions', 'netPay'].includes(key);
  const step = ['amount', 'price', 'income', 'expenses', 'percentage', 'salary', 'holidayRate', 'allowances', 'bonus', 'commission', 'regularDeductions', 'grossPay', 'deductions', 'netPay'].includes(key) ? '0.01' : undefined;
  const isCalculatedNetPay = active === 'payroll-runs' && key === 'netPay';
  return <label className={key === 'content' ? 'wide-field' : ''}><span>{label}</span>
    {['content', 'notes', ...(active === 'clients' ? ['address'] : [])].includes(key)
      ? <textarea className="textarea" name={key} placeholder={label} defaultValue={record?.[key] || ''} rows={key === 'notes' ? 4 : 3} required={active === 'clients' ? key === 'name' : key === 'content'} />
      : key === 'category' && active === 'products'
        ? <select className="select" name={key} defaultValue={record?.[key] || ''} required><option value="" disabled>Select a product type</option>{['Sticker', 'Cap', 'Mug', 'Tarpaulin', ...(record?.[key] && !['Sticker', 'Cap', 'Mug', 'Tarpaulin'].includes(record[key]) ? [record[key]] : [])].map((category) => <option key={category} value={category}>{category}</option>)}</select>
        : key === 'client' && active === 'bookings'
          ? <select className="select" name={key} defaultValue={record?.[key] || ''} required><option value="" disabled>Select a client</option>{record?.[key] && !clients.some((client) => client.name === record.client) && <option value={record.client}>{record.client}</option>}{clients.map((client) => <option key={client.id} value={client.name}>{client.name}</option>)}</select>
        : key === 'payFrequency' && active === 'employees'
          ? <select className="select" name={key} defaultValue={record?.[key] || 'Monthly'}><option>Weekly</option><option>Biweekly</option><option>Semimonthly</option><option>Monthly</option></select>
          : key === 'salaryType' && active === 'employees'
            ? <select className="select" name={key} defaultValue={record?.[key] || 'hourly'}><option value="hourly">Hourly rate</option><option value="daily">Daily rate</option><option value="monthly">Monthly salary</option></select>
          : key === 'status' && active === 'employees'
            ? <select className="select" name={key} defaultValue={record?.[key] || 'Active'}><option>Active</option><option>On leave</option><option>Inactive</option></select>
            : key === 'status' && active === 'bookings'
              ? <select className="select" name={key} defaultValue={record?.[key] || 'Scheduled'}><option>Scheduled</option><option>In progress</option><option>On hold</option><option>Cancelled</option>{record?.[key] && !['Scheduled', 'In progress', 'On hold', 'Cancelled'].includes(record.status) && <option>{record.status}</option>}</select>
            : key === 'status' && active === 'payroll-runs'
              ? <select className="select" name={key} defaultValue={record?.[key] || 'Draft'}><option>Draft</option><option>Processing</option><option>Paid</option><option>Failed</option></select>
              : key === 'effectiveDate' && active === 'employees'
                ? <input className="input" name={key} type="date" defaultValue={dateFromValue(record?.[key]) ? toDateValue(dateFromValue(record[key])) : ''} required />
              : key.toLowerCase().includes('date') || key === 'updated'
                ? <DatePicker name={key} value={record?.[key] || ''} required={key !== 'updated'} />
                : <input className="input" name={key} placeholder={label} type={isNumeric ? 'number' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} step={step}
                    min={['salary', 'holidayRate', 'grossPay', 'deductions'].includes(key) ? '0' : undefined}
                    value={isCalculatedNetPay ? calculatedNetPay : undefined}
                    defaultValue={isCalculatedNetPay ? undefined : key === 'holidayRate' && active === 'employees' ? (record?.[key] ?? defaultHolidayRate ?? '') : record?.[key] || ''}
                    readOnly={isCalculatedNetPay}
                    onChange={key === 'grossPay' && active === 'payroll-runs' ? (event) => onGrossPayChange(Number(event.target.value) || 0) : key === 'deductions' && active === 'payroll-runs' ? (event) => onDeductionsChange(Number(event.target.value) || 0) : undefined}
                    required={active === 'clients' ? key === 'name' : active === 'employees' ? ['employeeId', 'name', 'salary'].includes(key) : key !== 'phone'} />}
  </label>;
}

export default App;
