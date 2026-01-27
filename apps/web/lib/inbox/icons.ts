// Channel icons mapping for consistent usage across Inbox

import { MessageCircle } from 'lucide-react';
import Image from 'next/image';
import type { Channel } from './mock';
import type React from 'react';

export interface ChannelIconConfig {
  // For small icons (tabs, dropdowns, badges)
  small: {
    type: 'svg' | 'lucide';
    src?: string;
    component?: React.ComponentType<{ className?: string }>;
  };
  // For large icons (empty states, cards)
  large: {
    type: 'svg' | 'lucide';
    src?: string;
    component?: React.ComponentType<{ className?: string }>;
  };
  // Label for display
  label: string;
}

export const channelIcons: Record<Channel, ChannelIconConfig> = {
  unificado: {
    small: {
      type: 'lucide',
      component: MessageCircle,
    },
    large: {
      type: 'lucide',
      component: MessageCircle,
    },
    label: 'Unificado',
  },
  whatsapp: {
    small: {
      type: 'svg',
      src: '/icons/whatsapp-mono.svg',
    },
    large: {
      type: 'svg',
      src: '/icons/whatsapp.svg',
    },
    label: 'WhatsApp',
  },
  instagram: {
    small: {
      type: 'lucide',
      component: MessageCircle, // Using lucide icon for small (mono style)
    },
    large: {
      type: 'svg',
      src: '/icons/instagram.svg',
    },
    label: 'Instagram',
  },
};

// Helper: Get small icon config (for tabs, dropdowns, badges)
export function getChannelIconSmall(channel: Channel) {
  return channelIcons[channel].small;
}

// Helper: Get large icon config (for empty states, cards)
export function getChannelIconLarge(channel: Channel) {
  return channelIcons[channel].large;
}
