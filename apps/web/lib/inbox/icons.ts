// Channel icons mapping for consistent usage across Inbox

import { MessageCircle } from 'lucide-react';
import Image from 'next/image';
import type { Channel } from './mock';

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

// Helper: Render small icon (for tabs, dropdowns, badges)
export function renderChannelIconSmall(channel: Channel, className?: string) {
  const config = channelIcons[channel].small;
  
  if (config.type === 'svg' && config.src) {
    return (
      <Image
        src={config.src}
        alt={channelIcons[channel].label}
        width={18}
        height={18}
        className={className || 'w-[18px] h-[18px] opacity-70'}
        style={{ filter: 'brightness(0) saturate(100%)' }}
      />
    );
  }
  
  if (config.type === 'lucide' && config.component) {
    const Icon = config.component;
    return <Icon className={className || 'h-[18px] w-[18px]'} />;
  }
  
  return null;
}

// Helper: Render large icon (for empty states, cards)
export function renderChannelIconLarge(channel: Channel, className?: string) {
  const config = channelIcons[channel].large;
  
  if (config.type === 'svg' && config.src) {
    return (
      <Image
        src={config.src}
        alt={channelIcons[channel].label}
        width={64}
        height={64}
        className={className || 'w-16 h-16'}
      />
    );
  }
  
  if (config.type === 'lucide' && config.component) {
    const Icon = config.component;
    return <Icon className={className || 'h-16 w-16 text-muted-foreground'} />;
  }
  
  return null;
}
