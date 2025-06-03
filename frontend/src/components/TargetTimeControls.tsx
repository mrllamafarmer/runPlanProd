import React, { useState, useEffect } from 'react';
import { Clock, Calculator, Target } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { routeApi, handleApiError } from '../services/api';
import { 
  secondsToHHMMSS, 
  hhmmssToSeconds, 
  isValidHHMMSS, 
  calculatePaceSecondsPerMile, 
  formatPacePerMile 
} from '../utils/timeUtils';

export default function TargetTimeControls() {
  const {
    currentRoute,
    fileInfo,
    routeWaypoints,
    setTargetTime,
    targetTimeSeconds,
    currentRouteId,
    addToast
  } = useAppStore();

  const [targetTimeInput, setTargetTimeInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize target time input when targetTimeSeconds changes
  useEffect(() => {
    if (targetTimeSeconds) {
      setTargetTimeInput(secondsToHHMMSS(targetTimeSeconds));
    } else {
      setTargetTimeInput('');
    }
  }, [targetTimeSeconds]);

  // Load target time when route is loaded
  useEffect(() => {
    if (currentRoute?.targetTimeSeconds) {
      setTargetTime(currentRoute.targetTimeSeconds);
    }
  }, [currentRoute, setTargetTime]);

  // Calculate total distance in miles
  const totalDistanceMiles = React.useMemo(() => {
    if (currentRoute?.totalDistance) {
      // Backend stores in meters, convert to miles
      return currentRoute.totalDistance / 1609.34;
    } else if (fileInfo?.totalDistance) {
      // FileInfo already in miles
      return fileInfo.totalDistance;
    }
    return 0;
  }, [currentRoute, fileInfo]);

  // Calculate total rest time from waypoints
  const totalRestTimeSeconds = React.useMemo(() => {
    if (!routeWaypoints?.length) return 0;
    
    return routeWaypoints.reduce((total: number, waypoint: any) => {
      return total + (waypoint.rest_time_seconds || 0);
    }, 0);
  }, [routeWaypoints]);

  // Calculate paces when target time is set
  const paceCalculations = React.useMemo(() => {
    if (!targetTimeSeconds || !totalDistanceMiles || totalDistanceMiles <= 0) {
      return null;
    }

    const overallPaceSecondsPerMile = calculatePaceSecondsPerMile(targetTimeSeconds, totalDistanceMiles);
    const movingTimeSeconds = targetTimeSeconds - totalRestTimeSeconds;
    const movingPaceSecondsPerMile = movingTimeSeconds > 0 
      ? calculatePaceSecondsPerMile(movingTimeSeconds, totalDistanceMiles)
      : 0;

    return {
      overallPace: formatPacePerMile(overallPaceSecondsPerMile),
      movingPace: formatPacePerMile(movingPaceSecondsPerMile),
      totalTime: secondsToHHMMSS(targetTimeSeconds),
      movingTime: secondsToHHMMSS(movingTimeSeconds),
      restTime: secondsToHHMMSS(totalRestTimeSeconds)
    };
  }, [targetTimeSeconds, totalDistanceMiles, totalRestTimeSeconds]);

  const handleTargetTimeChange = (value: string) => {
    setTargetTimeInput(value);
    // Clear errors when user starts typing
    if (errors.targetTime) {
      setErrors(prev => ({ ...prev, targetTime: '' }));
    }
  };

  const saveTargetTimeToRoute = async (seconds: number) => {
    if (!currentRouteId) {
      // If no saved route, just update local state
      setTargetTime(seconds);
      return;
    }

    setIsSaving(true);
    try {
      await routeApi.updateRoute(currentRouteId, {
        target_time_seconds: seconds
      });
      
      setTargetTime(seconds);
      
      addToast({
        type: 'success',
        message: 'Target time saved to route'
      });
    } catch (error) {
      console.error('Error saving target time:', error);
      
      // Still update local state even if save fails
      setTargetTime(seconds);
      
      addToast({
        type: 'warning',
        message: 'Target time set locally (route not saved to database)'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTargetTimeSubmit = async () => {
    if (!targetTimeInput.trim()) {
      await saveTargetTimeToRoute(0);
      setErrors({});
      return;
    }

    if (!isValidHHMMSS(targetTimeInput)) {
      setErrors({ targetTime: 'Please enter time in HH:MM:SS format (e.g., 04:30:00 for 4.5 hours)' });
      return;
    }

    const seconds = hhmmssToSeconds(targetTimeInput);
    if (seconds <= 0) {
      setErrors({ targetTime: 'Target time must be greater than 0' });
      return;
    }

    await saveTargetTimeToRoute(seconds);
    setErrors({});
  };

  const handleClearTargetTime = async () => {
    setTargetTimeInput('');
    await saveTargetTimeToRoute(0);
    setErrors({});
  };

  if (!totalDistanceMiles || totalDistanceMiles <= 0) {
    return (
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <div className="flex items-center">
          <Clock className="h-5 w-5 text-yellow-600 mr-2" />
          <p className="text-yellow-800">Load a route to access pace planning tools</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
      <h3 className="text-lg font-semibold mb-4 flex items-center text-blue-800">
        <Target className="h-5 w-5 mr-2" />
        Target Time & Pace Planning
        {currentRouteId && (
          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
            Auto-save enabled
          </span>
        )}
      </h3>

      {/* Route Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-md">
          <h4 className="font-medium text-gray-700 mb-1">Total Distance</h4>
          <p className="text-lg font-semibold text-gray-900">{totalDistanceMiles.toFixed(2)} miles</p>
        </div>
        <div className="bg-white p-4 rounded-md">
          <h4 className="font-medium text-gray-700 mb-1">Total Rest Time</h4>
          <p className="text-lg font-semibold text-gray-900">
            {totalRestTimeSeconds > 0 ? secondsToHHMMSS(totalRestTimeSeconds) : 'No rest planned'}
          </p>
        </div>
        <div className="bg-white p-4 rounded-md">
          <h4 className="font-medium text-gray-700 mb-1">Waypoints</h4>
          <p className="text-lg font-semibold text-gray-900">
            {routeWaypoints?.length || 0} waypoints
          </p>
        </div>
      </div>

      {/* Target Time Input */}
      <div className="mb-6">
        <label htmlFor="target-time" className="block text-sm font-medium text-gray-700 mb-2">
          Target Completion Time
        </label>
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <input
              id="target-time"
              type="text"
              value={targetTimeInput}
              onChange={(e) => handleTargetTimeChange(e.target.value)}
              placeholder="HH:MM:SS (e.g., 04:30:00)"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.targetTime ? 'border-red-300 focus:border-red-500' : 'border-gray-300'
              }`}
              disabled={isSaving}
            />
            {errors.targetTime && (
              <p className="mt-1 text-sm text-red-600">{errors.targetTime}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Supports times greater than 24 hours (e.g., 30:00:00 for 30 hours)
              {currentRouteId && <span className="text-green-600"> • Auto-saves to route</span>}
            </p>
          </div>
          <button
            onClick={handleTargetTimeSubmit}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Calculate'}
          </button>
          {targetTimeSeconds && (
            <button
              onClick={handleClearTargetTime}
              disabled={isSaving}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Pace Calculations Display */}
      {paceCalculations && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h4 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
            <Calculator className="h-5 w-5 mr-2" />
            Pace Calculations
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Pace */}
            <div className="space-y-3">
              <h5 className="font-medium text-gray-700">Overall Pace</h5>
              <div className="bg-blue-50 p-4 rounded-md">
                <p className="text-sm text-gray-600 mb-1">Total Time ÷ Distance</p>
                <p className="text-2xl font-bold text-blue-700">{paceCalculations.overallPace}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {paceCalculations.totalTime} ÷ {totalDistanceMiles.toFixed(2)} miles
                </p>
              </div>
            </div>

            {/* Moving Pace */}
            <div className="space-y-3">
              <h5 className="font-medium text-gray-700">Moving Pace</h5>
              <div className="bg-green-50 p-4 rounded-md">
                <p className="text-sm text-gray-600 mb-1">(Total Time - Rest Time) ÷ Distance</p>
                <p className="text-2xl font-bold text-green-700">{paceCalculations.movingPace}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {paceCalculations.movingTime} ÷ {totalDistanceMiles.toFixed(2)} miles
                </p>
              </div>
            </div>
          </div>

          {/* Time Breakdown */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h5 className="font-medium text-gray-700 mb-3">Time Breakdown</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Time:</span>
                <span className="ml-2 font-medium">{paceCalculations.totalTime}</span>
              </div>
              <div>
                <span className="text-gray-600">Moving Time:</span>
                <span className="ml-2 font-medium">{paceCalculations.movingTime}</span>
              </div>
              <div>
                <span className="text-gray-600">Rest Time:</span>
                <span className="ml-2 font-medium">{paceCalculations.restTime}</span>
              </div>
            </div>
          </div>

          {totalRestTimeSeconds === 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                💡 <strong>Tip:</strong> Add rest times to waypoints for more accurate moving pace calculations.
              </p>
            </div>
          )}
        </div>
      )}

      {!targetTimeSeconds && (
        <div className="bg-gray-50 p-4 rounded-md">
          <p className="text-gray-600 text-sm">
            Enter a target completion time to calculate your required overall pace and moving pace.
            Moving pace accounts for rest times you've planned at waypoints.
            {currentRouteId && <span className="block mt-1 text-green-600 font-medium">Target time will be automatically saved to your route.</span>}
          </p>
        </div>
      )}
    </div>
  );
} 