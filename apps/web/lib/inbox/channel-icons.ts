// Single source of truth for channel icons in Inbox
// All icons use explicit SVG assets (no lucide icons for channels)

export type Channel = 'unificado' | 'whatsapp' | 'instagram';

export const CHANNEL_ICON = {
  unificado: {
    label: 'Unificado',
    smallSrc: '/icons/unified-mono.svg',
    largeSrc: '/icons/unified-mono.svg',
  },
  whatsapp: {
    label: 'WhatsApp',
    smallSrc: '/icons/whatsapp-mono.svg',
    largeSrc: '/icons/whatsapp.svg',
  },
  instagram: {
    label: 'Instagram',
    smallSrc: '/icons/instagram-mono.svg',
    largeSrc: '/icons/instagram.svg',
  },
} as const;

/**
 * Get icon source path for a channel
 * @param channel - Channel name
 * @param size - 'small' for tabs/sidebar/dropdowns (20px), 'large' for empty states/cards (48px)
 * @returns SVG path string
 */
export function getChannelIcon(channel: Channel, size: 'small' | 'large'): string {
  return size === 'small' ? CHANNEL_ICON[channel].smallSrc : CHANNEL_ICON[channel].largeSrc;
}

/**
 * Get channel label
 */
export function getChannelLabel(channel: Channel): string {
  return CHANNEL_ICON[channel].label;
}
