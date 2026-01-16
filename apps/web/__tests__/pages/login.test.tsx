import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/(auth)/login/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock auth store
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: () => ({
    setTokens: jest.fn(),
    setTempToken: jest.fn(),
  }),
}));

// Mock API client
jest.mock('@/lib/api/client', () => ({
  api: {
    post: jest.fn(),
  },
}));

describe('LoginPage', () => {
  it('renders login form', () => {
    render(<LoginPage />);
    expect(screen.getByText('Remember Me')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('tu@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument();
  });
});
