'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { Search, Plus, Users, Bell, Settings, User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { Permission, userCan } from '@/lib/auth/permissions';
import { OrgSwitcher } from '@/components/organizations/org-switcher';
import { useTheme } from '@/components/providers/theme-provider';
import { Moon, Sun } from 'lucide-react';

export function TopbarZoho() {
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [searchFocused, setSearchFocused] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };
  
  // Get build version from env or git commit
  const buildVersion = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_BUILD_VERSION || '66ce982')
    : '66ce982';

  return (
    <div className="h-14 bg-gradient-to-r from-blue-700 to-blue-800 border-b border-blue-900 flex items-center px-4 gap-4">
      {/* Build Badge - Visible indicator that ZohoShell is mounted */}
      <div className="flex items-center gap-2 px-2.5 py-1 bg-green-500/20 border border-green-400/30 rounded-md">
        <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-xs font-medium text-white">BautiSeLaCome</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search..."
            className={cn(
              'pl-9 h-9 bg-white/10 border-white/20 text-white placeholder:text-gray-300 focus:bg-white/20',
              searchFocused && 'bg-white/20'
            )}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>
      </div>

      {/* Organization Switcher */}
      <OrgSwitcher />

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Quick Create */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="h-9 w-9 p-0 bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10 border-0 text-white"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {userCan(user, Permission.EDIT_LEADS) && (
              <DropdownMenuItem onClick={() => router.push('/leads/new')}>
                New Lead
              </DropdownMenuItem>
            )}
            {userCan(user, Permission.EDIT_SALES) && (
              <DropdownMenuItem onClick={() => router.push('/sales/new')}>
                New Sale
              </DropdownMenuItem>
            )}
            {userCan(user, Permission.EDIT_STOCK) && (
              <DropdownMenuItem onClick={() => router.push('/stock/reservations')}>
                New Stock Reservation
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Users */}
        <button className="h-9 w-9 p-0 text-white hover:bg-white/10 dark:hover:bg-white/5 rounded-md transition-colors flex items-center justify-center">
          <Users className="h-5 w-5" />
        </button>

        {/* Notifications */}
        <button className="h-9 w-9 p-0 text-white hover:bg-white/10 rounded-md transition-colors flex items-center justify-center relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full border border-blue-800" />
        </button>

        {/* Settings */}
        <button
          className="h-9 w-9 p-0 text-white hover:bg-white/10 rounded-md transition-colors flex items-center justify-center"
          onClick={() => router.push('/settings')}
        >
          <Settings className="h-5 w-5" />
        </button>

        {/* User Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-9 w-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs font-medium transition-colors border border-white/20">
              {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem disabled>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user?.name || 'User'}</span>
                <span className="text-xs text-gray-500">{user?.email}</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="h-4 w-4 mr-2" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="h-4 w-4 mr-2" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Settings className="h-4 w-4 mr-2" />
              System
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout}>
              <span className="text-red-600">Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
