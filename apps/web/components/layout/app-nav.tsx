'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
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
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/leads/board', label: 'Kanban', icon: KanbanSquare },
  { href: '/stock', label: 'Stock', icon: Package },
  { href: '/stock/reservations', label: 'Reservas', icon: PackageCheck },
  { href: '/sales', label: 'Ventas', icon: ShoppingCart },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/settings/integrations', label: 'Integraciones', icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
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
