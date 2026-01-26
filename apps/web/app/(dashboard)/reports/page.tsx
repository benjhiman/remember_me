'use client';

import { useState } from 'react';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, MoreVertical, Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const reportCategories = [
  'Business Overview',
  'Sales',
  'Receivables',
  'Payments Received',
  'Recurring Invoices',
  'Payables',
  'Purchases and Expenses',
  'Taxes',
];

const mockReports = [
  { name: 'Profit and Loss', category: 'Business Overview', createdBy: 'System Generated', lastVisited: '-' },
  { name: 'Cash Flow Statement', category: 'Business Overview', createdBy: 'System Generated', lastVisited: '-' },
  { name: 'Balance Sheet', category: 'Business Overview', createdBy: 'System Generated', lastVisited: '-' },
  { name: 'Business Performance Ratios', category: 'Business Overview', createdBy: 'System Generated', lastVisited: '-' },
  { name: 'Sales by Customer', category: 'Sales', createdBy: 'System Generated', lastVisited: '-' },
  { name: 'Sales by Item', category: 'Sales', createdBy: 'System Generated', lastVisited: '-' },
  { name: 'Sales by Sales Person', category: 'Sales', createdBy: 'System Generated', lastVisited: '-' },
  { name: 'Sales Summary', category: 'Sales', createdBy: 'System Generated', lastVisited: '-' },
  { name: 'Aged Receivables', category: 'Receivables', createdBy: 'System Generated', lastVisited: '-' },
  { name: 'Purchase by Vendor', category: 'Purchases and Expenses', createdBy: 'System Generated', lastVisited: '-' },
];

export default function ReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredReports = mockReports.filter((report) => {
    if (selectedCategory && report.category !== selectedCategory) return false;
    if (searchQuery && !report.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <PageShell
      title="Reports Center"
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1.5" />
            Create New Report
          </Button>
          <Button size="sm" variant="ghost">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      }
      toolbar={
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      }
    >
      <div className="flex gap-6 h-full">
        {/* Left Panel - Categories */}
        <div className="w-64 flex-shrink-0 bg-white border border-border rounded-lg p-4">
          <div className="space-y-1 mb-6">
            <div className="px-3 py-2 text-sm font-medium text-muted-foreground">Home</div>
            <div className="px-3 py-2 text-sm font-medium text-muted-foreground">Favorites</div>
            <div className="px-3 py-2 text-sm font-medium text-muted-foreground">Shared Reports</div>
            <div className="px-3 py-2 text-sm font-medium text-muted-foreground">My Reports</div>
            <div className="px-3 py-2 text-sm font-medium text-muted-foreground">Scheduled Reports</div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              REPORT CATEGORY
            </div>
            <div className="space-y-1">
              {reportCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category === selectedCategory ? null : category)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                    selectedCategory === category
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel - Reports Table */}
        <div className="flex-1 bg-white border border-border rounded-lg overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {selectedCategory || 'All Reports'}
              </h2>
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
                {filteredReports.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Report Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Report Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Last Visited
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredReports.map((report, index) => (
                  <tr
                    key={index}
                    className="hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        // eslint-disable-next-line no-alert
                        alert(`Coming soon: View ${report.name}`);
                      }
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-primary">{report.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{report.category}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{report.createdBy}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{report.lastVisited}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
