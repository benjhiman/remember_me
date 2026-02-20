'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/lib/store/auth-store';
import { Permission, userCan } from '@/lib/auth/permissions';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  PackageCheck,
  ChevronRight,
  ChevronDown,
  DollarSign,
} from 'lucide-react';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: Permission.VIEW_DASHBOARD },
  { href: '/stock', label: 'Stock', icon: Package, permission: Permission.VIEW_STOCK },
  { href: '/stock/reservations', label: 'Reservas', icon: PackageCheck, permission: Permission.VIEW_STOCK },
  { href: '/sales', label: 'Ventas', icon: ShoppingCart, permission: Permission.VIEW_SALES },
  { href: '/pricing', label: 'Pricing', icon: Package, permission: Permission.VIEW_DASHBOARD },
  { href: '/settings', label: 'Configuración', icon: Settings, permission: Permission.VIEW_DASHBOARD },
];

function NavItemComponent({
  item,
  collapsed,
  pathname,
  user,
  level = 0,
}: {
  item: NavItem;
  collapsed: boolean;
  pathname: string | null;
  user: any;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(() => {
    if (!item.children) return false;
    return item.children.some((child) => pathname === child.href || pathname?.startsWith(child.href + '/'));
  });

  const Icon = item.icon;
  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
  const hasChildren = item.children && item.children.length > 0;

  if (!userCan(user, item.permission)) {
    return null;
  }

  if (hasChildren && !collapsed) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          )}
        </button>
        {isOpen && item.children && (
          <div className="ml-8 mt-1 space-y-1">
            {item.children.map((child) => (
              <NavItemComponent
                key={child.href}
                item={child}
                collapsed={collapsed}
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
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        level > 0 && 'ml-4',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export function AppNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuthStore();

  // Filter nav items based on permissions
  const visibleItems = navItems.filter((item) => userCan(user, item.permission));

  return (
    <nav className={cn('space-y-1', collapsed && 'space-y-2')}>
      {visibleItems.map((item) => (
        <NavItemComponent
          key={item.href}
          item={item}
          collapsed={collapsed}
          pathname={pathname}
          user={user}
        />
      ))}
    </nav>
  );
}
