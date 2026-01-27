'use client';

import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { MessageCircle } from 'lucide-react';
import Image from 'next/image';
import type { Channel } from '@/lib/inbox/mock';

interface InboxChannelTabsProps {
  currentChannel: Channel;
}

export function InboxChannelTabs({ currentChannel }: InboxChannelTabsProps) {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
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
    {
      id: 'unificado' as Channel,
      label: 'Unificado',
      icon: null, // Use lucide icon
      href: '/inbox/unificado',
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
              {tab.icon ? (
                <Image
                  src={tab.icon}
                  alt={tab.label}
                  width={18}
                  height={18}
                  className="w-[18px] h-[18px] opacity-70"
                  style={{ filter: 'brightness(0) saturate(100%)' }}
                />
              ) : tab.id === 'unificado' ? (
                <MessageCircle className="h-[18px] w-[18px]" />
              ) : (
                <MessageCircle className="h-[18px] w-[18px]" />
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
