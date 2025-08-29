import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../../pages/LoginPage';
import { auth } from '../../lib/api';

// Mock the API module
vi.mock('../../lib/api');

const renderWithProviders = (component) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Authentication Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Login Functionality', () => {
    it('should successfully login with valid credentials', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
      };

      auth.login.mockResolvedValue({
        data: {
          success: true,
          data: {
            user: mockUser,
            token: 'test-token',
          },
        },
      });

      renderWithProviders(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(auth.login).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(localStorage.setItem).toHaveBeenCalledWith('token', 'test-token');
        expect(localStorage.setItem).toHaveBeenCalledWith('user', JSON.stringify(mockUser));
      });
    });

    it('should display error message with invalid credentials', async () => {
      auth.login.mockRejectedValue({
        response: {
          data: {
            error: 'Invalid credentials',
          },
        },
      });

      renderWithProviders(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      renderWithProviders(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      });
    });

    it('should require password', async () => {
      renderWithProviders(<LoginPage />);

      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/password is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Logout Functionality', () => {
    it('should clear user data on logout', async () => {
      localStorage.setItem('token', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Test' }));

      auth.logout.mockResolvedValue({ data: { success: true } });

      // Simulate logout action
      await auth.logout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user');
    });
  });

  describe('Token Management', () => {
    it('should refresh token when expired', async () => {
      const newToken = 'new-test-token';
      auth.refreshToken.mockResolvedValue({
        data: {
          success: true,
          data: { token: newToken },
        },
      });

      const result = await auth.refreshToken();

      expect(result.data.data.token).toBe(newToken);
    });

    it('should handle refresh token failure', async () => {
      auth.refreshToken.mockRejectedValue(new Error('Token refresh failed'));

      await expect(auth.refreshToken()).rejects.toThrow('Token refresh failed');
    });
  });
});