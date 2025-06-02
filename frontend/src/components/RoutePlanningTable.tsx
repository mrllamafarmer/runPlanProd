import React, { useState } from 'react';
import { Edit3, Trash2, MapPin, Navigation, Clock, Mountain, ChevronUp, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { routeApi, handleApiError } from '../services/api';
import { WaypointDB } from '../types';

interface RoutePlanningTableProps {
  trackPoints: any[];
}

export default function RoutePlanningTable({ trackPoints }: RoutePlanningTableProps) {
  const { 
    routeWaypoints, 
    currentRouteId, 
    updateRouteWaypoint, 
    removeRouteWaypoint, 
    addToast,
    currentRoute
  } = useAppStore();

  const [editingWaypoint, setEditingWaypoint] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<WaypointDB>>({});
  const [deletingWaypoint, setDeletingWaypoint] = useState<number | null>(null);

  // Calculate distances between waypoints along the actual route track
  const calculateWaypointDistances = () => {
    if (routeWaypoints.length === 0 || trackPoints.length === 0) return [];
    
    const sortedWaypoints = [...routeWaypoints].sort((a, b) => a.order_index - b.order_index);
    const waypointDistances = [];
    
    for (let i = 0; i < sortedWaypoints.length; i++) {
      const waypoint = sortedWaypoints[i];
      let legDistance = 0;
      let cumulativeDistance = 0;
      
      if (i > 0) {
        const prevWaypoint = sortedWaypoints[i - 1];
        
        // Find closest track points to each waypoint
        const prevTrackPointIndex = findClosestTrackPoint(prevWaypoint.latitude, prevWaypoint.longitude);
        const currTrackPointIndex = findClosestTrackPoint(waypoint.latitude, waypoint.longitude);
        
        // Calculate distance along track points between waypoints
        legDistance = calculateTrackDistanceBetweenPoints(prevTrackPointIndex, currTrackPointIndex);
        cumulativeDistance = waypointDistances[i - 1].cumulativeDistance + legDistance;
      }
      
      waypointDistances.push({
        ...waypoint,
        legDistance,
        cumulativeDistance
      });
    }
    
    return waypointDistances;
  };

  // Find the closest track point to a given lat/lon
  const findClosestTrackPoint = (targetLat: number, targetLon: number) => {
    let closestIndex = 0;
    let minDistance = Number.MAX_VALUE;
    
    for (let i = 0; i < trackPoints.length; i++) {
      const point = trackPoints[i];
      const distance = calculateHaversineDistance(
        targetLat, targetLon,
        point.lat, point.lon
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    
    return closestIndex;
  };

  // Calculate distance along track points between two indices
  const calculateTrackDistanceBetweenPoints = (startIndex: number, endIndex: number) => {
    if (startIndex === endIndex) return 0;
    
    // Ensure we're going in the right direction
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    
    let totalDistance = 0;
    for (let i = start; i < end; i++) {
      const currentPoint = trackPoints[i];
      const nextPoint = trackPoints[i + 1];
      
      totalDistance += calculateHaversineDistance(
        currentPoint.lat, currentPoint.lon,
        nextPoint.lat, nextPoint.lon
      );
    }
    
    return totalDistance;
  };

  // Haversine distance calculation in kilometers
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const toRadians = (degrees: number) => degrees * (Math.PI / 180);

  const handleEditWaypoint = (waypoint: WaypointDB) => {
    setEditingWaypoint(waypoint.id);
    setEditForm(waypoint);
  };

  const handleSaveEdit = async () => {
    if (!editingWaypoint || !currentRouteId) return;
    
    try {
      const updateData = {
        name: editForm.name,
        description: editForm.description,
        waypoint_type: editForm.waypoint_type,
        target_pace_per_km_seconds: editForm.target_pace_per_km_seconds
      };
      
      await routeApi.updateWaypoint(editingWaypoint.toString(), updateData);
      
      updateRouteWaypoint(editingWaypoint, updateData);
      
      setEditingWaypoint(null);
      setEditForm({});
      
      addToast({
        type: 'success',
        message: 'Waypoint updated successfully'
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: `Failed to update waypoint: ${handleApiError(error)}`
      });
    }
  };

  const handleDeleteWaypoint = async (waypointId: number, waypointName: string) => {
    if (!window.confirm(`Delete waypoint "${waypointName}"?`)) return;
    
    setDeletingWaypoint(waypointId);
    
    try {
      await routeApi.deleteWaypoint(waypointId.toString());
      removeRouteWaypoint(waypointId);
      
      addToast({
        type: 'success',
        message: 'Waypoint deleted successfully'
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: `Failed to delete waypoint: ${handleApiError(error)}`
      });
    } finally {
      setDeletingWaypoint(null);
    }
  };

  const handleMoveWaypoint = async (waypointId: number, direction: 'up' | 'down') => {
    const sortedWaypoints = [...routeWaypoints].sort((a, b) => a.order_index - b.order_index);
    const currentIndex = sortedWaypoints.findIndex(wp => wp.id === waypointId);
    
    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sortedWaypoints.length - 1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const currentWaypoint = sortedWaypoints[currentIndex];
    const swapWaypoint = sortedWaypoints[newIndex];
    
    try {
      // Swap order indices
      await Promise.all([
        routeApi.updateWaypoint(currentWaypoint.id.toString(), { order_index: swapWaypoint.order_index }),
        routeApi.updateWaypoint(swapWaypoint.id.toString(), { order_index: currentWaypoint.order_index })
      ]);
      
      // Update local state
      updateRouteWaypoint(currentWaypoint.id, { order_index: swapWaypoint.order_index });
      updateRouteWaypoint(swapWaypoint.id, { order_index: currentWaypoint.order_index });
      
      addToast({
        type: 'success',
        message: 'Waypoint order updated'
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: `Failed to reorder waypoint: ${handleApiError(error)}`
      });
    }
  };

  const formatDistance = (km: number) => {
    const miles = km * 0.621371;
    return miles.toFixed(2);
  };

  const formatPace = (secondsPerKm?: number) => {
    if (!secondsPerKm) return 'N/A';
    const minutes = Math.floor(secondsPerKm / 60);
    const seconds = secondsPerKm % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  const getWaypointTypeIcon = (type: string) => {
    switch (type) {
      case 'start': return <Navigation className="h-4 w-4 text-green-500" />;
      case 'finish': return <MapPin className="h-4 w-4 text-red-500" />;
      case 'checkpoint': return <MapPin className="h-4 w-4 text-blue-500" />;
      case 'poi': return <Mountain className="h-4 w-4 text-orange-500" />;
      default: return <MapPin className="h-4 w-4 text-gray-500" />;
    }
  };

  const waypointsWithDistances = calculateWaypointDistances();

  if (!currentRouteId) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold text-gray-800">Route Planning Table</h3>
        <p className="text-gray-600">Load a route to see waypoint details</p>
      </div>
    );
  }

  if (routeWaypoints.length === 0) {
    return (
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold text-blue-800">Route Planning Table</h3>
        <p className="text-blue-600">No waypoints yet. Use the "Add Waypoints" button on the map to create waypoints.</p>
        <p className="text-blue-600 text-sm mt-1">Track points: {trackPoints.length}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Route Planning Table</h3>
        <p className="text-sm text-gray-600">{waypointsWithDistances.length} waypoints • {trackPoints.length} track points</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Waypoint
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Leg Distance
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cumulative
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Target Pace
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Elevation
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {waypointsWithDistances.map((waypoint, index) => (
              <tr key={waypoint.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {index + 1}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {editingWaypoint === waypoint.id ? (
                    <input
                      type="text"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    <div>
                      <div className="text-sm font-medium text-gray-900">{waypoint.name}</div>
                      {waypoint.description && (
                        <div className="text-sm text-gray-500">{waypoint.description}</div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {editingWaypoint === waypoint.id ? (
                    <select
                      value={editForm.waypoint_type || waypoint.waypoint_type}
                      onChange={(e) => setEditForm({ ...editForm, waypoint_type: e.target.value as any })}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="start">Start</option>
                      <option value="checkpoint">Checkpoint</option>
                      <option value="finish">Finish</option>
                      <option value="poi">POI</option>
                    </select>
                  ) : (
                    <div className="flex items-center">
                      {getWaypointTypeIcon(waypoint.waypoint_type)}
                      <span className="ml-2 text-sm text-gray-900 capitalize">
                        {waypoint.waypoint_type}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {index === 0 ? 'Start' : `${formatDistance(waypoint.legDistance)} mi`}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDistance(waypoint.cumulativeDistance)} mi
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingWaypoint === waypoint.id ? (
                    <input
                      type="number"
                      placeholder="sec/km"
                      value={editForm.target_pace_per_km_seconds || ''}
                      onChange={(e) => setEditForm({ ...editForm, target_pace_per_km_seconds: parseInt(e.target.value) || undefined })}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  ) : (
                    formatPace(waypoint.target_pace_per_km_seconds)
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {waypoint.elevation_meters ? `${Math.round(waypoint.elevation_meters * 3.28084)} ft` : 'N/A'}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                  {editingWaypoint === waypoint.id ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSaveEdit}
                        className="text-green-600 hover:text-green-900 text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingWaypoint(null);
                          setEditForm({});
                        }}
                        className="text-gray-600 hover:text-gray-900 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleMoveWaypoint(waypoint.id, 'up')}
                        disabled={index === 0}
                        className="text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleMoveWaypoint(waypoint.id, 'down')}
                        disabled={index === waypointsWithDistances.length - 1}
                        className="text-gray-500 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEditWaypoint(waypoint)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit waypoint"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteWaypoint(waypoint.id, waypoint.name)}
                        disabled={deletingWaypoint === waypoint.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Delete waypoint"
                      >
                        {deletingWaypoint === waypoint.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div>
            <span>Total Route Distance: {formatDistance((currentRoute?.totalDistance || 0) / 1000)} miles</span>
            <span className="ml-4 text-xs text-gray-500">(from track points)</span>
          </div>
          <div>
            <span>Waypoints: {waypointsWithDistances.length}</span>
            <div className="text-xs text-gray-500 mt-1">
              Leg distances show actual route distances along the track
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 