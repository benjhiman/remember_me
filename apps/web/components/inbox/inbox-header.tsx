'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getChannelIcon, getChannelLabel, type Channel } from '@/lib/inbox/channel-icons';

const channels: Array<{ value: Channel; label: string; href: string }> = [
  { value: 'unificado', label: getChannelLabel('unificado'), href: '/inbox/unificado' },
  { value: 'whatsapp', label: getChannelLabel('whatsapp'), href: '/inbox/whatsapp' },
  { value: 'instagram', label: getChannelLabel('instagram'), href: '/inbox/instagram' },
];

export function InboxHeader({ currentChannel }: { currentChannel?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleChannelChange = (value: string) => {
    const channel = channels.find((c) => c.value === value);
    if (channel) {
      // Preserve query params if any
      const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
      router.push(`${channel.href}${currentSearch}`);
    }
  };

  const currentChannelValue = currentChannel || pathname?.split('/').pop() || 'whatsapp';

  return (
    <div className="flex items-center justify-between gap-4 p-4 border-b bg-background">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/inbox')}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a Inbox
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Canal:</span>
        <Select value={currentChannelValue} onValueChange={handleChannelChange}>
          <SelectTrigger className="w-[140px]">
            <div className="flex items-center gap-2">
              <Image
                src={getChannelIcon(currentChannelValue as Channel, 'small')}
                alt={getChannelLabel(currentChannelValue as Channel)}
                width={20}
                height={20}
                className="h-5 w-5 opacity-70"
                style={{ filter: 'brightness(0) saturate(100%)' }}
              />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {channels.map((channel) => (
              <SelectItem key={channel.value} value={channel.value}>
                <div className="flex items-center gap-2">
                  <Image
                    src={getChannelIcon(channel.value, 'small')}
                    alt={channel.label}
                    width={20}
                    height={20}
                    className="h-5 w-5 opacity-70"
                    style={{ filter: 'brightness(0) saturate(100%)' }}
                  />
                  <span>{channel.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
