import React, { useState } from 'react';
import { Edit3, Trash2, MapPin, Navigation, Clock, Mountain, ChevronUp, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { routeApi, handleApiError } from '../services/api';
import { WaypointDB } from '../types';
import { secondsToMMSS, mmssToSeconds, isValidMMSS, formatRestTime } from '../utils/timeUtils';
import { calculateWaypointDistances } from '../utils/timeUtils';

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
  const [editForm, setEditForm] = useState<Partial<WaypointDB & { rest_time_mmss: string }>>({});
  const [deletingWaypoint, setDeletingWaypoint] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleEditWaypoint = (waypoint: WaypointDB) => {
    setEditingWaypoint(waypoint.id);
    setEditForm({
      ...waypoint,
      rest_time_mmss: secondsToMMSS(waypoint.rest_time_seconds || 0)
    });
    setErrors({});
  };

  const handleSaveEdit = async () => {
    if (!editingWaypoint || !currentRouteId) return;
    
    // Validate rest time format if provided
    if (editForm.rest_time_mmss && !isValidMMSS(editForm.rest_time_mmss)) {
      setErrors({ rest_time: 'Please enter time in MM:SS format (e.g., 15:30)' });
      return;
    }
    
    try {
      const updateData = {
        name: editForm.name,
        description: editForm.description,
        waypoint_type: editForm.waypoint_type,
        rest_time_seconds: editForm.rest_time_mmss ? mmssToSeconds(editForm.rest_time_mmss) : 0
      };
      
      await routeApi.updateWaypoint(editingWaypoint.toString(), updateData);
      
      updateRouteWaypoint(editingWaypoint, updateData);
      
      setEditingWaypoint(null);
      setEditForm({});
      setErrors({});
      
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
        message: `Failed to update waypoint order: ${handleApiError(error)}`
      });
    }
  };

  // Calculate distances for display
  const waypointsWithDistances = calculateWaypointDistances(routeWaypoints, trackPoints);

  const formatDistance = (miles: number) => {
    return miles.toFixed(2);
  };

  const getWaypointTypeIcon = (type: string) => {
    const iconClass = "h-4 w-4";
    switch (type) {
      case 'start':
        return <MapPin className={`${iconClass} text-green-600`} />;
      case 'finish':
        return <Navigation className={`${iconClass} text-red-600`} />;
      case 'checkpoint':
        return <Clock className={`${iconClass} text-blue-600`} />;
      case 'poi':
        return <Mountain className={`${iconClass} text-orange-600`} />;
      default:
        return <MapPin className={`${iconClass} text-gray-600`} />;
    }
  };

  if (!trackPoints || trackPoints.length === 0) {
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
                Rest Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Elevation Gain/Loss
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
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Waypoint name"
                      />
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="Description (optional)"
                        rows={2}
                      />
                    </div>
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
                    <div>
                      <input
                        type="text"
                        placeholder="MM:SS"
                        value={editForm.rest_time_mmss || ''}
                        onChange={(e) => {
                          setEditForm({ ...editForm, rest_time_mmss: e.target.value });
                          if (errors.rest_time) {
                            setErrors({ ...errors, rest_time: '' });
                          }
                        }}
                        className={`w-20 px-2 py-1 border rounded text-sm ${
                          errors.rest_time ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {errors.rest_time && (
                        <div className="text-xs text-red-600 mt-1">{errors.rest_time}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm">
                      {waypoint.rest_time_seconds ? formatRestTime(waypoint.rest_time_seconds) : 'No rest'}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                  {waypoint.elevationGainLossDisplay || (index === 0 ? 'Start' : 'N/A')}
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
                          setErrors({});
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
            <span>Total Route Distance: {formatDistance((currentRoute?.totalDistance || 0) / 1609.34)} miles</span>
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