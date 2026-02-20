export type UiDensity = 'comfortable' | 'compact';
export type UiTheme = 'light' | 'dark';
export type UiAccentColor = 'blue' | 'violet' | 'green';

export interface OrgCrmSettings {
  branding: {
    name: string;
    logoUrl: string | null;
    faviconUrl: string | null;
    accentColor: string;
    density: UiDensity;
  };
  permissions: {
    sellerCanEditSales: boolean;
    sellerCanEditLeads: boolean;
  };
  ui: {
    density: UiDensity;
    theme: UiTheme;
    accentColor: UiAccentColor;
  };
}

export interface OrgSettings {
  crm: OrgCrmSettings;
}

export const ORG_SETTINGS_DEFAULTS: OrgSettings = {
  crm: {
    branding: {
      name: 'CRM',
      logoUrl: null,
      faviconUrl: null,
      accentColor: 'blue',
      density: 'comfortable',
    },
    permissions: {
      sellerCanEditSales: true,
      sellerCanEditLeads: true,
    },
    ui: {
      density: 'comfortable',
      theme: 'light',
      accentColor: 'blue',
    },
  },
};

