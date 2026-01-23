'use client';

import { ReactNode, useState } from 'react';
import { SidebarZoho } from './sidebar-zoho';
import { TopbarZoho } from './topbar-zoho';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface AppShellZohoProps {
  children: ReactNode;
}

export function AppShellZoho({ children }: AppShellZohoProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50"
          onClick={() => setSidebarOpen(false)}
        >
          <aside
            className="bg-white w-64 h-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end p-4 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="h-[calc(100%-73px)]">
              <SidebarZoho />
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-shrink-0">
        <SidebarZoho />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <TopbarZoho />

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>

      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden fixed top-4 left-4 z-40 bg-white shadow-md"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
    </div>
  );
}
