import React from 'react';
import { MapPin } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-6">
      <div className="flex items-center justify-center space-x-3">
        <MapPin className="h-8 w-8" />
        <h1 className="text-3xl font-bold">GPX Route Analyzer</h1>
      </div>
      <p className="text-center text-primary-100 mt-2">
        Plan and analyze GPS routes for running and hiking
      </p>
    </header>
  );
};

export default Header; 