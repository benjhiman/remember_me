import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TemplatePicker } from '@/components/inbox/template-picker';
import { api } from '@/lib/api/client';

jest.mock('@/lib/api/client');

describe('TemplatePicker', () => {
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

  const mockTemplates = [
    {
      id: 'template-1',
      name: 'Welcome Message',
      category: 'UTILITY',
      language: 'es_AR',
      status: 'APPROVED',
      componentsJson: [
        {
          type: 'HEADER',
          text: 'Bienvenido {{1}}',
        },
        {
          type: 'BODY',
          text: 'Hola {{1}}, gracias por contactarnos. Tu código es {{2}}.',
        },
      ],
    },
    {
      id: 'template-2',
      name: 'Order Confirmation',
      category: 'MARKETING',
      language: 'es_AR',
      status: 'APPROVED',
      componentsJson: [
        {
          type: 'BODY',
          text: 'Tu pedido {{1}} ha sido confirmado.',
        },
      ],
    },
  ];

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('renders template list with search', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: mockTemplates });

    const onSelect = jest.fn();

    render(
      <Wrapper>
        <TemplatePicker provider="WHATSAPP" onSelect={onSelect} />
      </Wrapper>
    );

    const button = screen.getByText('Usar plantilla');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Welcome Message')).toBeInTheDocument();
      expect(screen.getByText('Order Confirmation')).toBeInTheDocument();
    });

    // Test search
    const searchInput = screen.getByPlaceholderText('Buscar por nombre o categoría...');
    fireEvent.change(searchInput, { target: { value: 'Welcome' } });

    await waitFor(() => {
      expect(screen.getByText('Welcome Message')).toBeInTheDocument();
      expect(screen.queryByText('Order Confirmation')).not.toBeInTheDocument();
    });
  });

  it('shows variable inputs and preview when template selected', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: mockTemplates });

    const onSelect = jest.fn();

    render(
      <Wrapper>
        <TemplatePicker provider="WHATSAPP" onSelect={onSelect} />
      </Wrapper>
    );

    const button = screen.getByText('Usar plantilla');
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText('Welcome Message')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Welcome Message'));

    await waitFor(() => {
      expect(screen.getByText('Variable 1:')).toBeInTheDocument();
      expect(screen.getByText('Variable 2:')).toBeInTheDocument();
      expect(screen.getByText('Vista previa:')).toBeInTheDocument();
    });

    // Fill variables
    const var1Input = screen.getByPlaceholderText('Valor para variable 1');
    const var2Input = screen.getByPlaceholderText('Valor para variable 2');

    fireEvent.change(var1Input, { target: { value: 'Juan' } });
    fireEvent.change(var2Input, { target: { value: 'ABC123' } });

    // Check preview updates
    await waitFor(() => {
      expect(screen.getByText(/Juan/)).toBeInTheDocument();
      expect(screen.getByText(/ABC123/)).toBeInTheDocument();
    });

    // Send button should be enabled now
    const sendButton = screen.getByText('Enviar plantilla');
    expect(sendButton).not.toBeDisabled();

    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith('template-1', {
        '1': 'Juan',
        '2': 'ABC123',
      });
    });
  });

  it('validates required variables before allowing send', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: mockTemplates });

    const onSelect = jest.fn();

    render(
      <Wrapper>
        <TemplatePicker provider="WHATSAPP" onSelect={onSelect} />
      </Wrapper>
    );

    const button = screen.getByText('Usar plantilla');
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText('Welcome Message')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Welcome Message'));

    await waitFor(() => {
      expect(screen.getByText('Variable 1:')).toBeInTheDocument();
    });

    // Send button should be disabled
    const sendButton = screen.getByText('Enviar plantilla');
    expect(sendButton).toBeDisabled();

    // Fill only one variable
    const var1Input = screen.getByPlaceholderText('Valor para variable 1');
    fireEvent.change(var1Input, { target: { value: 'Juan' } });

    // Still disabled (missing var2)
    expect(sendButton).toBeDisabled();
    expect(screen.getByText(/Completa todas las variables requeridas/)).toBeInTheDocument();
  });
});
