'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/lib/store/auth-store';
import { Permission, userCan } from '@/lib/auth/permissions';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Inbox,
  Settings,
  KanbanSquare,
  PackageCheck,
  MessageSquare,
  Instagram,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  DollarSign,
  Megaphone,
  BarChart3,
  FileText,
  Clock,
  Building2,
  CreditCard,
  Wrench,
  ShoppingBag,
  BookOpen,
  Lock,
  List,
  Receipt,
  Gift,
} from 'lucide-react';
import { useOrgSettings } from '@/lib/api/hooks/use-org-settings';

interface NavItem {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconSrc?: string; // Optional: path to SVG/PNG icon (for custom icons like WhatsApp mono)
  permission: Permission;
  children?: NavItem[];
  ownerOnly?: boolean; // If true, show owner badge/icon
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard, permission: Permission.VIEW_DASHBOARD },
  {
    href: '/inbox',
    label: 'Inbox',
    icon: Inbox,
    permission: Permission.VIEW_INBOX,
    children: [
      { href: '/inbox/whatsapp', label: 'WhatsApp', icon: MessageSquare, iconSrc: '/icons/whatsapp-mono.svg', permission: Permission.VIEW_INBOX },
      { href: '/inbox/instagram', label: 'Instagram', icon: Instagram, permission: Permission.VIEW_INBOX },
      { href: '/inbox/unified', label: 'Unificado', icon: MessageCircle, permission: Permission.VIEW_INBOX },
    ],
  },
  { href: '/leads', label: 'Leads', icon: Users, permission: Permission.VIEW_LEADS },
  { href: '/leads/board', label: 'Kanban', icon: KanbanSquare, permission: Permission.VIEW_LEADS },
  {
    href: '/items',
    label: 'Items',
    icon: Package,
    permission: Permission.VIEW_DASHBOARD, // Visible if logged in
    children: [
      { href: '/items/items', label: 'Items', icon: Package, permission: Permission.VIEW_DASHBOARD },
      { href: '/items/price-lists', label: 'Price Lists', icon: DollarSign, permission: Permission.VIEW_DASHBOARD },
    ],
  },
  {
    href: '/inventory',
    label: 'Inventory',
    icon: PackageCheck,
    permission: Permission.VIEW_DASHBOARD, // Visible if logged in
    children: [
      { href: '/inventory/stock', label: 'Stock', icon: Package, permission: Permission.VIEW_DASHBOARD },
    ],
  },
  {
    href: '/stock',
    label: 'Stock',
    icon: Package,
    permission: Permission.VIEW_STOCK,
    children: [
      { href: '/stock/reservations', label: 'Reservas', icon: PackageCheck, permission: Permission.VIEW_STOCK },
    ],
  },
  {
    href: '/sales',
    label: 'Sales',
    icon: ShoppingCart,
    permission: Permission.VIEW_SALES,
    children: [
      { href: '/sales', label: 'Ventas', icon: ShoppingCart, permission: Permission.VIEW_SALES },
      { href: '/sales/customers', label: 'Clientes', icon: Users, permission: Permission.VIEW_CUSTOMERS },
      { href: '/sales/sellers', label: 'Vendedores', icon: Users, permission: Permission.VIEW_SALES, ownerOnly: true }, // Owner-only (checked in page)
    ],
  },
  {
    href: '/purchases',
    label: 'Purchases',
    icon: ShoppingBag,
    permission: Permission.VIEW_PURCHASES,
    children: [
      { href: '/purchases/vendors', label: 'Proveedores', icon: Building2, permission: Permission.VIEW_VENDORS },
      { href: '/purchases/expenses', label: 'Gastos', icon: Receipt, permission: Permission.VIEW_PURCHASES },
      { href: '/purchases/bills', label: 'Facturas', icon: FileText, permission: Permission.VIEW_PURCHASES },
      { href: '/purchases/payments-made', label: 'Pagos Enviados', icon: CreditCard, permission: Permission.VIEW_PURCHASES },
      { href: '/purchases/vendor-credits', label: 'Créditos a Favor', icon: Gift, permission: Permission.VIEW_PURCHASES },
      // Legacy routes (keep for compatibility)
      { href: '/sales/vendors', label: 'Proveedores (legacy)', icon: Building2, permission: Permission.VIEW_VENDORS },
      { href: '/sales/purchases', label: 'Compras (legacy)', icon: ShoppingBag, permission: Permission.VIEW_PURCHASES },
    ],
  },
  { href: '/pricing', label: 'Pricing', icon: DollarSign, permission: Permission.VIEW_DASHBOARD },
  { href: '/ads', label: 'Meta Ads', icon: Megaphone, permission: Permission.VIEW_INTEGRATIONS },
  { href: '/reports', label: 'Reports', icon: BarChart3, permission: Permission.VIEW_DASHBOARD },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    permission: Permission.VIEW_DASHBOARD,
    children: [
      { href: '/settings/accounting/accounts', label: 'Accounts', icon: BookOpen, permission: Permission.VIEW_DASHBOARD },
    ],
  },
];

