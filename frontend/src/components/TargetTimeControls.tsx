import React, { useState, useEffect } from 'react';
import { Clock, Calculator, Target, TrendingDown } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { routeApi, handleApiError } from '../services/api';
import { 
  secondsToHHMMSS, 
  hhmmssToSeconds, 
  isValidHHMMSS, 
  calculatePaceSecondsPerMile, 
  formatPacePerMile,
  getPaceRangeInfo,
  calculateLegTimeWithSlowdown,
  calculateLegAveragePace,
  calculateWaypointDistances
} from '../utils/timeUtils';

export default function TargetTimeControls() {
  const {
    currentRoute,
    fileInfo,
    routeWaypoints,
    trackPoints,
    setTargetTime,
    targetTimeSeconds,
    slowdownFactorPercent,
    setSlowdownFactor,
    currentRouteId,
    addToast
  } = useAppStore();

  const [targetTimeInput, setTargetTimeInput] = useState('');
  const [slowdownInput, setSlowdownInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize inputs when values change
  useEffect(() => {
    if (targetTimeSeconds) {
      setTargetTimeInput(secondsToHHMMSS(targetTimeSeconds));
    } else {
      setTargetTimeInput('');
    }
  }, [targetTimeSeconds]);

  useEffect(() => {
    if (slowdownFactorPercent > 0) {
      setSlowdownInput(slowdownFactorPercent.toString());
    } else {
      setSlowdownInput('');
    }
  }, [slowdownFactorPercent]);

  // Load target time and slowdown factor when route is loaded
  useEffect(() => {
    if (currentRoute?.targetTimeSeconds) {
      setTargetTime(currentRoute.targetTimeSeconds);
    }
    if (currentRoute?.slowdownFactorPercent) {
      setSlowdownFactor(currentRoute.slowdownFactorPercent);
    }
  }, [currentRoute, setTargetTime, setSlowdownFactor]);

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

    // Get pace range information with slowdown factor
    const paceRangeInfo = getPaceRangeInfo(movingTimeSeconds, totalDistanceMiles, slowdownFactorPercent);

    // Calculate leg-by-leg breakdown if waypoints exist
    let legBreakdown: Array<{
      legName: string;
      distance: number;
      startDistance: number;
      endDistance: number;
      legTime: number;
      averagePace: string;
      cumulativeTime: number;
      restTime: number;
    }> = [];

    if (routeWaypoints && routeWaypoints.length > 0 && trackPoints && trackPoints.length > 0) {
      let cumulativeTimeWithRest = 0;

      // Use the same distance calculation logic as the waypoint table
      const waypointsWithDistances = calculateWaypointDistances(routeWaypoints, trackPoints);
      
      // Calculate cumulative distances from start of route
      let routeCumulativeDistance = 0;
      
      for (let index = 0; index < waypointsWithDistances.length; index++) {
        const waypoint = waypointsWithDistances[index];
        const legStartDistance = routeCumulativeDistance;
        const legDistance = waypoint.legDistance;
        const legEndDistance = legStartDistance + legDistance;
        
        const legTime = calculateLegTimeWithSlowdown(
          legStartDistance,
          legEndDistance,  
          totalDistanceMiles,
          movingTimeSeconds,
          slowdownFactorPercent
        );
        
        const legAveragePace = calculateLegAveragePace(
          legStartDistance,
          legEndDistance,
          totalDistanceMiles,
          movingTimeSeconds,
          slowdownFactorPercent
        );

        const restTime = waypoint.rest_time_seconds || 0;
        cumulativeTimeWithRest += legTime + restTime;

        legBreakdown.push({
          legName: waypoint.name || `Leg ${index + 1}`,
          distance: legDistance,
          startDistance: legStartDistance,
          endDistance: legEndDistance,
          legTime,
          averagePace: formatPacePerMile(legAveragePace),
          cumulativeTime: cumulativeTimeWithRest,
          restTime
        });

        routeCumulativeDistance = legEndDistance;
      }
      
      // Add final leg to finish if there's remaining distance
      const finalLegDistance = totalDistanceMiles - routeCumulativeDistance;
      if (finalLegDistance > 0.1) { // Only add if meaningful distance remains
        const legStartDistance = routeCumulativeDistance;
        const legEndDistance = totalDistanceMiles;
        
        const legTime = calculateLegTimeWithSlowdown(
          legStartDistance,
          legEndDistance,
          totalDistanceMiles,
          movingTimeSeconds,
          slowdownFactorPercent
        );
        
        const legAveragePace = calculateLegAveragePace(
          legStartDistance,
          legEndDistance,
          totalDistanceMiles,
          movingTimeSeconds,
          slowdownFactorPercent
        );

        cumulativeTimeWithRest += legTime;

        legBreakdown.push({
          legName: 'Finish',
          distance: finalLegDistance,
          startDistance: legStartDistance,
          endDistance: legEndDistance,
          legTime,
          averagePace: formatPacePerMile(legAveragePace),
          cumulativeTime: cumulativeTimeWithRest,
          restTime: 0
        });
      }
    }

    return {
      overallPace: formatPacePerMile(overallPaceSecondsPerMile),
      movingPace: formatPacePerMile(movingPaceSecondsPerMile),
      totalTime: secondsToHHMMSS(targetTimeSeconds),
      movingTime: secondsToHHMMSS(movingTimeSeconds),
      restTime: secondsToHHMMSS(totalRestTimeSeconds),
      paceRange: paceRangeInfo,
      legBreakdown
    };
  }, [targetTimeSeconds, totalDistanceMiles, totalRestTimeSeconds, slowdownFactorPercent, routeWaypoints, trackPoints]);

  const handleTargetTimeChange = (value: string) => {
    setTargetTimeInput(value);
    // Clear errors when user starts typing
    if (errors.targetTime) {
      setErrors(prev => ({ ...prev, targetTime: '' }));
    }
  };

  const handleSlowdownFactorChange = (value: string) => {
    setSlowdownInput(value);
    // Clear errors when user starts typing
    if (errors.slowdownFactor) {
      setErrors(prev => ({ ...prev, slowdownFactor: '' }));
    }
  };

  const saveTargetTimeToRoute = async (seconds: number, slowdownPercent: number = slowdownFactorPercent) => {
    if (!currentRouteId) {
      // If no saved route, just update local state
      setTargetTime(seconds);
      setSlowdownFactor(slowdownPercent);
      return;
    }

    setIsSaving(true);
    try {
      await routeApi.updateRoute(currentRouteId, {
        target_time_seconds: seconds,
        slowdown_factor_percent: slowdownPercent
      });
      
      setTargetTime(seconds);
      setSlowdownFactor(slowdownPercent);
      
      addToast({
        type: 'success',
        message: 'Target time and pacing saved to route'
      });
    } catch (error) {
      console.error('Error saving target time:', error);
      
      // Still update local state even if save fails
      setTargetTime(seconds);
      setSlowdownFactor(slowdownPercent);
      
      addToast({
        type: 'warning',
        message: 'Pacing settings set locally (route not saved to database)'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTargetTimeSubmit = async () => {
    let hasErrors = false;
    const newErrors: Record<string, string> = {};

    // Validate target time
    let seconds = 0;
    if (targetTimeInput.trim()) {
      if (!isValidHHMMSS(targetTimeInput)) {
        newErrors.targetTime = 'Please enter time in HH:MM:SS format (e.g., 04:30:00 for 4.5 hours)';
        hasErrors = true;
      } else {
        seconds = hhmmssToSeconds(targetTimeInput);
        if (seconds <= 0) {
          newErrors.targetTime = 'Target time must be greater than 0';
          hasErrors = true;
        }
      }
    }

    // Validate slowdown factor
    let slowdownPercent = 0;
    if (slowdownInput.trim()) {
      const slowdownValue = parseFloat(slowdownInput);
      if (isNaN(slowdownValue) || slowdownValue < 0 || slowdownValue > 100) {
        newErrors.slowdownFactor = 'Please enter a percentage between 0 and 100';
        hasErrors = true;
      } else {
        slowdownPercent = slowdownValue;
      }
    }

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    await saveTargetTimeToRoute(seconds, slowdownPercent);
    setErrors({});
  };

  const handleClearTargetTime = async () => {
    setTargetTimeInput('');
    setSlowdownInput('');
    await saveTargetTimeToRoute(0, 0);
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

      {/* Slowdown Factor Input */}
      <div className="mb-6">
        <label htmlFor="slowdown-factor" className="block text-sm font-medium text-gray-700 mb-2">
          <TrendingDown className="h-4 w-4 inline mr-1" />
          Pace Slowdown Factor (Optional)
        </label>
        <div className="flex gap-3 items-start">
          <div className="flex-1">
            <div className="relative">
              <input
                id="slowdown-factor"
                type="number"
                min="0"
                max="100"
                step="1"
                value={slowdownInput}
                onChange={(e) => handleSlowdownFactorChange(e.target.value)}
                placeholder="0"
                className={`w-full px-3 py-2 pr-8 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.slowdownFactor ? 'border-red-300 focus:border-red-500' : 'border-gray-300'
                }`}
                disabled={isSaving}
              />
              <span className="absolute right-3 top-2 text-gray-500 text-sm">%</span>
            </div>
            {errors.slowdownFactor && (
              <p className="mt-1 text-sm text-red-600">{errors.slowdownFactor}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Linear pace degradation: 0% = constant pace, 30% = 30% slower at finish than start
            </p>
          </div>
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
                <p className="text-sm text-gray-600 mb-1">
                  {paceCalculations.paceRange.isConstant ? 
                    '(Total Time - Rest Time) ÷ Distance' : 
                    'Variable Pace with Slowdown Factor'
                  }
                </p>
                {paceCalculations.paceRange.isConstant ? (
                  <p className="text-2xl font-bold text-green-700">{paceCalculations.paceRange.averagePace}</p>
                ) : (
                  <div>
                    <p className="text-lg font-bold text-green-700">
                      {paceCalculations.paceRange.startPace} → {paceCalculations.paceRange.endPace}
                    </p>
                    <p className="text-sm text-green-600 mt-1">
                      Average: {paceCalculations.paceRange.averagePace}
                    </p>
                  </div>
                )}
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

          {/* Leg-by-Leg Breakdown */}
          {paceCalculations.legBreakdown && paceCalculations.legBreakdown.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h5 className="font-medium text-gray-700 mb-3">Leg-by-Leg Pace Plan</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 rounded-md">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Leg</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Distance</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Avg Pace</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Leg Time</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Rest</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 border-b">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paceCalculations.legBreakdown.map((leg, index) => (
                      <tr key={index} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium">{leg.legName}</td>
                        <td className="px-3 py-2">{leg.distance.toFixed(2)} mi</td>
                        <td className="px-3 py-2 font-mono">{leg.averagePace}</td>
                        <td className="px-3 py-2">{secondsToHHMMSS(leg.legTime)}</td>
                        <td className="px-3 py-2">{leg.restTime > 0 ? secondsToHHMMSS(leg.restTime) : '-'}</td>
                        <td className="px-3 py-2 font-medium">{secondsToHHMMSS(leg.cumulativeTime)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                💡 Leg times account for {slowdownFactorPercent > 0 ? 'variable pacing with slowdown factor' : 'constant pacing'}
              </p>
            </div>
          )}

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