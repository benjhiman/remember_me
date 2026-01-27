'use client';

import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { renderChannelIconSmall } from '@/lib/inbox/icons';
import type { Channel } from '@/lib/inbox/mock';

interface InboxChannelTabsProps {
  currentChannel: Channel;
}

export function InboxChannelTabs({ currentChannel }: InboxChannelTabsProps) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    {
      id: 'unificado' as Channel,
      label: 'Unificado',
      icon: null, // Use lucide icon
      href: '/inbox/unificado',
    },
    {
      id: 'whatsapp' as Channel,
      label: 'WhatsApp',
      icon: '/icons/whatsapp-mono.svg',
      href: '/inbox/whatsapp',
    },
    {
      id: 'instagram' as Channel,
      label: 'Instagram',
      icon: null, // Use lucide icon
      href: '/inbox/instagram',
    },
  ];

  return (
    <div className="border-b border-border bg-background">
      <div className="flex items-center gap-1 px-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || (tab.id === 'unificado' && pathname === '/inbox');
          return (
            <button
              key={tab.id}
              onClick={() => router.push(tab.href)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
              )}
            >
              {renderChannelIconSmall(tab.id)}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
