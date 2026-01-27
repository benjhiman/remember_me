'use client';

import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { getChannelIcon, getChannelLabel, type Channel } from '@/lib/inbox/channel-icons';
import Image from 'next/image';

interface InboxChannelTabsProps {
  currentChannel: Channel;
}

export function InboxChannelTabs({ currentChannel }: InboxChannelTabsProps) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs: Array<{ id: Channel; label: string; href: string }> = [
    {
      id: 'unificado',
      label: getChannelLabel('unificado'),
      href: '/inbox/unificado',
    },
    {
      id: 'whatsapp',
      label: getChannelLabel('whatsapp'),
      href: '/inbox/whatsapp',
    },
    {
      id: 'instagram',
      label: getChannelLabel('instagram'),
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
              <Image
                src={getChannelIcon(tab.id, 'small')}
                alt={tab.label}
                width={20}
                height={20}
                className="h-5 w-5 opacity-70"
                style={{ filter: 'brightness(0) saturate(100%)' }}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
