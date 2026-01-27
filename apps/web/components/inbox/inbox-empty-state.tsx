'use client';

import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import Image from 'next/image';
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
          icon: null, // Use lucide icon instead of SVG with background
        };
      case 'instagram':
        return {
          title: 'Mensajes directos de Instagram',
          description: 'Seleccioná una conversación para comenzar',
          buttonLabel: 'Abrir Instagram',
          icon: '/icons/instagram.svg',
        };
      case 'unificado':
        return {
          title: 'Inbox Unificado',
          description: 'Todos tus mensajes en un solo lugar',
          buttonLabel: null,
          icon: null,
        };
      default:
        return {
          title: 'Inbox',
          description: 'Seleccioná una conversación para comenzar',
          buttonLabel: null,
          icon: null,
        };
    }
  };

  const content = getContent();

  return (
    <div className="flex items-center justify-center h-full bg-background">
      <div className="text-center max-w-sm">
        {content.icon ? (
          <div className="flex justify-center mb-4">
            <Image src={content.icon} alt={content.title} width={64} height={64} className="w-16 h-16" />
          </div>
        ) : channel === 'unificado' ? (
          <div className="flex justify-center mb-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground" />
          </div>
        ) : channel === 'whatsapp' ? (
          <div className="flex justify-center mb-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground" />
          </div>
        ) : null}
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
