'use client';

import { cn } from '@/lib/utils/cn';
import type { Conversation } from '@/types/api';
import { formatTimeHHMM } from '@/lib/utils/inbox-format';

function statusBadge(status: string, provider: 'WHATSAPP' | 'INSTAGRAM') {
  const base = 'text-[10px] font-semibold px-2 py-0.5 rounded-full border';
  if (status === 'OPEN') return cn(base, provider === 'WHATSAPP' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-sky-50 text-sky-700 border-sky-200');
  if (status === 'PENDING') return cn(base, 'bg-amber-50 text-amber-700 border-amber-200');
  return cn(base, 'bg-muted text-muted-foreground border-border');
}

export function EnterpriseChatListItem({
  conversation,
  selected,
  provider,
  onClick,
}: {
  conversation: Conversation;
  selected: boolean;
  provider: 'WHATSAPP' | 'INSTAGRAM';
  onClick: () => void;
}) {
  const name =
    conversation.lead?.name ||
    conversation.handle ||
    conversation.phone ||
    'Sin nombre';

  const preview = conversation.previewText || '';
  const time = formatTimeHHMM(new Date(conversation.lastMessageAt));
  const assigned = conversation.assignedUser?.name;

  const avatarBg = provider === 'WHATSAPP' ? 'bg-emerald-600' : 'bg-gradient-to-br from-fuchsia-500 to-amber-500';
  const avatarLabel = (name || '•').slice(0, 1).toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 border-b transition-colors',
        selected ? 'bg-muted' : 'hover:bg-muted/60',
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold', avatarBg)}>
          {avatarLabel}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-foreground">{name}</div>
              <div className="truncate text-xs text-muted-foreground">{preview}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-[11px] text-muted-foreground">{time}</div>
              {conversation.unreadCount > 0 && (
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', provider === 'WHATSAPP' ? 'bg-emerald-600 text-white' : 'bg-sky-600 text-white')}>
                  {conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className={statusBadge(conversation.status, provider)}>{conversation.status}</span>
            {assigned && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
                {assigned}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

