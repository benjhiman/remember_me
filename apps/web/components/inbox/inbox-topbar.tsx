'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Phone, Instagram, MessageCircle, Monitor } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';
import type { Channel } from '@/lib/inbox/mock';

// Channels for dropdown (ordered: WhatsApp, Instagram, Unificado)
const channelDropdown = [
  { value: 'whatsapp', label: 'WhatsApp', icon: Phone, href: '/inbox/whatsapp' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, href: '/inbox/instagram' },
  { value: 'unificado', label: 'Unificado', icon: MessageCircle, href: '/inbox/unificado' },
];

// Tabs (ordered: General, WhatsApp, Instagram, Unificado)
const tabs = [
  {
    id: 'general' as const,
    label: 'General',
    icon: Monitor,
    href: '/inbox/unified',
  },
  {
    id: 'whatsapp' as Channel,
    label: 'WhatsApp',
    icon: Phone,
    href: '/inbox/whatsapp',
  },
  {
    id: 'instagram' as Channel,
    label: 'Instagram',
    icon: Instagram,
    href: '/inbox/instagram',
  },
  {
    id: 'unificado' as Channel,
    label: 'Unificado',
    icon: MessageCircle,
    href: '/inbox/unificado',
  },
];

interface InboxTopbarProps {
  currentChannel?: Channel | string;
}

export function InboxTopbar({ currentChannel }: InboxTopbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Determine current channel from pathname if not provided
  // For dropdown, map unified to unificado
  let activeChannel: Channel = 'unificado';
  if (pathname?.includes('/whatsapp')) {
    activeChannel = 'whatsapp';
  } else if (pathname?.includes('/instagram')) {
    activeChannel = 'instagram';
  } else if (pathname?.includes('/unificado')) {
    activeChannel = 'unificado';
  } else if (pathname?.includes('/unified')) {
    activeChannel = 'unificado'; // unified maps to unificado for dropdown
  }

  const currentChannelValue = currentChannel || activeChannel;

  const handleChannelChange = (value: string) => {
    const channel = channelDropdown.find((c) => c.value === value);
    if (channel) {
      const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
      router.push(`${channel.href}${currentSearch}`);
    }
  };

  return (
    <div className="flex flex-col border-b border-border bg-background">
      {/* Row 1: Header (Volver a Inbox + Canal) - Fixed height */}
      <div className="flex items-center justify-between gap-4 px-4 min-h-[44px] border-b border-border">
        <div className="flex items-center gap-2 h-9">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/inbox/unified')}
            className="gap-2 h-9"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver a Inbox
          </Button>
        </div>

        <div className="flex items-center gap-2 h-9">
          <span className="text-sm text-muted-foreground leading-none flex items-center h-9">Canal:</span>
          <Select value={currentChannelValue} onValueChange={handleChannelChange}>
            <SelectTrigger className="w-[140px] h-9 min-h-9 max-h-9 py-0 leading-none">
              <span className="flex items-center leading-none">
                <SelectValue />
              </span>
            </SelectTrigger>
            <SelectContent align="end" sideOffset={6} className="min-w-[220px]">
              {channelDropdown.map((channel) => {
                const Icon = channel.icon;
                return (
                  <SelectItem key={channel.value} value={channel.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{channel.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Tabs */}
      <div className="flex items-center gap-1 px-4">
        {tabs.map((tab) => {
          // Active state: exact match or starts with href
          const isActive =
            pathname === tab.href ||
            (pathname?.startsWith(tab.href + '/')) ||
            (tab.id === 'general' && (pathname === '/inbox' || pathname === '/inbox/unified')) ||
            (tab.id === 'unificado' && pathname === '/inbox/unificado');
          const Icon = tab.icon;
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
              <Icon
                className={cn(
                  'h-[18px] w-[18px] transition-colors duration-150',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/70 group-hover:text-foreground'
                )}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
