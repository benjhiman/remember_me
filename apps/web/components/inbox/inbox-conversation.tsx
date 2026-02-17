'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import { Paperclip, Send, User, UserCheck, CheckCircle2 } from 'lucide-react';
import type { Thread, Message } from '@/lib/inbox/mock';
import { formatRelativeTime } from '@/lib/inbox/mock';

interface InboxConversationProps {
  thread: Thread;
  messages: Message[];
  onSendMessage: (text: string) => void;
}

export function InboxConversation({ thread, messages, onSendMessage }: InboxConversationProps) {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
            {thread.contactAvatar ? (
              <Image src={thread.contactAvatar} alt={thread.contactName} width={40} height={40} className="h-full w-full rounded-full" />
            ) : (
              thread.contactName.substring(0, 2).toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{thread.contactName}</h3>
              <span
                className={cn(
                  'px-2 py-0.5 text-xs font-medium rounded-full',
                  thread.channel === 'whatsapp'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : thread.channel === 'instagram'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                )}
              >
                {thread.channel === 'whatsapp' ? 'WhatsApp' : thread.channel === 'instagram' ? 'Instagram' : 'Unificado'}
              </span>
            </div>
            {thread.status && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {thread.status === 'open' ? 'Abierto' : 'Resuelto'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <UserCheck className="h-4 w-4 mr-1.5" />
            Asignar
          </Button>
          <Button variant="outline" size="sm">
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Marcar como resuelto
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('flex', message.direction === 'out' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[70%] rounded-lg px-4 py-2',
                message.direction === 'out'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
              <p className={cn('text-xs mt-1', message.direction === 'out' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                {formatRelativeTime(message.createdAt)}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="p-4 border-t border-border">
        <div className="flex items-end gap-2">
          <Button variant="outline" size="sm" className="flex-shrink-0">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            className="min-h-[60px] max-h-[120px] resize-none"
            rows={2}
          />
          <Button onClick={handleSend} disabled={!messageText.trim()} size="sm" className="flex-shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
