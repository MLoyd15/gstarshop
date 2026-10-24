// Usage: <AppIcon icon={navIcons.bookings} />; nav item ids map to components below.
import {
  BookOpen,
  Boxes,
  CalendarDays,
  ChartColumn,
  IdCard,
  LayoutDashboard,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Ellipsis,
  ExternalLink,
  List,
  Menu,
  Moon,
  NotebookPen,
  NotebookText,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  Sparkles,
  ShoppingCart,
  Sun,
  Tag,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  UserRound,
  Wallet,
  X
} from 'lucide-react';

export { ArrowRight, ArrowUpRight, Bell, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, CircleDot, Ellipsis, ExternalLink, List, Menu, Moon, NotebookText, Package, Pencil, Plus, Search, Settings, Sparkles, Sun, TrendingDown, TrendingUp, UserRound, Users, X };

export function AppIcon({ icon: IconComponent, size = 'md', className, style, ...props }) {
  return <IconComponent
    aria-hidden="true"
    focusable="false"
    className={className}
    style={{
      width: `var(--icon-${size})`,
      height: `var(--icon-${size})`,
      strokeWidth: 'var(--icon-stroke)',
      color: 'currentColor',
      flex: '0 0 auto',
      ...style
    }}
    {...props}
  />;
}

export const navIcons = {
  'supplier-dashboard': LayoutDashboard,
  'supplier-reports': ChartColumn,
  bookings: CalendarDays,
  clients: Users,
  employees: IdCard,
  'payroll-runs': Wallet,
  materials: Package,
  products: Boxes,
  suppliers: Truck,
  prices: Tag,
  purchases: ShoppingCart,
  guide: BookOpen,
  notepad: NotebookPen,
  settings: Settings
};
