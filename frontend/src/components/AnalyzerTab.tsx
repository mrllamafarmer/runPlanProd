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
    fileInfo,
    isLoading,
    currentRoute,
    setTrackPoints,
    setFileInfo,
    setLoading,
    setCurrentRoute,
    setHasValidTime,
    addToast,
  } = useAppStore();

  const [saveRouteName, setSaveRouteName] = useState('');

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
      const fileText = await file.text();
      const { trackPoints: parsedPoints, fileInfo: parsedInfo } = parseGPX(fileText, file.name);
      
      setTrackPoints(parsedPoints);
      setFileInfo(parsedInfo);
      setHasValidTime(parsedInfo.hasValidTime);
      
      addToast({
        type: 'success',
        message: `GPX file "${file.name}" loaded successfully!`,
      });
    } catch (error) {
      console.error('Error parsing GPX:', error);
      addToast({
        type: 'error',
        message: `Error parsing GPX file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  }, [setTrackPoints, setFileInfo, setLoading, setHasValidTime, addToast]);

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
      const routeData = {
        filename: saveRouteName.trim(),
        totalDistance: fileInfo.totalDistance,
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
        <RouteVisualization trackPoints={trackPoints} />
      )}

      {/* Route Planning Table */}
      {trackPoints.length > 0 && (
        <RoutePlanningTable trackPoints={trackPoints} />
      )}

      {/* Save Route Section */}
      {trackPoints.length > 0 && (
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
    </div>
  );
};

export default AnalyzerTab; 