'use client';

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
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: Permission.VIEW_DASHBOARD },
  { href: '/leads', label: 'Leads', icon: Users, permission: Permission.VIEW_LEADS },
  { href: '/leads/board', label: 'Kanban', icon: KanbanSquare, permission: Permission.VIEW_LEADS },
  { href: '/stock', label: 'Stock', icon: Package, permission: Permission.VIEW_STOCK },
  { href: '/stock/reservations', label: 'Reservas', icon: PackageCheck, permission: Permission.VIEW_STOCK },
  { href: '/sales', label: 'Ventas', icon: ShoppingCart, permission: Permission.VIEW_SALES },
  { href: '/inbox', label: 'Inbox', icon: Inbox, permission: Permission.VIEW_INBOX },
  { href: '/settings', label: 'Configuración', icon: Settings, permission: Permission.VIEW_DASHBOARD }, // Settings visible to all authenticated users
  { href: '/settings/integrations', label: 'Integraciones', icon: Settings, permission: Permission.VIEW_INTEGRATIONS },
];

export function AppNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  // Filter nav items based on permissions
  const visibleItems = navItems.filter((item) => userCan(user, item.permission));

  return (
    <nav className="space-y-1">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
