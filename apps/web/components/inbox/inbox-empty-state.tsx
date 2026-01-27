'use client';

import { Button } from '@/components/ui/button';
import { renderChannelIconLarge } from '@/lib/inbox/icons';
import type { Channel } from '@/lib/inbox/mock';

interface InboxEmptyStateProps {
  channel: Channel;
  onOpenApp?: () => void;
}

export function InboxEmptyState({ channel, onOpenApp }: InboxEmptyStateProps) {
  const getContent = () => {
    switch (channel) {
      case 'whatsapp':
        return {
          title: 'Conversaciones de WhatsApp',
          description: 'Seleccioná una conversación para comenzar',
          buttonLabel: 'Abrir WhatsApp',
        };
      case 'instagram':
        return {
          title: 'Mensajes directos de Instagram',
          description: 'Seleccioná una conversación para comenzar',
          buttonLabel: 'Abrir Instagram',
        };
      case 'unificado':
        return {
          title: 'Inbox Unificado',
          description: 'Todos tus mensajes en un solo lugar',
          buttonLabel: null,
        };
      default:
        return {
          title: 'Inbox',
          description: 'Seleccioná una conversación para comenzar',
          buttonLabel: null,
        };
    }
  };

  const content = getContent();

  return (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4">
          {renderChannelIconLarge(channel)}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{content.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{content.description}</p>
        {content.buttonLabel && onOpenApp && (
          <Button onClick={onOpenApp} variant="outline">
            {content.buttonLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
