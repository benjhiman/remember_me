'use client';

import { Conversation, SlaStatus } from '@/types/api';
import { cn } from '@/lib/utils/cn';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListItemProps {
  conversation: Conversation;
  onClick: () => void;
  isSelected?: boolean;
}

export function ConversationListItem({
  conversation,
  onClick,
  isSelected = false,
}: ConversationListItemProps) {
  const getSlaBadgeColor = (status: SlaStatus) => {
    switch (status) {
      case 'OK':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'BREACH':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getProviderBadge = (provider: string) => {
    switch (provider) {
      case 'WHATSAPP':
        return { label: 'WA', color: 'bg-green-100 text-green-800 border-green-200' };
      case 'INSTAGRAM':
        return { label: 'IG', color: 'bg-pink-100 text-pink-800 border-pink-200' };
      default:
        return { label: provider, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  const providerBadge = getProviderBadge(conversation.provider);
  const visibleTags = conversation.tags.slice(0, 3);
  const remainingTags = conversation.tags.length - 3;

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors',
        isSelected && 'bg-blue-50 border-l-4 border-l-blue-500'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-medium truncate">
              {conversation.lead?.name || conversation.phone || conversation.handle || 'Sin nombre'}
            </span>
            
            {/* Provider badge */}
            <span
              className={cn(
                'text-xs font-medium rounded px-2 py-0.5 border',
                providerBadge.color
              )}
            >
              {providerBadge.label}
            </span>

            {/* Status badge */}
            <span
              className={cn(
                'text-xs font-medium rounded px-2 py-0.5 border capitalize',
                getStatusBadgeColor(conversation.status)
              )}
            >
              {conversation.status.toLowerCase()}
            </span>

            {/* Unread count badge */}
            {conversation.unreadCount > 0 && (
              <span className="bg-blue-500 text-white text-xs font-medium rounded-full px-2 py-0.5 min-w-[20px] text-center">
                {conversation.unreadCount}
              </span>
            )}

            {/* SLA status badge */}
            <span
              className={cn(
                'text-xs font-medium rounded px-2 py-0.5 border',
                getSlaBadgeColor(conversation.slaStatus)
              )}
            >
              SLA: {conversation.slaStatus}
            </span>
          </div>

          {/* Assigned user pill */}
          {conversation.assignedUser && (
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full px-2 py-1">
                <span>👤</span>
                {conversation.assignedUser.name}
              </span>
            </div>
          )}

          {/* Preview text */}
          {conversation.previewText && (
            <p className="text-sm text-gray-600 truncate mb-2">{conversation.previewText}</p>
          )}

          {/* Tags chips (max 3 + "+N") */}
          {conversation.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap items-center">
              {visibleTags.map((tag) => (
                <span
                  key={tag.id}
                  className="text-xs px-2 py-0.5 rounded border"
                  style={{
                    backgroundColor: tag.color ? `${tag.color}20` : '#f3f4f6',
                    color: tag.color || '#6b7280',
                    borderColor: tag.color ? `${tag.color}40` : '#d1d5db',
                  }}
                >
                  {tag.name}
                </span>
              ))}
              {remainingTags > 0 && (
                <span className="text-xs text-gray-500 font-medium">
                  +{remainingTags}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="ml-4 text-xs text-gray-400 whitespace-nowrap">
          {formatDistanceToNow(new Date(conversation.lastMessageAt), {
            addSuffix: true,
          })}
        </div>
      </div>
    </div>
  );
}
