import React, { useState, useEffect } from 'react';
import { WaypointDB, WaypointUpdate } from '../types';
import { secondsToMMSS, mmssToSeconds, isValidMMSS } from '../utils/timeUtils';

interface WaypointEditModalProps {
  isOpen: boolean;
  waypoint: WaypointDB | null;
  onClose: () => void;
  onSave: (waypointId: number, updates: WaypointUpdate) => Promise<void>;
  onDelete?: (waypointId: number) => Promise<void>;
}

export default function WaypointEditModal({
  isOpen,
  waypoint,
  onClose,
  onSave,
  onDelete
}: WaypointEditModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    waypoint_type: 'checkpoint' as 'start' | 'checkpoint' | 'finish' | 'poi' | 'crew' | 'food_water' | 'rest',
    rest_time_mmss: '00:00'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when waypoint changes
  useEffect(() => {
    if (waypoint) {
      setFormData({
        name: waypoint.name || '',
        description: waypoint.description || '',
        waypoint_type: waypoint.waypoint_type || 'checkpoint',
        rest_time_mmss: secondsToMMSS(waypoint.rest_time_seconds || 0)
      });
      setErrors({});
    }
  }, [waypoint]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: typeof formData) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev: Record<string, string>) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Waypoint name is required';
    } else if (formData.name.length > 100) {
      newErrors.name = 'Name must be 100 characters or less';
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }

    if (formData.rest_time_mmss && !isValidMMSS(formData.rest_time_mmss)) {
      newErrors.rest_time_mmss = 'Please enter time in MM:SS format (e.g., 15:30)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!waypoint || !validateForm()) return;

    setIsSaving(true);
    try {
      const updates: WaypointUpdate = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        waypoint_type: formData.waypoint_type,
        rest_time_seconds: mmssToSeconds(formData.rest_time_mmss)
      };

      await onSave(waypoint.id, updates);
      onClose();
    } catch (error) {
      console.error('Error saving waypoint:', error);
      setErrors({ general: 'Failed to save waypoint. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!waypoint || !onDelete) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete waypoint "${waypoint.name}"? This action cannot be undone.`
    );

    if (confirmDelete) {
      setIsSaving(true);
      try {
        await onDelete(waypoint.id);
        onClose();
      } catch (error) {
        console.error('Error deleting waypoint:', error);
        setErrors({ general: 'Failed to delete waypoint. Please try again.' });
      } finally {
        setIsSaving(false);
      }
    }
  };

  if (!isOpen || !waypoint) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto border border-gray-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Edit Waypoint
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSaving}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Name Field */}
            <div>
              <label htmlFor="waypoint-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                id="waypoint-name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white ${
                  errors.name ? 'border-red-300 focus:border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter waypoint name"
                disabled={isSaving}
                style={{ 
                  backgroundColor: '#ffffff !important',
                  backgroundImage: 'none !important',
                  opacity: '1 !important',
                  color: '#000000 !important'
                }}
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            {/* Notes/Description - moved to appear right after name */}
            <div>
              <label htmlFor="waypoint-notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                id="waypoint-notes"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white ${
                  errors.description ? 'border-red-300 focus:border-red-500' : 'border-gray-300'
                }`}
                placeholder="Add notes or description for this waypoint..."
                disabled={isSaving}
                style={{ 
                  backgroundColor: '#ffffff !important',
                  backgroundImage: 'none !important',
                  opacity: '1 !important',
                  color: '#000000 !important'
                }}
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
            </div>

            {/* Waypoint Type */}
            <div>
              <label htmlFor="waypoint-type" className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                id="waypoint-type"
                value={formData.waypoint_type}
                onChange={(e) => handleInputChange('waypoint_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSaving}
                style={{ 
                  backgroundColor: '#ffffff !important',
                  backgroundImage: 'none !important',
                  opacity: '1 !important',
                  color: '#000000 !important'
                }}
              >
                <option value="start">Start</option>
                <option value="checkpoint">Checkpoint</option>
                <option value="finish">Finish</option>
                <option value="poi">Point of Interest</option>
                <option value="crew">Crew</option>
                <option value="food_water">Food / Water</option>
                <option value="rest">Rest</option>
              </select>
            </div>

            {/* Rest Time */}
            <div>
              <label htmlFor="rest-time" className="block text-sm font-medium text-gray-700 mb-1">
                Rest Time (MM:SS)
              </label>
              <input
                id="rest-time"
                type="text"
                value={formData.rest_time_mmss}
                onChange={(e) => handleInputChange('rest_time_mmss', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.rest_time_mmss ? 'border-red-300 focus:border-red-500' : 'border-gray-300'
                }`}
                placeholder="00:00"
                disabled={isSaving}
                style={{ 
                  backgroundColor: '#ffffff !important',
                  backgroundImage: 'none !important',
                  opacity: '1 !important',
                  color: '#000000 !important'
                }}
              />
              {errors.rest_time_mmss && <p className="mt-1 text-sm text-red-600">{errors.rest_time_mmss}</p>}
              <p className="mt-1 text-xs text-gray-500">
                Enter rest duration in minutes:seconds format. No limit for multiday races.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
            <div>
              {onDelete && (
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Delete Waypoint
                </button>
              )}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formData.name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 