const toolsItems: NavItem[] = [];

function NavItemComponent({
  item,
  pathname,
  user,
  level = 0,
}: {
  item: NavItem;
  pathname: string | null;
  user: any;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(() => {
    if (!item.children) return false;
    return item.children.some((child) => pathname === child.href || pathname?.startsWith(child.href + '/'));
  });

  const Icon = item.icon;
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.href && (pathname === item.href || pathname?.startsWith(item.href + '/'));

  // Purchases is always visible (legacy gating removed temporarily)
  if (item.label !== 'Purchases' && !userCan(user, item.permission)) {
    return null;
  }

  const content = (
    <>
      {item.iconSrc ? (
        <div className="h-5 w-5 flex-shrink-0 flex items-center justify-center">
          <img
            src={item.iconSrc}
            alt={item.label}
            className="h-5 w-5 opacity-70"
            style={{ filter: 'brightness(0) saturate(100%)' }}
          />
        </div>
      ) : (
        <Icon className="h-5 w-5 flex-shrink-0" />
      )}
      <span className="truncate">{item.label}</span>
      {item.ownerOnly && !hasChildren && (
        <div className="ml-auto" title="Solo Owner">
          <Lock className="h-3.5 w-3.5 text-gray-400" />
        </div>
      )}
      {hasChildren && (
        <ChevronRight
          className={cn('ml-auto h-4 w-4 transition-transform', isOpen && 'rotate-90')}
        />
      )}
      {item.ownerOnly && hasChildren && (
        <div className="ml-1" title="Solo Owner">
          <Lock className="h-3.5 w-3.5 text-gray-400" />
        </div>
      )}
    </>
  );

  if (item.href) {
    return (
      <div>
        <Link
          href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-muted',
              level > 0 && 'pl-9'
            )}
          onClick={() => {
            if (hasChildren) {
              setIsOpen(!isOpen);
            }
          }}
        >
          {content}
        </Link>
        {isOpen && hasChildren && (
          <div className="mt-1 ml-6 space-y-0.5">
            {item.children?.map((child) => (
              <NavItemComponent
                key={child.href}
                item={child}
                pathname={pathname}
                user={user}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          isOpen
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-700 hover:bg-gray-100',
          level > 0 && 'pl-9'
        )}
      >
        {content}
      </button>
      {isOpen && hasChildren && (
        <div className="mt-1 ml-6 space-y-0.5">
          {item.children?.map((child) => (
            <NavItemComponent
              key={child.href}
              item={child}
              pathname={pathname}
              user={user}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarZoho() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { data: settings } = useOrgSettings(!!user);

  const orgName = settings?.crm?.branding?.name || user?.organizationName || 'Remember Me';

  // Filter nav items based on permissions
  // Purchases is always visible (legacy gating removed temporarily)
  const visibleItems = navItems.filter((item) => {
    if (item.label === 'Purchases') {
      return !!user; // Always visible if user is logged in
    }
    return userCan(user, item.permission);
  });
  const visibleTools = toolsItems.filter((item) => userCan(user, item.permission));

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-64">
      {/* Header - Dark like Zoho */}
      <div className="px-4 py-3 bg-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-white text-gray-800 font-bold text-sm">
            B
          </div>
          <span className="font-semibold text-white text-sm">Books</span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 bg-white">
        {visibleItems.map((item) => (
          <NavItemComponent key={item.href || item.label} item={item} pathname={pathname} user={user} />
        ))}
      </div>

      {/* Tools Section */}
      {visibleTools.length > 0 && (
        <div className="px-3 py-2 border-t border-gray-200">
          <div className="px-3 py-1.5">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tools</span>
          </div>
          <div className="space-y-0.5">
            {visibleTools.map((item) => (
              <NavItemComponent key={item.href || item.label} item={item} pathname={pathname} user={user} />
            ))}
          </div>
        </div>
      )}

      {/* Configure Features Button */}
      <div className="px-3 py-3 border-t border-gray-200">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-medium transition-colors"
        >
          <span>Configure Features</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
