import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, checkAccessibility } from '../utils/test-utils';
import LoginForm from '../../components/LoginForm';

describe('LoginForm', () => {
  const mockOnLogin = jest.fn();
  const mockOnRegister = jest.fn();
  
  const defaultProps = {
    onLogin: mockOnLogin,
    onRegister: mockOnRegister,
    isLoading: false,
    error: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders login form by default', () => {
      render(<LoginForm {...defaultProps} />);
      
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('shows register form when toggle is clicked', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      const toggleButton = screen.getByText(/create account/i);
      await user.click(toggleButton);
      
      expect(screen.getByText('Create Account')).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('shows loading state', () => {
      render(<LoginForm {...defaultProps} isLoading={true} />);
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    });

    it('displays error message', () => {
      render(<LoginForm {...defaultProps} error="Invalid credentials" />);
      
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Login Form', () => {
    it('calls onLogin with correct data when submitted', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      await user.type(emailInput, 'invalid-email');
      await user.click(submitButton);
      
      expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      expect(mockOnLogin).not.toHaveBeenCalled();
    });

    it('validates password is required', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.click(submitButton);
      
      expect(screen.getByText(/password.*required/i)).toBeInTheDocument();
      expect(mockOnLogin).not.toHaveBeenCalled();
    });

    it('prevents submission when loading', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} isLoading={true} />);
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);
      
      expect(mockOnLogin).not.toHaveBeenCalled();
    });
  });

  describe('Register Form', () => {
    it('calls onRegister with correct data when submitted', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      // Switch to register mode
      await user.click(screen.getByText(/create account/i));
      
      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      await user.type(usernameInput, 'testuser');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);
      
      await waitFor(() => {
        expect(mockOnRegister).toHaveBeenCalledWith({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('validates username is required', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      // Switch to register mode
      await user.click(screen.getByText(/create account/i));
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);
      
      expect(screen.getByText(/username.*required/i)).toBeInTheDocument();
      expect(mockOnRegister).not.toHaveBeenCalled();
    });

    it('validates password length for registration', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      // Switch to register mode
      await user.click(screen.getByText(/create account/i));
      
      const usernameInput = screen.getByLabelText(/username/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /create account/i });
      
      await user.type(usernameInput, 'testuser');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '123'); // Too short
      await user.click(submitButton);
      
      expect(screen.getByText(/password.*8 characters/i)).toBeInTheDocument();
      expect(mockOnRegister).not.toHaveBeenCalled();
    });
  });

  describe('Form Interactions', () => {
    it('toggles between login and register modes', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      // Start in login mode
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      
      // Switch to register
      await user.click(screen.getByText(/create account/i));
      expect(screen.getByText('Create Account')).toBeInTheDocument();
      
      // Switch back to login
      await user.click(screen.getByText(/already have.*account/i));
      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    it('clears form when switching modes', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      // Fill in login form
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      
      // Switch to register
      await user.click(screen.getByText(/create account/i));
      
      // Form should be cleared
      expect(screen.getByLabelText(/email/i)).toHaveValue('');
      expect(screen.getByLabelText(/password/i)).toHaveValue('');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      await user.tab();
      expect(emailInput).toHaveFocus();
      
      await user.tab();
      expect(passwordInput).toHaveFocus();
      
      await user.tab();
      expect(submitButton).toHaveFocus();
    });

    it('submits form on Enter key', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.keyboard('{Enter}');
      
      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalled();
      });
    });
  });

  describe('Password Visibility', () => {
    it('toggles password visibility', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      const passwordInput = screen.getByLabelText(/password/i);
      const toggleButton = screen.getByRole('button', { name: /show password/i });
      
      // Initially hidden
      expect(passwordInput).toHaveAttribute('type', 'password');
      
      // Click to show
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
      
      // Click to hide again
      await user.click(screen.getByRole('button', { name: /hide password/i }));
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Accessibility', () => {
    it('is accessible', async () => {
      const { container } = render(<LoginForm {...defaultProps} />);
      
      const results = await checkAccessibility(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper form labels and ARIA attributes', () => {
      render(<LoginForm {...defaultProps} />);
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
    });

    it('announces errors to screen readers', () => {
      render(<LoginForm {...defaultProps} error="Login failed" />);
      
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent('Login failed');
    });

    it('has appropriate button roles and labels', () => {
      render(<LoginForm {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('shows field-specific validation errors', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);
      
      expect(screen.getByText(/email.*required/i)).toBeInTheDocument();
      expect(screen.getByText(/password.*required/i)).toBeInTheDocument();
    });

    it('clears validation errors when user starts typing', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} />);
      
      // Trigger validation errors
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(submitButton);
      
      expect(screen.getByText(/email.*required/i)).toBeInTheDocument();
      
      // Start typing in email field
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test');
      
      // Error should be cleared
      expect(screen.queryByText(/email.*required/i)).not.toBeInTheDocument();
    });

    it('clears server errors when switching forms', async () => {
      const user = userEvent.setup();
      render(<LoginForm {...defaultProps} error="Server error" />);
      
      expect(screen.getByText('Server error')).toBeInTheDocument();
      
      // Switch to register form
      await user.click(screen.getByText(/create account/i));
      
      // Error should be cleared
      expect(screen.queryByText('Server error')).not.toBeInTheDocument();
    });
  });
}); 