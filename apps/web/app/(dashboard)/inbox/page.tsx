'use client';

import { useRouter } from 'next/navigation';
import { useOrgStore } from '@/lib/store/org-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function InboxPage() {
  const router = useRouter();
  const { currentOrganization, isLoading } = useOrgStore();
  // Auth is handled by RouteGuard in layout
  
  // HARDENING: Don't render Inbox UI without active organization
  if (isLoading || !currentOrganization) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">Cargando organización...</div>
        </div>
      </div>
    );
  }

  const channels = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'Conversaciones de WhatsApp',
      iconSrc: '/icons/whatsapp.svg',
      href: '/inbox/whatsapp',
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Mensajes directos de Instagram',
      iconSrc: '/icons/instagram.svg',
      href: '/inbox/instagram',
    },
    {
      id: 'unified',
      name: 'Unificado',
      description: 'Vista unificada de todos los canales',
      iconSrc: null,
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
          return (
            <Card
              key={channel.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(channel.href)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  {channel.iconSrc ? (
                    <div className="flex-shrink-0">
                      <Image
                        src={channel.iconSrc}
                        alt={channel.name}
                        width={48}
                        height={48}
                        className="w-12 h-12"
                      />
                    </div>
                  ) : channel.icon ? (
                    <div className={`${channel.color} p-3 rounded-lg text-white flex-shrink-0`}>
                      <channel.icon className="h-6 w-6" />
                    </div>
                  ) : null}
                  <div className="flex-1 min-w-0">
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
