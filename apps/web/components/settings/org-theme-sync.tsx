'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useOrgSettings } from '@/lib/api/hooks/use-org-settings';

export function OrgThemeSync() {
  const { user } = useAuthStore();
  const { data } = useOrgSettings(!!user);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const density = data?.crm?.ui?.density || 'comfortable';
    const theme = data?.crm?.ui?.theme || 'light';
    const accent = data?.crm?.ui?.accentColor || 'blue';

    if (theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');

    html.setAttribute('data-accent', accent);
    body.setAttribute('data-density', density);
  }, [data?.crm?.ui?.density, data?.crm?.ui?.theme, data?.crm?.ui?.accentColor]);

  return null;
}

