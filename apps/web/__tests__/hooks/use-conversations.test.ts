import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useConversations } from '@/lib/api/hooks/use-conversations';
import { api } from '@/lib/api/client';

jest.mock('@/lib/api/client');

describe('useConversations', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  it('fetches conversations with filters', async () => {
    const mockData = {
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
    };

    (api.get as jest.Mock).mockResolvedValueOnce(mockData);

    const wrapper = ({ children }: { children: React.ReactNode }) => {
      return React.createElement(QueryClientProvider, { client: queryClient }, children);
    };

    const { result } = renderHook(
      () => useConversations({ provider: 'WHATSAPP', status: 'OPEN' }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining('provider=WHATSAPP')
    );
    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining('status=OPEN')
    );
  });
});
