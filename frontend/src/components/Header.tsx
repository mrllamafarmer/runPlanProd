import React from 'react';
import { MapPin, LogOut, User } from 'lucide-react';

interface HeaderProps {
  currentUser?: any;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onLogout }) => {
  return (
    <header className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <MapPin className="h-8 w-8" />
          <div>
            <h1 className="text-3xl font-bold">GPX Route Analyzer</h1>
            <p className="text-primary-100">
              Plan and analyze GPS routes for running and hiking
            </p>
          </div>
        </div>
        
        {currentUser && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-primary-500 bg-opacity-50 rounded-lg px-3 py-2">
              <User className="h-5 w-5" />
              <div className="text-sm">
                <div className="font-medium">{currentUser.username}</div>
                <div className="text-primary-200 text-xs">{currentUser.email}</div>
              </div>
            </div>
            
            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 rounded-lg px-3 py-2 transition-colors"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm">Logout</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header; 