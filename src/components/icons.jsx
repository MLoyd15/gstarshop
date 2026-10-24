// Usage: <AppIcon icon={navIcons.bookings} />; nav item ids map to components below.
import {
  BookOpen,
  Boxes,
  CalendarDays,
  ChartColumn,
  IdCard,
  LayoutDashboard,
  NotebookPen,
  Package,
  Settings,
  ShoppingCart,
  Tag,
  Truck,
  Users,
  Wallet
} from 'lucide-react';

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
