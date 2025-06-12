import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import AnalyzerTab from './components/AnalyzerTab';
import SavedRoutesTab from './components/SavedRoutesTab';
import ToastContainer from './components/ToastContainer';
import LoginForm from './components/LoginForm';
import RegistrationForm from './components/RegistrationForm';
import { PasswordResetRequestForm } from './components/PasswordResetRequestForm';
import { PasswordResetConfirmForm } from './components/PasswordResetConfirmForm';
import { authApi } from './services/api';
import './index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('access_token');
        console.log('🔍 Authentication check - Token found:', !!token);
        
        if (token) {
          console.log('🔑 Validating token with backend...');
          const user = await authApi.getCurrentUser();
          console.log('✅ Token valid, user authenticated:', user);
          setCurrentUser(user);
          setIsAuthenticated(true);
        } else {
          console.log('❌ No token found in localStorage');
        }
      } catch (error) {
        // Token is invalid or expired
        console.log('❌ Token validation failed:', error);
        authApi.logout();
        setIsAuthenticated(false);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Check for password reset token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
      setResetToken(token);
      setShowPasswordReset(true);
      // Clear the token from URL for security
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    checkAuth();
  }, []);

  const handleLoginSuccess = (userData: any) => {
    setCurrentUser(userData);
    setIsAuthenticated(true);
  };

  const handleRegistrationSuccess = (userData: any) => {
    setCurrentUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    authApi.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Password reset with token
    if (showPasswordReset && resetToken) {
      return (
        <PasswordResetConfirmForm 
          token={resetToken}
          onSuccess={() => {
            setShowPasswordReset(false);
            setResetToken(null);
          }}
        />
      );
    }
    
    // Password reset request
    if (showPasswordReset) {
      return (
        <PasswordResetRequestForm 
          onBackToLogin={() => setShowPasswordReset(false)}
        />
      );
    }
    
    // Registration form
    if (showRegistration) {
      return (
        <RegistrationForm 
          onRegistrationSuccess={handleRegistrationSuccess}
          onSwitchToLogin={() => setShowRegistration(false)}
        />
      );
    }
    
    // Login form (default)
    return (
      <LoginForm 
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={() => setShowRegistration(true)}
        onForgotPassword={() => setShowPasswordReset(true)}
      />
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <Header currentUser={currentUser} onLogout={handleLogout} />
            <TabNavigation />
            
            <div className="p-8">
              <Routes>
                <Route path="/" element={<Navigate to="/analyzer" replace />} />
                <Route path="/analyzer" element={<AnalyzerTab />} />
                <Route path="/saved-routes" element={<SavedRoutesTab />} />
                <Route path="*" element={<Navigate to="/analyzer" replace />} />
              </Routes>
            </div>
          </div>
        </div>
        
        <ToastContainer />
      </div>
    </Router>
  );
}

export default App; 