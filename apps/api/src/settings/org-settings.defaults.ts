export type UiDensity = 'comfortable' | 'compact';
export type UiTheme = 'light' | 'dark';
export type UiAccentColor = 'blue' | 'violet' | 'green';

export type ConversationStatus = 'OPEN' | 'PENDING' | 'CLOSED';

export interface OrgCrmSettings {
  permissions: {
    sellerCanChangeConversationStatus: boolean;
    sellerCanReassignConversation: boolean;
    sellerCanEditSales: boolean;
    sellerCanEditLeads: boolean;
    sellerCanMoveKanban: boolean;
  };
  inbox: {
    sellerSeesOnlyAssigned: boolean;
    autoAssignOnReply: boolean;
    defaultConversationStatus: ConversationStatus;
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
    permissions: {
      sellerCanChangeConversationStatus: true,
      sellerCanReassignConversation: true,
      sellerCanEditSales: true,
      sellerCanEditLeads: true,
      sellerCanMoveKanban: true,
    },
    inbox: {
      sellerSeesOnlyAssigned: true,
      autoAssignOnReply: true,
      defaultConversationStatus: 'OPEN',
    },
    ui: {
      density: 'comfortable',
      theme: 'light',
      accentColor: 'blue',
    },
  },
};

