'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { Search } from 'lucide-react';
import type { Thread } from '@/lib/inbox/mock';
import { getInitials, formatRelativeTime } from '@/lib/inbox/mock';

interface InboxThreadListProps {
  threads: Thread[];
  selectedThreadId?: string;
  onSelectThread: (threadId: string) => void;
}

export function InboxThreadList({ threads, selectedThreadId, onSelectThread }: InboxThreadListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'assigned'>('all');

  const filteredThreads = threads.filter((thread) => {
    if (searchQuery && !thread.contactName.toLowerCase().includes(searchQuery.toLowerCase()) && !thread.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filter === 'unread' && thread.unreadCount === 0) return false;
    if (filter === 'assigned' && !thread.assignedTo) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full border-r border-border bg-background">
      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversaciones"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-colors',
            filter === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          Todos
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-colors',
            filter === 'unread' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          No leídos
        </button>
        <button
          onClick={() => setFilter('assigned')}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-colors',
            filter === 'assigned' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          Asignados a mí
        </button>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {filteredThreads.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={cn(
                  'w-full p-4 text-left hover:bg-muted/50 transition-colors',
                  selectedThreadId === thread.id && 'bg-muted'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {thread.contactAvatar ? (
                        <img src={thread.contactAvatar} alt={thread.contactName} className="h-full w-full rounded-full" />
                      ) : (
                        getInitials(thread.contactName)
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{thread.contactName}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {formatRelativeTime(thread.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground truncate flex-1">{thread.lastMessage}</p>
                      {thread.unreadCount > 0 && (
                        <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
