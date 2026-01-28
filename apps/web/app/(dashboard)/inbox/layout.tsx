'use client';

import { usePathname } from 'next/navigation';
import { InboxTopbar } from '@/components/inbox/inbox-topbar';
import type { Channel } from '@/lib/inbox/mock';

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Determine current channel from pathname
  // Note: 'general' is not a Channel type, but we handle it in InboxTopbar
  let currentChannel: Channel | 'general' = 'unificado';
  if (pathname?.includes('/whatsapp')) {
    currentChannel = 'whatsapp';
  } else if (pathname?.includes('/instagram')) {
    currentChannel = 'instagram';
  } else if (pathname?.includes('/unificado')) {
    currentChannel = 'unificado';
  } else if (pathname?.includes('/unified') || pathname === '/inbox') {
    currentChannel = 'general'; // unified maps to general tab
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <InboxTopbar currentChannel={currentChannel} />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
