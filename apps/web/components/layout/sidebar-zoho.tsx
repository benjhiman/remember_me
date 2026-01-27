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
  ClipboardList,
  Asterisk,
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
    href: '/board',
    label: 'Kanban',
    icon: KanbanSquare,
    permission: Permission.VIEW_LEADS,
    children: [
      { href: '/board/leads', label: 'Leads', icon: Users, permission: Permission.VIEW_LEADS },
      { href: '/board/pipelines', label: 'Pipelines', icon: KanbanSquare, permission: Permission.VIEW_LEADS },
    ],
  },
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
  {
    href: '/inventory/stock',
    label: 'Inventory',
    icon: ClipboardList,
    permission: Permission.VIEW_DASHBOARD, // Visible if logged in
    children: [
      { href: '/inventory/stock', label: 'Stock', icon: Package, permission: Permission.VIEW_STOCK },
      { href: '/inventory/reservations', label: 'Reservas', icon: PackageCheck, permission: Permission.VIEW_STOCK },
      { href: '/inventory/items', label: 'Items', icon: Asterisk, permission: Permission.VIEW_DASHBOARD },
      { href: '/inventory/price-lists', label: 'Price List', icon: DollarSign, permission: Permission.VIEW_DASHBOARD },
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

// Helper to normalize pathname for legacy routes
function normalizePathname(pathname: string | null): string | null {
  if (!pathname) return null;
  
  // Map legacy routes to inventory routes for active state matching
  const legacyMap: Record<string, string> = {
    '/stock': '/inventory/stock',
    '/stock/reservations': '/inventory/reservations',
    '/items': '/inventory/items',
    '/items/price-lists': '/inventory/price-lists',
  };
  
  // Check if pathname matches a legacy route exactly or starts with it
  for (const [legacy, inventory] of Object.entries(legacyMap)) {
    if (pathname === legacy || pathname.startsWith(legacy + '/')) {
      return pathname.replace(legacy, inventory);
    }
  }
  
  return pathname;
}

// Helper to check if a href matches pathname (most specific match)
function isHrefActive(href: string | undefined, pathname: string | null): boolean {
  if (!href || !pathname) return false;
  const normalized = normalizePathname(pathname);
  if (!normalized) return false;
  
  // Exact match
  if (normalized === href) return true;
  
  // Starts with check (for nested routes)
  if (normalized.startsWith(href + '/')) return true;
  
  return false;
}

// Helper to find the most specific active child
function findMostSpecificActiveChild(children: NavItem[] | undefined, pathname: string | null): string | null {
  const normalized = normalizePathname(pathname);
  if (!normalized || !children) return null;
  
  let bestMatch: { href: string; length: number } | null = null;
  
  for (const child of children) {
    if (!child.href) continue;
    if (isHrefActive(child.href, normalized)) {
      const length = child.href.length;
      if (!bestMatch || length > bestMatch.length) {
        bestMatch = { href: child.href, length };
      }
    }
  }
  
  return bestMatch?.href || null;
}

function NavItemComponent({
  item,
  pathname,
  user,
  level = 0,
  mostSpecificActiveHref,
}: {
  item: NavItem;
  pathname: string | null;
  user: any;
  level?: number;
  mostSpecificActiveHref?: string | null;
}) {
  const normalizedPathname = normalizePathname(pathname);
  const [isOpen, setIsOpen] = useState(() => {
    if (!item.children) return false;
    return item.children.some((child) => isHrefActive(child.href, normalizedPathname));
  });

  const Icon = item.icon;
  const hasChildren = item.children && item.children.length > 0;
  
  // For parent items, check if any child is active
  // For child items, check exact match with most specific logic
  const mostSpecificChild = hasChildren ? findMostSpecificActiveChild(item.children, normalizedPathname) : null;
  
  // For child items (level > 0), only mark active if it's the most specific match
  // For parent items, mark active if href matches or any child is active
  let isActive: boolean;
  if (level > 0) {
    // This is a child item - only active if it's the most specific match
    // Use the passed mostSpecificActiveHref from parent if available, otherwise calculate
    const activeHref = mostSpecificActiveHref !== undefined ? mostSpecificActiveHref : mostSpecificChild;
    isActive = item.href === activeHref;
  } else {
    // This is a parent item - active if href matches or any child is active
    isActive = !!(item.href && (isHrefActive(item.href, normalizedPathname) || !!mostSpecificChild));
  }

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
                mostSpecificActiveHref={mostSpecificChild}
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
              mostSpecificActiveHref={mostSpecificChild}
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
