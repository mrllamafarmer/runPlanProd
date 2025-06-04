import React, { useState, useEffect } from 'react';
import { Trash2, MapPin, Calendar, Route, AlertCircle, Eye } from 'lucide-react';
import { routeApi, handleApiError } from '../services/api';
import { RouteListItem } from '../types';
import { useAppStore } from '../store/useAppStore';

export default function SavedRoutesTab() {
  const [routes, setRoutes] = useState<RouteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);
  const [loadingRouteId, setLoadingRouteId] = useState<string | null>(null);

  // App store actions
  const { 
    setCurrentRoute, 
    setTrackPoints, 
    setWaypoints, 
    setFileInfo, 
    setActiveTab, 
    setHasValidTime,
    addToast,
    setCurrentRouteId,
    setRouteWaypoints
  } = useAppStore();

  // Fetch routes on component mount
  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedRoutes = await routeApi.getAllRoutes();
      setRoutes(fetchedRoutes);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleLoadRoute = async (routeId: string, routeName: string) => {
    try {
      setLoadingRouteId(routeId);
      
      // Fetch the full route details and waypoints
      const [routeDetail, routeWaypoints] = await Promise.all([
        routeApi.getRouteById(routeId),
        routeApi.getRouteWaypoints(routeId)
      ]);
      
      // Convert API response to frontend format
      if (routeDetail.route && routeDetail.trackPoints) {
        const convertedTrackPoints = routeDetail.trackPoints.map((point: any) => ({
          lat: point.lat || point.latitude,
          lon: point.lon || point.longitude,
          elevation: point.elevation || 0,
          time: point.time || null,
          distance: point.distance || 0,
          cumulativeDistance: point.cumulativeDistance || point.cumulative_distance || 0
        }));
        
        // Convert waypoints from API format to frontend format
        const convertedWaypoints = routeDetail.waypoints?.map((waypoint: any, index: number) => ({
          id: waypoint.id?.toString() || index.toString(),
          legNumber: waypoint.leg_number || index,
          legName: waypoint.leg_name || waypoint.name || `Waypoint ${index + 1}`,
          distanceMiles: (waypoint.distance_miles || 0),
          cumulativeDistance: waypoint.cumulative_distance || 0,
          durationSeconds: waypoint.duration_seconds || 0,
          legPaceSeconds: waypoint.leg_pace_seconds || 0,
          elevationGain: waypoint.elevation_gain || 0,
          elevationLoss: waypoint.elevation_loss || 0,
          cumulativeElevationGain: waypoint.cumulative_elevation_gain || 0,
          cumulativeElevationLoss: waypoint.cumulative_elevation_loss || 0,
          restTimeSeconds: waypoint.rest_time_seconds || 0,
          notes: waypoint.notes || '',
          latitude: waypoint.latitude,
          longitude: waypoint.longitude,
          elevation: waypoint.elevation || 0
        })) || [];

        // Create route data object (using consistent format with AnalyzerTab)
        const routeData = {
          filename: (routeDetail.route as any).name,
          totalDistance: (routeDetail.route as any).totalDistance * 1000, // Convert km to meters (1 km = 1000 m)
          totalElevationGain: (routeDetail.route as any).totalElevationGain || 0,
          totalElevationLoss: 0,
          hasValidTime: false,
          trackPoints: convertedTrackPoints,
          targetTimeSeconds: (routeDetail.route as any).targetTimeSeconds || 0,
          slowdownFactorPercent: (routeDetail.route as any).slowdownFactorPercent || 0,
          startTime: (routeDetail.route as any).startTime || undefined
        };

        // Create file info object
        const fileInfo = {
          filename: (routeDetail.route as any).name,
          trackPointCount: convertedTrackPoints.length,
          hasValidTime: false,
          startTime: undefined,
          totalDistance: (routeDetail.route as any).totalDistance * 0.621371, // Convert km to miles for fileInfo
          totalElevationGain: (routeDetail.route as any).totalElevationGain || 0,
          totalElevationLoss: 0
        };

        // Update app state
        setCurrentRoute(routeData);
        setTrackPoints(convertedTrackPoints);
        setWaypoints(convertedWaypoints);
        setFileInfo(fileInfo);
        setHasValidTime(false);
        
        // Set current route ID and load enhanced waypoints for waypoint management
        setCurrentRouteId(routeId);
        setRouteWaypoints(routeWaypoints || []);
        
        // Switch to analyzer tab
        setActiveTab('analyzer');
        
        // Show success toast
        addToast({
          type: 'success',
          message: `Loaded route "${routeName}" into analyzer`,
          duration: 3000
        });
      }
    } catch (err) {
      addToast({
        type: 'error',
        message: `Failed to load route: ${handleApiError(err)}`,
        duration: 5000
      });
    } finally {
      setLoadingRouteId(null);
    }
  };

  const handleDeleteRoute = async (routeId: string, routeName: string) => {
    // Confirm deletion
    if (!window.confirm(`Are you sure you want to delete "${routeName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingRouteId(routeId);
      await routeApi.deleteRoute(routeId);
      // Remove the deleted route from the list
      setRoutes(routes.filter(route => route.id !== routeId));
      addToast({
        type: 'success',
        message: `Deleted route "${routeName}"`,
        duration: 3000
      });
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setDeletingRouteId(null);
    }
  };

  const formatDistance = (kilometers: number) => {
    // Convert kilometers to miles (1 km = 0.621371 miles)
    const miles = kilometers * 0.621371;
    return miles.toFixed(1);
  };

  const formatElevation = (meters: number) => {
    // Convert meters to feet (1 meter = 3.28084 feet)
    const feet = meters * 3.28084;
    return Math.round(feet);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (seconds: number) => {
    if (seconds === 0) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading your saved routes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <h3 className="text-red-800 font-medium">Error Loading Routes</h3>
        </div>
        <p className="text-red-700 mt-2">{error}</p>
        <button
          onClick={fetchRoutes}
          className="mt-3 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="text-center py-12">
        <Route className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No saved routes</h3>
        <p className="text-gray-600">
          Upload your first GPX file using the "Analyze Route" tab to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Your Saved Routes ({routes.length})
        </h2>
        <button
          onClick={fetchRoutes}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {routes.map((route) => (
          <div
            key={route.id}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleLoadRoute(route.id, route.filename)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {route.filename}
                  </h3>
                  <Eye className="h-4 w-4 text-blue-500" />
                  {loadingRouteId === route.id && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Route className="h-4 w-4 mr-1 text-blue-500" />
                    <span>{formatDistance(route.total_distance)} miles</span>
                  </div>
                  
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1 text-green-500" />
                    <span>{formatElevation(route.total_elevation_gain)} ft gain</span>
                  </div>
                  
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1 text-purple-500" />
                    <span>{formatDate(route.upload_date)}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="text-gray-500">Time: {formatTime(route.target_time_seconds || 0)}</span>
                  </div>
                </div>

                {route.has_valid_time && (
                  <div className="mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      ⏱️ Contains timing data
                    </span>
                  </div>
                )}
              </div>

              <div className="ml-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent row click when deleting
                    handleDeleteRoute(route.id, route.filename);
                  }}
                  disabled={deletingRouteId === route.id}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                  title={`Delete ${route.filename}`}
                >
                  {deletingRouteId === route.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 