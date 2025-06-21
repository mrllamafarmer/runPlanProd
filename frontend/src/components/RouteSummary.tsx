import React, { useState } from 'react';
import { Edit3, Check, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { routeApi, handleApiError } from '../services/api';
import PdfExport from './PdfExport';

interface RouteSummaryProps {
  fileInfo: any;
}

export default function RouteSummary({ fileInfo }: RouteSummaryProps) {
  const { currentRoute, updateCurrentRoute, addToast } = useAppStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Determine which data source to use
  const routeName = currentRoute?.filename || fileInfo?.filename || 'Unknown Route';
  
  // For distance, check both sources and use the non-zero one
  let totalDistanceMeters = 0;
  if (currentRoute?.totalDistance && currentRoute.totalDistance > 0) {
    totalDistanceMeters = currentRoute.totalDistance;
  } else if (fileInfo?.totalDistance && fileInfo.totalDistance > 0) {
    totalDistanceMeters = fileInfo.totalDistance;
  }
  
  // Convert meters to miles (1 meter = 0.000621371 miles)
  const distanceInMiles = totalDistanceMeters * 0.000621371;
  
  const trackPointCount = fileInfo?.trackPointCount || 0;
  const hasValidTime = currentRoute?.hasValidTime || fileInfo?.hasValidTime || false;
  
  // Only show edit functionality if we have a saved route
  const canEditName = currentRoute && (currentRoute as any).id;
  
  const handleStartEdit = () => {
    setEditedName(routeName);
    setIsEditingName(true);
  };
  
  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditedName('');
  };
  
  const handleSaveEdit = async () => {
    if (!(currentRoute as any)?.id || !editedName.trim()) {
      return;
    }
    
    if (editedName.trim() === routeName) {
      // No change, just cancel
      handleCancelEdit();
      return;
    }
    
    setIsUpdating(true);
    
    try {
      await routeApi.updateRoute((currentRoute as any).id, {
        name: editedName.trim()
      });
      
      // Update the current route in the store
      updateCurrentRoute({
        ...currentRoute,
        filename: editedName.trim()
      });
      
      setIsEditingName(false);
      setEditedName('');
      
      addToast({
        type: 'success',
        message: 'Route name updated successfully'
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: `Failed to update route name: ${handleApiError(error)}`
      });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };
  
  return (
    <div className="bg-green-50 p-4 rounded-lg">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold text-green-800">Route Information</h3>
          
          {/* Editable Route Name */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-green-700">Route:</span>
            {isEditingName ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  className="flex-1 px-2 py-1 border border-green-300 rounded text-green-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  autoFocus
                  disabled={isUpdating}
                />
                <button
                  onClick={handleSaveEdit}
                  disabled={isUpdating || !editedName.trim()}
                  className="text-green-600 hover:text-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save changes"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={isUpdating}
                  className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Cancel editing"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-green-700">{routeName}</span>
                {canEditName && (
                  <button
                    onClick={handleStartEdit}
                    className="text-green-600 hover:text-green-800 opacity-70 hover:opacity-100"
                    title="Edit route name"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>
          
          <p className="text-green-700">Distance: {distanceInMiles.toFixed(1)} miles</p>
          <p className="text-green-700">Track Points: {trackPointCount}</p>
          {hasValidTime && (
            <p className="text-green-700">✓ Contains time data</p>
          )}
        </div>
        <PdfExport className="mt-1" />
      </div>
    </div>
  );
} 