'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useOrgSettings } from '@/lib/api/hooks/use-org-settings';

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = hex.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

function setFavicon(url: string | null | undefined) {
  if (!url) return;
  const head = document.head;
  const existing = head.querySelectorAll<HTMLLinkElement>("link[rel*='icon']");
  existing.forEach((l) => l.parentNode?.removeChild(l));
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = url;
  head.appendChild(link);
}

export function OrgThemeSync() {
  const { user } = useAuthStore();
  const { data } = useOrgSettings(!!user);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const density = data?.crm?.branding?.density || data?.crm?.ui?.density || 'comfortable';
    const theme = data?.crm?.ui?.theme || 'light';
    const accent = data?.crm?.branding?.accentColor || data?.crm?.ui?.accentColor || 'blue';
    const brandName = data?.crm?.branding?.name;
    const logoUrl = data?.crm?.branding?.logoUrl;
    const faviconUrl = data?.crm?.branding?.faviconUrl;

    if (theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');

    html.setAttribute('data-accent', accent);
    body.setAttribute('data-density', density);

    // Allow arbitrary branding colors (hex) by setting CSS vars
    const hsl = hexToHsl(accent);
    if (hsl) {
      html.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      html.style.setProperty('--ring', `${hsl.h} ${Math.min(100, hsl.s)}% ${Math.min(90, hsl.l + 20)}%`);
    } else {
      html.style.removeProperty('--primary');
      html.style.removeProperty('--ring');
    }

    if (brandName) {
      document.title = brandName;
      try {
        localStorage.setItem(
          'crm-branding',
          JSON.stringify({ name: brandName, logoUrl: logoUrl || null, faviconUrl: faviconUrl || null, accentColor: accent, density }),
        );
      } catch {}
    }

    setFavicon(faviconUrl || undefined);
  }, [
    data?.crm?.branding?.density,
    data?.crm?.ui?.density,
    data?.crm?.ui?.theme,
    data?.crm?.branding?.accentColor,
    data?.crm?.ui?.accentColor,
    data?.crm?.branding?.name,
    data?.crm?.branding?.logoUrl,
    data?.crm?.branding?.faviconUrl,
  ]);

  return null;
}

