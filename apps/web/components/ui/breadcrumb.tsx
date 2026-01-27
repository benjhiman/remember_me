'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  // Filter out "Home" label from items (icon is already rendered)
  const filteredItems = items.filter((item) => item.label !== 'Home');
  
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4" aria-label="Breadcrumb">
      <Link
        href="/dashboard"
        className="hover:text-gray-900 transition-colors"
        aria-label="Home"
        title="Home"
      >
        <Home className="h-4 w-4" />
      </Link>
      {filteredItems.map((item, index) => (
        <div key={index} className="flex items-center space-x-2">
          <ChevronRight className="h-4 w-4 text-gray-400" />
          {item.href && index < filteredItems.length - 1 ? (
            <Link
              href={item.href}
              className="hover:text-gray-900 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className={cn(
              index === filteredItems.length - 1 && 'text-gray-900 font-medium'
            )}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
