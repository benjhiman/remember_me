// Mock data for Inbox - Ready for API integration

export type Channel = 'whatsapp' | 'instagram' | 'unificado';

export interface Thread {
  id: string;
  channel: Channel;
  contactName: string;
  contactAvatar?: string;
  lastMessage: string;
  updatedAt: Date;
  unreadCount: number;
  assignedTo?: string;
  status?: 'open' | 'resolved';
}

export interface Message {
  id: string;
  threadId: string;
  direction: 'in' | 'out';
  text: string;
  createdAt: Date;
  attachments?: Array<{ type: string; url: string }>;
}

// Mock threads by channel
export const threadsByChannel: Record<Channel, Thread[]> = {
  whatsapp: [
    {
      id: 'wa-1',
      channel: 'whatsapp',
      contactName: 'Juan Pérez',
      lastMessage: 'Hola, tengo una consulta sobre el iPhone 15',
      updatedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      unreadCount: 2,
      status: 'open',
    },
    {
      id: 'wa-2',
      channel: 'whatsapp',
      contactName: 'María González',
      lastMessage: 'Perfecto, gracias por la info',
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      unreadCount: 0,
      status: 'open',
    },
    {
      id: 'wa-3',
      channel: 'whatsapp',
      contactName: 'Carlos Rodríguez',
      lastMessage: '¿Tienen disponible el modelo Pro Max?',
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      unreadCount: 1,
      status: 'open',
    },
    {
      id: 'wa-4',
      channel: 'whatsapp',
      contactName: 'Ana Martínez',
      lastMessage: 'Excelente servicio, muy recomendado',
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      unreadCount: 0,
      status: 'resolved',
    },
  ],
  instagram: [
    {
      id: 'ig-1',
      channel: 'instagram',
      contactName: '@techlover',
      lastMessage: 'Hola! Me interesa el iPhone 15 Pro',
      updatedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
      unreadCount: 1,
      status: 'open',
    },
    {
      id: 'ig-2',
      channel: 'instagram',
      contactName: '@gadgetfan',
      lastMessage: '¿Hacen envíos a todo el país?',
      updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      unreadCount: 0,
      status: 'open',
    },
    {
      id: 'ig-3',
      channel: 'instagram',
      contactName: '@smartphone_user',
      lastMessage: 'Gracias por responder tan rápido',
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      unreadCount: 0,
      status: 'resolved',
    },
  ],
  unificado: [
    {
      id: 'wa-1',
      channel: 'whatsapp',
      contactName: 'Juan Pérez',
      lastMessage: 'Hola, tengo una consulta sobre el iPhone 15',
      updatedAt: new Date(Date.now() - 5 * 60 * 1000),
      unreadCount: 2,
      status: 'open',
    },
    {
      id: 'ig-1',
      channel: 'instagram',
      contactName: '@techlover',
      lastMessage: 'Hola! Me interesa el iPhone 15 Pro',
      updatedAt: new Date(Date.now() - 15 * 60 * 1000),
      unreadCount: 1,
      status: 'open',
    },
    {
      id: 'wa-2',
      channel: 'whatsapp',
      contactName: 'María González',
      lastMessage: 'Perfecto, gracias por la info',
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      unreadCount: 0,
      status: 'open',
    },
    {
      id: 'ig-2',
      channel: 'instagram',
      contactName: '@gadgetfan',
      lastMessage: '¿Hacen envíos a todo el país?',
      updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      unreadCount: 0,
      status: 'open',
    },
  ],
};

// Mock messages by thread ID
export const messagesByThreadId: Record<string, Message[]> = {
  'wa-1': [
    {
      id: 'msg-1',
      threadId: 'wa-1',
      direction: 'in',
      text: 'Hola, tengo una consulta sobre el iPhone 15',
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    },
    {
      id: 'msg-2',
      threadId: 'wa-1',
      direction: 'out',
      text: '¡Hola! Claro, te puedo ayudar. ¿Qué te gustaría saber?',
      createdAt: new Date(Date.now() - 8 * 60 * 1000),
    },
    {
      id: 'msg-3',
      threadId: 'wa-1',
      direction: 'in',
      text: '¿Tienen disponible el modelo de 256GB?',
      createdAt: new Date(Date.now() - 7 * 60 * 1000),
    },
    {
      id: 'msg-4',
      threadId: 'wa-1',
      direction: 'in',
      text: 'Y cuál es el precio?',
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  ],
  'wa-2': [
    {
      id: 'msg-5',
      threadId: 'wa-2',
      direction: 'in',
      text: 'Hola, quería consultar sobre garantía',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    },
    {
      id: 'msg-6',
      threadId: 'wa-2',
      direction: 'out',
      text: 'Tenemos garantía oficial de 1 año',
      createdAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
    },
    {
      id: 'msg-7',
      threadId: 'wa-2',
      direction: 'in',
      text: 'Perfecto, gracias por la info',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  ],
  'ig-1': [
    {
      id: 'msg-8',
      threadId: 'ig-1',
      direction: 'in',
      text: 'Hola! Me interesa el iPhone 15 Pro',
      createdAt: new Date(Date.now() - 20 * 60 * 1000),
    },
    {
      id: 'msg-9',
      threadId: 'ig-1',
      direction: 'out',
      text: '¡Hola! Tenemos disponible. ¿Qué color prefieres?',
      createdAt: new Date(Date.now() - 15 * 60 * 1000),
    },
  ],
  'ig-2': [
    {
      id: 'msg-10',
      threadId: 'ig-2',
      direction: 'in',
      text: '¿Hacen envíos a todo el país?',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    },
    {
      id: 'msg-11',
      threadId: 'ig-2',
      direction: 'out',
      text: 'Sí, hacemos envíos a todo el país con costo adicional',
      createdAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
    },
  ],
};

// Helper: Get initials from name
export function getInitials(name: string): string {
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

// Helper: Format relative time
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}
