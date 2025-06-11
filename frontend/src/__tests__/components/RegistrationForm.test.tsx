import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegistrationForm from '../../components/RegistrationForm';
import { authApi } from '../../services/api';

// Mock the API
jest.mock('../../services/api');
const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

describe('RegistrationForm', () => {
  const mockOnRegistrationSuccess = jest.fn();
  const mockOnSwitchToLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders registration form with all fields', () => {
    render(
      <RegistrationForm 
        onRegistrationSuccess={mockOnRegistrationSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    render(
      <RegistrationForm 
        onRegistrationSuccess={mockOnRegistrationSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for short username', async () => {
    render(
      <RegistrationForm 
        onRegistrationSuccess={mockOnRegistrationSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const usernameInput = screen.getByLabelText(/username/i);
    fireEvent.change(usernameInput, { target: { value: 'ab' } });
    
    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/username must be at least 3 characters long/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for invalid email', async () => {
    render(
      <RegistrationForm 
        onRegistrationSuccess={mockOnRegistrationSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const emailInput = screen.getByLabelText(/email address/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    
    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for short password', async () => {
    render(
      <RegistrationForm 
        onRegistrationSuccess={mockOnRegistrationSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const passwordInput = screen.getByLabelText(/^password$/i);
    fireEvent.change(passwordInput, { target: { value: '1234567' } });
    
    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters long/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for mismatched passwords', async () => {
    render(
      <RegistrationForm 
        onRegistrationSuccess={mockOnRegistrationSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'different123' } });
    
    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const mockUserData = {
      user_id: 1,
      username: 'testuser',
      email: 'test@example.com',
      access_token: 'mock-token'
    };

    mockAuthApi.register.mockResolvedValue(mockUserData);

    render(
      <RegistrationForm 
        onRegistrationSuccess={mockOnRegistrationSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    // Fill out the form
    fireEvent.change(screen.getByLabelText(/username/i), { 
      target: { value: 'testuser' } 
    });
    fireEvent.change(screen.getByLabelText(/email address/i), { 
      target: { value: 'test@example.com' } 
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), { 
      target: { value: 'password123' } 
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { 
      target: { value: 'password123' } 
    });

    const submitButton = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockAuthApi.register).toHaveBeenCalledWith({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });
      expect(mockOnRegistrationSuccess).toHaveBeenCalledWith(mockUserData);
    });
  });

  it('calls onSwitchToLogin when link is clicked', () => {
    render(
      <RegistrationForm 
        onRegistrationSuccess={mockOnRegistrationSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    const switchLink = screen.getByRole('button', { name: /sign in here/i });
    fireEvent.click(switchLink);

    expect(mockOnSwitchToLogin).toHaveBeenCalled();
  });

  it('displays registration information', () => {
    render(
      <RegistrationForm 
        onRegistrationSuccess={mockOnRegistrationSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    expect(screen.getByText(/registration requires email approval/i)).toBeInTheDocument();
    expect(screen.getByText(/your email must be approved by an administrator/i)).toBeInTheDocument();
  });
}); 