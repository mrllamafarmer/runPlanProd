import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import TabNavigation from './components/TabNavigation';
import AnalyzerTab from './components/AnalyzerTab';
import SavedRoutesTab from './components/SavedRoutesTab';
import ToastContainer from './components/ToastContainer';
import './index.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <Header />
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