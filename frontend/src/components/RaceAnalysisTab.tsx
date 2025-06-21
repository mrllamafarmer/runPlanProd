import React, { useState } from 'react';
import { Upload, Activity, Clock, TrendingUp, MapPin } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { handleApiError } from '../services/api';
import { raceAnalysisApi, RaceAnalysisCreate, RaceAnalysisResponse } from '../services/raceAnalysisApi';

interface RaceTrackPoint {
  lat: number;
  lon: number;
  elevation?: number;
  time: Date;
  cumulativeDistance: number;
  cumulativeTime: number; // seconds from start
}

interface WaypointComparison {
  waypoint: any; // From planned route
  plannedCumulativeTime: number;
  actualCumulativeTime?: number;
  timeDifference?: number; // actual - planned (negative = ahead, positive = behind)
  legDuration?: number; // actual leg duration in seconds
  legDistance?: number; // distance to this waypoint
  actualPace?: number; // pace for this leg in seconds per mile
  plannedPace?: number; // planned pace for this leg
}

export default function RaceAnalysisTab() {
  const { currentRoute, routeWaypoints, currentRouteId, addToast } = useAppStore();
  
  const [isUploading, setIsUploading] = useState(false);
  const [raceTrackPoints, setRaceTrackPoints] = useState<RaceTrackPoint[]>([]);
  const [waypointComparisons, setWaypointComparisons] = useState<WaypointComparison[]>([]);
  const [raceFileName, setRaceFileName] = useState<string>('');
  const [raceStartTime, setRaceStartTime] = useState<Date | null>(null);
  const [raceTotalTime, setRaceTotalTime] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<RaceAnalysisResponse[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveAnalysisName, setSaveAnalysisName] = useState<string>('');
  const [loadingAnalysisId, setLoadingAnalysisId] = useState<number | null>(null);
  const [deletingAnalysisId, setDeletingAnalysisId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [analysisToDelete, setAnalysisToDelete] = useState<{ id: number; name: string } | null>(null);

  // Check if we have a planned route loaded
  const hasPlannedRoute = currentRoute && routeWaypoints.length > 0;

  // Load saved analyses for current route
  React.useEffect(() => {
    const loadSavedAnalyses = async () => {
      if (!currentRouteId) return;
      
      try {
        const analyses = await raceAnalysisApi.getRouteRaceAnalyses(parseInt(currentRouteId));
        setSavedAnalyses(analyses);
      } catch (error) {
        console.error('Failed to load saved analyses:', error);
      }
    };

    loadSavedAnalyses();
  }, [currentRouteId]);

  const parseGpxFile = (gpxContent: string, filename: string): RaceTrackPoint[] => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    // Check for parsing errors
    const parseError = xmlDoc.getElementsByTagName('parsererror')[0];
    if (parseError) {
      throw new Error('Invalid GPX file format');
    }

    // Get all track points
    const trackPoints = xmlDoc.getElementsByTagName('trkpt');
    if (trackPoints.length === 0) {
      throw new Error('No track points found in GPX file');
    }

    const allPoints: RaceTrackPoint[] = [];
    let cumulativeDistance = 0;
    let startTime: Date | null = null;

    // Process all points first to get times
    for (let i = 0; i < trackPoints.length; i++) {
      const point = trackPoints[i];
      const lat = parseFloat(point.getAttribute('lat') || '0');
      const lon = parseFloat(point.getAttribute('lon') || '0');
      
      const elevationElement = point.getElementsByTagName('ele')[0];
      const elevation = elevationElement ? parseFloat(elevationElement.textContent || '0') : undefined;
      
      const timeElement = point.getElementsByTagName('time')[0];
      if (!timeElement || !timeElement.textContent) {
        continue; // Skip points without time data
      }
      
      const time = new Date(timeElement.textContent);
      if (!startTime) {
        startTime = time;
      }

      // Calculate distance from previous point
      if (i > 0 && allPoints.length > 0) {
        const prevPoint = allPoints[allPoints.length - 1];
        const distance = calculateDistance(prevPoint.lat, prevPoint.lon, lat, lon);
        cumulativeDistance += distance;
      }

      const cumulativeTime = startTime ? (time.getTime() - startTime.getTime()) / 1000 : 0;

      allPoints.push({
        lat,
        lon,
        elevation,
        time,
        cumulativeDistance,
        cumulativeTime
      });
    }

    if (allPoints.length === 0) {
      throw new Error('No valid track points with time data found');
    }

    // Sample every 20th point (plus first and last)
    const sampledPoints: RaceTrackPoint[] = [];
    
    // Always include first point
    sampledPoints.push(allPoints[0]);
    
    // Sample every 20th point
    for (let i = 20; i < allPoints.length - 20; i += 20) {
      sampledPoints.push(allPoints[i]);
    }
    
    // Always include last point
    if (allPoints.length > 1) {
      sampledPoints.push(allPoints[allPoints.length - 1]);
    }

    return sampledPoints;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const findClosestTrackPoint = (targetLat: number, targetLon: number, trackPoints: RaceTrackPoint[]): RaceTrackPoint | null => {
    if (trackPoints.length === 0) return null;

    let closestPoint = trackPoints[0];
    let minDistance = calculateDistance(targetLat, targetLon, closestPoint.lat, closestPoint.lon);

    for (const point of trackPoints) {
      const distance = calculateDistance(targetLat, targetLon, point.lat, point.lon);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }

    return closestPoint;
  };

  const analyzeRacePerformance = (racePoints: RaceTrackPoint[]) => {
    if (!hasPlannedRoute || racePoints.length === 0 || !currentRoute) return;

    const comparisons: WaypointComparison[] = [];
    let previousActualTime = 0;
    
    // Calculate total planned time from route target time
    const totalPlannedTime = currentRoute.targetTimeSeconds || 0;
    
    // Calculate distances between waypoints based on race track
    const waypointDistances: number[] = [];
    let totalDistance = 0;
    
    for (let i = 0; i < routeWaypoints.length; i++) {
      const waypoint = routeWaypoints[i];
      const closestPoint = findClosestTrackPoint(waypoint.latitude, waypoint.longitude, racePoints);
      
      if (closestPoint) {
        if (i === 0) {
          waypointDistances.push(closestPoint.cumulativeDistance);
        } else {
          const prevClosest = findClosestTrackPoint(routeWaypoints[i-1].latitude, routeWaypoints[i-1].longitude, racePoints);
          if (prevClosest) {
            waypointDistances.push(closestPoint.cumulativeDistance - prevClosest.cumulativeDistance);
          } else {
            waypointDistances.push(0);
          }
        }
        totalDistance = Math.max(totalDistance, closestPoint.cumulativeDistance);
      } else {
        waypointDistances.push(0);
      }
    }
    
    // Calculate planned cumulative times proportionally
    let cumulativePlannedTime = 0;
    let cumulativeDistance = 0;

    for (let i = 0; i < routeWaypoints.length; i++) {
      const waypoint = routeWaypoints[i];
      const legDistance = waypointDistances[i];
      cumulativeDistance += legDistance;
      
      // Calculate planned time for this leg proportionally
      const proportionalTime = totalDistance > 0 ? (totalPlannedTime * cumulativeDistance / totalDistance) : 0;
      cumulativePlannedTime = proportionalTime;
      
      // Find closest actual track point
      const closestPoint = findClosestTrackPoint(waypoint.latitude, waypoint.longitude, racePoints);
      
      if (closestPoint) {
        const timeDifference = closestPoint.cumulativeTime - cumulativePlannedTime;
        const legDuration = closestPoint.cumulativeTime - previousActualTime;
        const actualPace = legDistance > 0 ? legDuration / legDistance : 0; // seconds per mile
        
        // Calculate planned pace for this leg
        const legPlannedTime = i === 0 ? cumulativePlannedTime : 
          (cumulativePlannedTime - (comparisons[i-1]?.plannedCumulativeTime || 0));
        const plannedPace = legDistance > 0 ? legPlannedTime / legDistance : 0;

        comparisons.push({
          waypoint,
          plannedCumulativeTime: cumulativePlannedTime,
          actualCumulativeTime: closestPoint.cumulativeTime,
          timeDifference,
          legDuration,
          legDistance,
          actualPace,
          plannedPace
        });

        previousActualTime = closestPoint.cumulativeTime;
      } else {
        comparisons.push({
          waypoint,
          plannedCumulativeTime: cumulativePlannedTime,
        });
      }
    }

    setWaypointComparisons(comparisons);
  };

  const handleSaveAnalysis = async () => {
    console.log('handleSaveAnalysis called');
    console.log('saveAnalysisName:', saveAnalysisName);
    console.log('currentRoute:', currentRoute);
    console.log('raceTrackPoints.length:', raceTrackPoints.length);
    console.log('waypointComparisons.length:', waypointComparisons.length);
    
    if (!saveAnalysisName.trim()) {
      console.log('No analysis name provided');
      addToast({
        type: 'error',
        message: 'Please enter a name for this race analysis'
      });
      return;
    }

    if (!currentRoute || !currentRouteId || raceTrackPoints.length === 0 || waypointComparisons.length === 0) {
      console.log('Missing required data for save');
      console.log('currentRoute:', !!currentRoute);
      console.log('currentRouteId:', currentRouteId);
      console.log('raceTrackPoints.length:', raceTrackPoints.length);
      console.log('waypointComparisons.length:', waypointComparisons.length);
      addToast({
        type: 'error',
        message: 'No analysis data to save'
      });
      return;
    }

    console.log('Starting save process...');
    setIsSaving(true);

    try {
      // Prepare track points data
      const trackPoints = raceTrackPoints.map((point, index) => ({
        lat: point.lat,
        lon: point.lon,
        elevation: point.elevation,
        cumulativeTime: Math.round(point.cumulativeTime),
        cumulativeDistance: point.cumulativeDistance,
        order: index
      }));

      // Prepare waypoint comparisons data
      const waypointComparisons_API = waypointComparisons.map(comp => ({
        waypointId: comp.waypoint.id,
        plannedCumulativeTime: Math.round(comp.plannedCumulativeTime),
        actualCumulativeTime: comp.actualCumulativeTime ? Math.round(comp.actualCumulativeTime) : undefined,
        timeDifference: comp.timeDifference ? Math.round(comp.timeDifference) : undefined,
        legDuration: comp.legDuration ? Math.round(comp.legDuration) : undefined,
        legDistance: comp.legDistance,
        actualPace: comp.actualPace ? Math.round(comp.actualPace) : undefined,
        plannedPace: comp.plannedPace ? Math.round(comp.plannedPace) : undefined,
        closestPointLat: comp.actualCumulativeTime ? 
          findClosestTrackPoint(comp.waypoint.latitude, comp.waypoint.longitude, raceTrackPoints)?.lat : undefined,
        closestPointLon: comp.actualCumulativeTime ? 
          findClosestTrackPoint(comp.waypoint.latitude, comp.waypoint.longitude, raceTrackPoints)?.lon : undefined
      }));

      const analysisData: RaceAnalysisCreate = {
        routeId: parseInt(currentRouteId),
        raceName: saveAnalysisName.trim(),
        raceDate: raceStartTime ? raceStartTime.toISOString().split('T')[0] : undefined,
        actualGpxFilename: raceFileName,
        totalRaceTimeSeconds: Math.round(raceTotalTime),
        totalActualDistanceMeters: raceTrackPoints[raceTrackPoints.length - 1]?.cumulativeDistance * 1609.34 || 0,
        raceStartTime: raceStartTime?.toISOString(),
        notes: `Analysis of ${raceFileName} vs ${currentRoute.filename}`,
        trackPoints,
        waypointComparisons: waypointComparisons_API
      };

      console.log('About to call API with data:', analysisData);
      const result = await raceAnalysisApi.saveRaceAnalysis(analysisData);
      console.log('API call successful, result:', result);

      addToast({
        type: 'success',
        message: `Race analysis "${saveAnalysisName}" saved successfully!`
      });

      // Refresh saved analyses list
      const analyses = await raceAnalysisApi.getRouteRaceAnalyses(parseInt(currentRouteId));
      setSavedAnalyses(analyses);

      // Reset dialog
      setShowSaveDialog(false);
      setSaveAnalysisName('');

    } catch (error) {
      console.error('Error saving race analysis:', error);
      addToast({
        type: 'error',
        message: `Failed to save race analysis: ${handleApiError(error)}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadAnalysis = async (analysisId: number) => {
    try {
      console.log(`Loading analysis ${analysisId}...`);
      setLoadingAnalysisId(analysisId);
      
      // Get the detailed analysis data
      const analysisDetail = await raceAnalysisApi.getRaceAnalysisDetail(analysisId);
      console.log('Analysis detail received:', analysisDetail);
      
      // Convert the analysis data back to the expected format
      const convertedTrackPoints: RaceTrackPoint[] = analysisDetail.trackPointsData.map(point => ({
        lat: point.lat,
        lon: point.lon,
        elevation: point.elevation,
        time: new Date(0), // We'll calculate this from cumulativeTime
        cumulativeDistance: point.cumulativeDistance * 0.000621371, // Convert meters to miles
        cumulativeTime: point.cumulativeTime
      }));

      const convertedComparisons: WaypointComparison[] = analysisDetail.comparisonData.map(comp => ({
        waypoint: {
          id: comp.waypointId,
          name: comp.waypointName,
          waypoint_type: comp.waypointType
        },
        plannedCumulativeTime: comp.plannedCumulativeTime,
        actualCumulativeTime: comp.actualCumulativeTime,
        timeDifference: comp.timeDifference,
        legDuration: comp.legDuration,
        legDistance: comp.legDistance,
        actualPace: comp.actualPace,
        plannedPace: comp.plannedPace
      }));

      // Set the analysis data
      console.log('Setting track points:', convertedTrackPoints.length);
      console.log('Setting waypoint comparisons:', convertedComparisons.length);
      setRaceTrackPoints(convertedTrackPoints);
      setWaypointComparisons(convertedComparisons);
      setRaceFileName(analysisDetail.actualGpxFilename);
      setRaceTotalTime(analysisDetail.totalRaceTimeSeconds);
      
      // Calculate race start time from the data
      if (convertedTrackPoints.length > 0) {
        const startTime = new Date(Date.now() - (analysisDetail.totalRaceTimeSeconds * 1000));
        setRaceStartTime(startTime);
        console.log('Set race start time:', startTime);
      }

      addToast({
        type: 'success',
        message: `Race analysis "${analysisDetail.raceName}" loaded successfully!`
      });

    } catch (error) {
      console.error('Error loading race analysis:', error);
      addToast({
        type: 'error',
        message: `Failed to load race analysis: ${handleApiError(error)}`
      });
    } finally {
      setLoadingAnalysisId(null);
    }
  };

  const handleDeleteAnalysis = async (analysisId: number, analysisName: string) => {
    setAnalysisToDelete({ id: analysisId, name: analysisName });
    setShowDeleteDialog(true);
  };

  const confirmDeleteAnalysis = async () => {
    if (!analysisToDelete) return;

    try {
      setDeletingAnalysisId(analysisToDelete.id);
      setShowDeleteDialog(false);
      
      await raceAnalysisApi.deleteRaceAnalysis(analysisToDelete.id);
      
      // Refresh the saved analyses list
      if (currentRouteId) {
        const analyses = await raceAnalysisApi.getRouteRaceAnalyses(parseInt(currentRouteId));
        setSavedAnalyses(analyses);
      }

      addToast({
        type: 'success',
        message: `Race analysis "${analysisToDelete.name}" deleted successfully!`
      });

    } catch (error) {
      console.error('Error deleting race analysis:', error);
      addToast({
        type: 'error',
        message: `Failed to delete race analysis: ${handleApiError(error)}`
      });
    } finally {
      setDeletingAnalysisId(null);
      setAnalysisToDelete(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!hasPlannedRoute) {
      addToast({
        type: 'error',
        message: 'Please load a planned route first before uploading race data'
      });
      return;
    }

    setIsUploading(true);
    setRaceFileName(file.name);

    try {
      const fileContent = await file.text();
      const trackPoints = parseGpxFile(fileContent, file.name);
      
      setRaceTrackPoints(trackPoints);
      setRaceStartTime(trackPoints[0]?.time || null);
      setRaceTotalTime(trackPoints[trackPoints.length - 1]?.cumulativeTime || 0);
      
      // Analyze performance
      analyzeRacePerformance(trackPoints);
      
      addToast({
        type: 'success',
        message: `Race GPX processed: ${trackPoints.length} points (sampled from ${Math.round(trackPoints.length * 20)} original points)`
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: `Failed to process GPX file: ${handleApiError(error)}`
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` 
                     : `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (secondsPerMile: number): string => {
    const minutes = Math.floor(secondsPerMile / 60);
    const seconds = Math.floor(secondsPerMile % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!hasPlannedRoute) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Race Analysis</h2>
          <p className="text-gray-600 mb-4">
            Load a planned route first to compare with your actual race performance
          </p>
          <p className="text-sm text-gray-500">
            Go to the Analyzer tab and load a saved route with waypoints
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Race Analysis</h1>
        <p className="text-gray-600">
          Compare your actual race performance against your planned route
        </p>
      </div>

      {/* Current Route Info */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">Planned Route</h3>
        <p className="text-blue-700">Route: {currentRoute?.filename}</p>
        <p className="text-blue-700">Waypoints: {routeWaypoints.length}</p>
        <p className="text-blue-700">Distance: {((currentRoute?.totalDistance || 0) * 0.000621371).toFixed(1)} miles</p>
      </div>

      {/* Upload Race GPX */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Upload className="h-5 w-5 mr-2" />
          Upload Race GPX
        </h3>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <input
            type="file"
            accept=".gpx"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
            id="race-gpx-upload"
          />
          <label
            htmlFor="race-gpx-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload className="h-12 w-12 text-gray-400 mb-4" />
            <span className="text-lg font-medium text-gray-900 mb-2">
              {isUploading ? 'Processing...' : 'Upload Race GPX File'}
            </span>
            <span className="text-gray-500">
              GPX files from watches/GPS devices (will be sampled to 1/20th of original points)
            </span>
          </label>
        </div>
      </div>

      {/* Race Summary */}
      {raceTrackPoints.length > 0 && (
        <div className="bg-green-50 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-green-800">Race Summary</h3>
            <div className="flex gap-2">
              {waypointComparisons.length > 0 && (
                <button
                  onClick={() => setShowSaveDialog(true)}
                  disabled={isSaving}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isSaving ? 'Saving...' : 'Save Analysis'}
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-green-700">File: {raceFileName}</p>
            </div>
            <div>
              <p className="text-green-700">Start: {raceStartTime?.toLocaleTimeString()}</p>
            </div>
            <div>
              <p className="text-green-700">Total Time: {formatTime(raceTotalTime)}</p>
            </div>
            <div>
              <p className="text-green-700">Data Points: {raceTrackPoints.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* Saved Analyses */}
      {savedAnalyses.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h3 className="font-semibold text-blue-800 mb-2">Saved Race Analyses</h3>
          <div className="grid gap-2">
            {savedAnalyses.map((analysis) => (
              <div key={analysis.id} className="bg-white p-3 rounded border border-blue-200 flex justify-between items-center">
                <div className="flex-1">
                  <p className="font-medium text-blue-900">{analysis.raceName}</p>
                  <p className="text-sm text-blue-700">
                    {analysis.raceDate && new Date(analysis.raceDate).toLocaleDateString()} - 
                    {formatTime(analysis.totalRaceTimeSeconds)} - 
                    {(analysis.totalActualDistanceMeters * 0.000621371).toFixed(1)} miles
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    {analysis.waypointCount} waypoints • Created {new Date(analysis.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleLoadAnalysis(analysis.id)}
                    disabled={loadingAnalysisId === analysis.id || deletingAnalysisId === analysis.id}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingAnalysisId === analysis.id ? 'Loading...' : 'Load'}
                  </button>
                  <button
                    onClick={() => handleDeleteAnalysis(analysis.id, analysis.raceName)}
                    disabled={deletingAnalysisId === analysis.id || loadingAnalysisId === analysis.id}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingAnalysisId === analysis.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Save Race Analysis</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Name
              </label>
              <input
                type="text"
                value={saveAnalysisName}
                onChange={(e) => setSaveAnalysisName(e.target.value)}
                placeholder="e.g., Boston Marathon 2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveAnalysisName('');
                }}
                disabled={isSaving}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAnalysis}
                disabled={isSaving || !saveAnalysisName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && analysisToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Delete Race Analysis</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete the race analysis <strong>"{analysisToDelete.name}"</strong>? 
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setAnalysisToDelete(null);
                }}
                disabled={deletingAnalysisId !== null}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAnalysis}
                disabled={deletingAnalysisId !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingAnalysisId === analysisToDelete.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Table */}
      {waypointComparisons.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Performance Comparison
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Waypoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Planned Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actual Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Difference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Leg Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Planned Pace
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actual Pace
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {waypointComparisons.map((comparison, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {comparison.waypoint.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {comparison.waypoint.waypoint_type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(comparison.plannedCumulativeTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {comparison.actualCumulativeTime ? formatTime(comparison.actualCumulativeTime) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {comparison.timeDifference !== undefined ? (
                        <span className={comparison.timeDifference < 0 ? 'text-green-600' : 'text-red-600'}>
                          {comparison.timeDifference < 0 ? '-' : '+'}
                          {formatTime(Math.abs(comparison.timeDifference))}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {comparison.legDuration ? formatTime(comparison.legDuration) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {comparison.plannedPace ? formatPace(comparison.plannedPace) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {comparison.actualPace ? (
                        <span className={
                          comparison.plannedPace && comparison.actualPace > comparison.plannedPace ? 
                          'text-red-600' : 'text-green-600'
                        }>
                          {formatPace(comparison.actualPace)}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
} 