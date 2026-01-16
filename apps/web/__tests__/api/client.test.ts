import { api } from '@/lib/api/client';

// Mock fetch
global.fetch = jest.fn();

// Mock auth store
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      accessToken: 'test-token',
      refreshToken: 'refresh-token',
      user: { organizationId: 'org-123' },
      clearAuth: jest.fn(),
      updateAccessToken: jest.fn(),
    })),
  },
}));

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('makes GET request with auth headers', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: 'test' }),
    });

    await api.get('/test');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-Organization-Id': 'org-123',
        }),
      })
    );
  });

  it('makes POST request with body', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await api.post('/test', { foo: 'bar' });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ foo: 'bar' }),
      })
    );
  });
});
