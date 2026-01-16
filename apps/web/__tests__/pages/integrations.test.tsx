import { render, screen, waitFor } from '@testing-library/react';
import IntegrationsPage from '@/app/settings/integrations/page';
import { useConnectedAccounts } from '@/lib/api/hooks/use-connected-accounts';
import { useHealth } from '@/lib/api/hooks/use-health';
import { useJobMetrics } from '@/lib/api/hooks/use-job-metrics';
import { api } from '@/lib/api/client';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn((key: string) => {
      if (key === 'connected') return null;
      if (key === 'error') return null;
      return null;
    }),
  }),
}));

// Mock auth store
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: () => ({
    user: {
      id: 'user-1',
      organizationId: 'org-1',
    },
    accessToken: 'test-token',
  }),
}));

// Mock API hooks
jest.mock('@/lib/api/hooks/use-connected-accounts', () => ({
  useConnectedAccounts: jest.fn(),
}));

jest.mock('@/lib/api/hooks/use-health', () => ({
  useHealth: jest.fn(),
}));

jest.mock('@/lib/api/hooks/use-job-metrics', () => ({
  useJobMetrics: jest.fn(),
}));

// Mock API client
jest.mock('@/lib/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('IntegrationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useHealth as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    (useJobMetrics as jest.Mock).mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
  });

  it('renders disconnected state with connect button', () => {
    (useConnectedAccounts as jest.Mock).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<IntegrationsPage />);
    expect(screen.getByText('Conectar cuenta Meta')).toBeInTheDocument();
    expect(screen.getByText('No hay cuenta conectada')).toBeInTheDocument();
  });

  it('renders connected state with account details', async () => {
    const mockAccount = {
      id: 'account-1',
      provider: 'INSTAGRAM',
      displayName: 'My Instagram Page',
      status: 'CONNECTED',
      externalAccountId: 'page-123',
      metadata: {
        pageId: 'page-123',
        igUserId: 'ig-456',
        adAccounts: [{ id: 'act_789', name: 'Ad Account 1' }],
      },
      token: {
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        scopes: ['instagram_basic'],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    (useConnectedAccounts as jest.Mock).mockReturnValue({
      data: [mockAccount],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    (useHealth as jest.Mock).mockReturnValue({
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: { status: 'connected', latency: 5 },
        environment: 'test',
        version: '1.0.0',
      },
      isLoading: false,
      error: null,
    });

    render(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText('My Instagram Page')).toBeInTheDocument();
      expect(screen.getByText('CONNECTED')).toBeInTheDocument();
      expect(screen.getByText('Desconectar')).toBeInTheDocument();
    });
  });
});
