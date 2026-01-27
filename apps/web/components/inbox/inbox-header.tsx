'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, MessageSquare, Instagram, MessageCircle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const channels = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, href: '/inbox/whatsapp' },
  { value: 'instagram', label: 'Instagram', icon: Instagram, href: '/inbox/instagram' },
  { value: 'unified', label: 'Unificado', icon: MessageCircle, href: '/inbox/unified' },
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
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {channels.map((channel) => {
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
  );
}
