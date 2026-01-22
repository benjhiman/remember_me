'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Instagram, MessageCircle } from 'lucide-react';

export default function InboxPage() {
  const router = useRouter();
  // Auth is handled by RouteGuard in layout

  const channels = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'Conversaciones de WhatsApp',
      icon: MessageSquare,
      href: '/inbox/whatsapp',
      color: 'bg-green-500',
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Mensajes directos de Instagram',
      icon: Instagram,
      href: '/inbox/instagram',
      color: 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600',
    },
    {
      id: 'unified',
      name: 'Unificado',
      description: 'Vista unificada de todos los canales',
      icon: MessageCircle,
      href: '/inbox/unified',
      color: 'bg-blue-500',
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Inbox</h1>
        <p className="text-muted-foreground mt-1">
          Seleccioná un canal para ver las conversaciones
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {channels.map((channel) => {
          const Icon = channel.icon;
          return (
            <Card
              key={channel.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(channel.href)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`${channel.color} p-3 rounded-lg text-white`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle>{channel.name}</CardTitle>
                    <CardDescription>{channel.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline">
                  Abrir {channel.name}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
