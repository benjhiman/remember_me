'use client';

import { usePathname } from 'next/navigation';
import { InboxChannelTabs } from '@/components/inbox/inbox-channel-tabs';
import type { Channel } from '@/lib/inbox/mock';

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Determine current channel from pathname
  let currentChannel: Channel = 'unificado';
  if (pathname?.includes('/whatsapp')) {
    currentChannel = 'whatsapp';
  } else if (pathname?.includes('/instagram')) {
    currentChannel = 'instagram';
  } else if (pathname?.includes('/unificado')) {
    currentChannel = 'unificado';
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <InboxChannelTabs currentChannel={currentChannel} />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
