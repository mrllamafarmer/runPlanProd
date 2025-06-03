import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, TestTube, MapPin, BarChart3 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { parseGPX, generateSampleData } from '../utils/gpxParser';
import { routeApi, handleApiError } from '../services/api';
import FileUploadSection from './FileUploadSection';
import RouteVisualization from './RouteVisualization';
import RoutePlanningTable from './RoutePlanningTable';
import TargetTimeControls from './TargetTimeControls';
import RouteSummary from './RouteSummary';

const AnalyzerTab: React.FC = () => {
  const {
    trackPoints,
    waypoints,
    fileInfo,
    isLoading,
    currentRoute,
    setTrackPoints,
    setWaypoints,
    setFileInfo,
    setLoading,
    setCurrentRoute,
    setHasValidTime,
    addToast,
  } = useAppStore();

  const [saveRouteName, setSaveRouteName] = useState('');
  const [uploadMode, setUploadMode] = useState<'database' | 'local'>('database');

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      addToast({
        type: 'error',
        message: 'Please upload a valid GPX file.',
      });
      return;
    }

    setLoading(true);
    
    try {
      if (uploadMode === 'database') {
        // Upload to database via backend
        const uploadResult = await routeApi.uploadGpxFile(file);
        
        // Fetch the saved route data to populate the UI
        const routeDetail = await routeApi.getRouteById(uploadResult.route_id.toString());
        
        // Convert backend format to frontend format
        if (routeDetail.route && routeDetail.trackPoints) {
          console.log('Raw API Response waypoints:', routeDetail.waypoints);
          
          const convertedTrackPoints = routeDetail.trackPoints.map((point: any) => ({
            lat: point.lat,
            lon: point.lon,
            elevation: point.elevation || 0,
            time: point.time || null,
            distance: point.distance || 0,
            cumulativeDistance: point.cumulativeDistance || 0
          }));
          
          // Convert waypoints from API format to frontend format
          const convertedWaypoints = routeDetail.waypoints?.map((waypoint: any, index: number) => ({
            id: waypoint.id?.toString() || index.toString(),
            legNumber: waypoint.order_index || index,
            legName: waypoint.name || `Waypoint ${index + 1}`,
            distanceMiles: 0, // Will be calculated by route planning logic
            cumulativeDistance: 0, // Will be calculated by route planning logic
            durationSeconds: 0, // Will be calculated by route planning logic
            legPaceSeconds: 0, // Will be calculated by route planning logic
            elevationGain: 0, // Will be calculated by route planning logic
            elevationLoss: 0, // Will be calculated by route planning logic
            cumulativeElevationGain: 0, // Will be calculated by route planning logic
            cumulativeElevationLoss: 0, // Will be calculated by route planning logic
            restTimeSeconds: 0,
            notes: waypoint.description || '',
            latitude: waypoint.latitude,
            longitude: waypoint.longitude,
            elevation: waypoint.elevation_meters || 0
          })) || [];
          
          console.log('Converted waypoints:', convertedWaypoints);
          
          const convertedFileInfo = {
            filename: uploadResult.route_name,
            totalDistance: uploadResult.total_distance_meters,
            totalElevationGain: uploadResult.total_elevation_gain_meters,
            totalElevationLoss: routeDetail.route.totalElevationLoss || 0,
            hasValidTime: false,
            startTime: undefined,
            trackPointCount: convertedTrackPoints.length
          };
          
          setTrackPoints(convertedTrackPoints);
          setWaypoints(convertedWaypoints);
          setFileInfo(convertedFileInfo);
          setHasValidTime(false);
          setCurrentRoute({
            filename: uploadResult.route_name,
            totalDistance: uploadResult.total_distance_meters,
            totalElevationGain: uploadResult.total_elevation_gain_meters,
            totalElevationLoss: routeDetail.route.totalElevationLoss || 0,
            hasValidTime: false,
            startTime: undefined,
            trackPoints: convertedTrackPoints,
            targetTimeSeconds: routeDetail.route.targetTimeSeconds || 0
          });
          
          addToast({
            type: 'success',
            message: `GPX file "${file.name}" uploaded and saved to database! 
                     Processed ${uploadResult.original_points} points in ${uploadResult.processing_time_seconds.toFixed(2)}s`,
          });
        }
      } else {
        // Local processing (original behavior)
        const fileText = await file.text();
        const { trackPoints: parsedPoints, fileInfo: parsedInfo } = parseGPX(fileText, file.name);
        
        setTrackPoints(parsedPoints);
        setFileInfo(parsedInfo);
        setHasValidTime(parsedInfo.hasValidTime);
        
        addToast({
          type: 'success',
          message: `GPX file "${file.name}" loaded successfully!`,
        });
      }
    } catch (error) {
      console.error('Error processing GPX:', error);
      addToast({
        type: 'error',
        message: `Error processing GPX file: ${handleApiError(error)}`,
      });
    } finally {
      setLoading(false);
    }
  }, [uploadMode, setTrackPoints, setWaypoints, setFileInfo, setLoading, setHasValidTime, setCurrentRoute, addToast]);

  const handleSampleData = useCallback(() => {
    setLoading(true);
    
    try {
      const { trackPoints: samplePoints, fileInfo: sampleInfo } = generateSampleData();
      
      setTrackPoints(samplePoints);
      setFileInfo(sampleInfo);
      setHasValidTime(sampleInfo.hasValidTime);
      
      addToast({
        type: 'success',
        message: 'Sample route data loaded successfully!',
      });
    } catch (error) {
      console.error('Error generating sample data:', error);
      addToast({
        type: 'error',
        message: 'Error generating sample data',
      });
    } finally {
      setLoading(false);
    }
  }, [setTrackPoints, setFileInfo, setLoading, setHasValidTime, addToast]);

  const handleSaveRoute = useCallback(async () => {
    if (!trackPoints.length || !fileInfo) {
      addToast({
        type: 'error',
        message: 'No route data to save',
      });
      return;
    }

    if (!saveRouteName.trim()) {
      addToast({
        type: 'error',
        message: 'Please enter a route name',
      });
      return;
    }

    setLoading(true);
    
    try {
      // Convert distance from miles to meters for backend consistency
      // Frontend parser calculates in miles, backend expects meters for distances > 1000
      const totalDistanceMeters = fileInfo.totalDistance * 1609.34; // Convert miles to meters
      
      const routeData = {
        filename: saveRouteName.trim(),
        totalDistance: totalDistanceMeters,
        totalElevationGain: fileInfo.totalElevationGain,
        totalElevationLoss: fileInfo.totalElevationLoss,
        hasValidTime: fileInfo.hasValidTime,
        startTime: fileInfo.startTime,
        trackPoints,
      };

      const response = await routeApi.createRoute(routeData);
      
      addToast({
        type: 'success',
        message: `Route "${saveRouteName}" saved successfully!`,
      });
      
      setSaveRouteName('');
    } catch (error) {
      console.error('Error saving route:', error);
      addToast({
        type: 'error',
        message: handleApiError(error),
      });
    } finally {
      setLoading(false);
    }
  }, [trackPoints, fileInfo, saveRouteName, setLoading, addToast]);

  return (
    <div className="space-y-8">
      {/* Upload Mode Selection */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <Upload className="h-5 w-5 mr-2" />
          Upload Mode
        </h3>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="uploadMode"
              value="database"
              checked={uploadMode === 'database'}
              onChange={(e) => setUploadMode(e.target.value as 'database' | 'local')}
              className="mr-2"
            />
            Save to Database (Recommended)
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="uploadMode"
              value="local"
              checked={uploadMode === 'local'}
              onChange={(e) => setUploadMode(e.target.value as 'database' | 'local')}
              className="mr-2"
            />
            Local Analysis Only
          </label>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {uploadMode === 'database' 
            ? 'GPX files will be processed and saved to your account for future access.'
            : 'GPX files will be processed locally without saving to database.'
          }
        </p>
      </div>

      {/* File Upload Section */}
      <FileUploadSection
        onFileUpload={handleFileUpload}
        onSampleData={handleSampleData}
        isLoading={isLoading}
      />

      {/* Route Info Display */}
      {fileInfo && (
        <RouteSummary fileInfo={fileInfo} />
      )}

      {/* Target Time Controls */}
      {trackPoints.length > 0 && (
        <TargetTimeControls />
      )}

      {/* Route Visualization */}
      {trackPoints.length > 0 && (
        <RouteVisualization trackPoints={trackPoints} waypoints={waypoints} />
      )}

      {/* Route Planning Table */}
      {trackPoints.length > 0 && (
        <RoutePlanningTable trackPoints={trackPoints} />
      )}

      {/* Save Route Section - Only show if not already saved to database */}
      {trackPoints.length > 0 && uploadMode === 'local' && (
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <MapPin className="h-5 w-5 mr-2" />
            Save Route
          </h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="routeName" className="block text-sm font-medium text-gray-700 mb-2">
                Route Name
              </label>
              <input
                type="text"
                id="routeName"
                value={saveRouteName}
                onChange={(e) => setSaveRouteName(e.target.value)}
                placeholder="Enter route name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSaveRoute}
              disabled={isLoading || !saveRouteName.trim()}
              className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Saving...' : 'Save Route'}
            </button>
          </div>
        </div>
      )}

      {/* Current Route Display */}
      {currentRoute && (
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 flex items-center text-green-800">
            <MapPin className="h-5 w-5 mr-2" />
            Current Route: {currentRoute.filename}
          </h3>
          <p className="text-sm text-green-700">
            Saved to your account • {(currentRoute.totalDistance / 1609.34).toFixed(2)} miles
          </p>
        </div>
      )}
    </div>
  );
};

export default AnalyzerTab;