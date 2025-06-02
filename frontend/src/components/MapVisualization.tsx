import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TrackPoint, Waypoint, WaypointDB } from '../types';
import { useAppStore } from '../store/useAppStore';
import { routeApi, handleApiError } from '../services/api';

// Fix for default markers in webpack builds
// This approach avoids importing image files directly
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapVisualizationProps {
  trackPoints: TrackPoint[];
  waypoints?: Waypoint[];
  height?: string;
}

export default function MapVisualization({ 
  trackPoints, 
  waypoints = [], 
  height = '400px' 
}: MapVisualizationProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  
  // Enhanced waypoint state from store
  const { 
    currentRouteId, 
    routeWaypoints, 
    isWaypointCreationMode, 
    setWaypointCreationMode,
    addRouteWaypoint,
    updateRouteWaypoint,
    removeRouteWaypoint,
    addToast,
    setRouteWaypoints
  } = useAppStore();

  const [isCreatingWaypoint, setIsCreatingWaypoint] = useState(false);

  // Handle map click for waypoint creation
  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    if (!isWaypointCreationMode || !currentRouteId || isCreatingWaypoint) return;
    
    setIsCreatingWaypoint(true);
    
    try {
      const { lat, lng } = e.latlng;
      
      // Calculate the proper order index based on position along the route
      const insertPosition = calculateInsertPosition(lat, lng, routeWaypoints);
      
      // Update order indices of existing waypoints that come after this position
      const updatedWaypoints = routeWaypoints.map(wp => 
        wp.order_index >= insertPosition 
          ? { ...wp, order_index: wp.order_index + 1 }
          : wp
      );
      
      // Create waypoint data
      const waypointData = {
        name: `Waypoint ${routeWaypoints.length + 1}`,
        latitude: lat,
        longitude: lng,
        order_index: insertPosition,
        waypoint_type: 'checkpoint' as const
      };
      
      // Call API to create waypoint
      const result = await routeApi.createWaypoint(currentRouteId, waypointData);
      
      // Update order indices of existing waypoints in the backend
      for (const wp of updatedWaypoints) {
        if (wp.order_index !== routeWaypoints.find(orig => orig.id === wp.id)?.order_index) {
          await routeApi.updateWaypoint(wp.id.toString(), { order_index: wp.order_index });
        }
      }
      
      // Add to local state with the returned ID
      const newWaypoint: WaypointDB = {
        id: result.waypoint_id,
        route_id: parseInt(currentRouteId),
        ...waypointData,
        created_at: new Date().toISOString()
      };
      
      // Update all waypoints in store
      setRouteWaypoints([...updatedWaypoints, newWaypoint]);
      
      addToast({
        type: 'success',
        message: 'Waypoint created successfully'
      });
      
    } catch (error) {
      console.error('Error creating waypoint:', error);
      addToast({
        type: 'error',
        message: `Failed to create waypoint: ${handleApiError(error)}`
      });
    } finally {
      setIsCreatingWaypoint(false);
    }
  };

  // Calculate where to insert the new waypoint based on distance from start
  const calculateInsertPosition = (lat: number, lng: number, waypoints: WaypointDB[]): number => {
    if (waypoints.length === 0) return 0;
    
    // Sort existing waypoints by order_index
    const sortedWaypoints = [...waypoints].sort((a, b) => a.order_index - b.order_index);
    
    // If only one waypoint, decide based on distance to that waypoint
    if (sortedWaypoints.length === 1) {
      const distanceToExisting = calculateHaversineDistance(
        lat, lng, 
        sortedWaypoints[0].latitude, sortedWaypoints[0].longitude
      );
      
      // If the existing waypoint is a start type, put new waypoint after it
      // If it's a finish type, put new waypoint before it
      if (sortedWaypoints[0].waypoint_type === 'start') {
        return sortedWaypoints[0].order_index + 1;
      } else {
        return sortedWaypoints[0].order_index;
      }
    }
    
    // For multiple waypoints, find the best insertion point
    let bestPosition = 0;
    let minTotalDistance = Infinity;
    
    // Try inserting at each position and calculate total distance increase
    for (let i = 0; i <= sortedWaypoints.length; i++) {
      let totalDistance = 0;
      
      if (i === 0) {
        // Insert at beginning
        if (sortedWaypoints.length > 0) {
          totalDistance = calculateHaversineDistance(lat, lng, sortedWaypoints[0].latitude, sortedWaypoints[0].longitude);
        }
      } else if (i === sortedWaypoints.length) {
        // Insert at end
        const lastWaypoint = sortedWaypoints[sortedWaypoints.length - 1];
        totalDistance = calculateHaversineDistance(lastWaypoint.latitude, lastWaypoint.longitude, lat, lng);
      } else {
        // Insert between waypoints
        const prevWaypoint = sortedWaypoints[i - 1];
        const nextWaypoint = sortedWaypoints[i];
        
        const distToPrev = calculateHaversineDistance(prevWaypoint.latitude, prevWaypoint.longitude, lat, lng);
        const distToNext = calculateHaversineDistance(lat, lng, nextWaypoint.latitude, nextWaypoint.longitude);
        const originalDist = calculateHaversineDistance(prevWaypoint.latitude, prevWaypoint.longitude, nextWaypoint.latitude, nextWaypoint.longitude);
        
        totalDistance = distToPrev + distToNext - originalDist; // Net distance added
      }
      
      if (totalDistance < minTotalDistance) {
        minTotalDistance = totalDistance;
        bestPosition = i;
      }
    }
    
    // Convert position to order_index
    if (bestPosition === 0) {
      return sortedWaypoints.length > 0 ? sortedWaypoints[0].order_index : 0;
    } else if (bestPosition >= sortedWaypoints.length) {
      return sortedWaypoints.length > 0 ? sortedWaypoints[sortedWaypoints.length - 1].order_index + 1 : 0;
    } else {
      return sortedWaypoints[bestPosition].order_index;
    }
  };

  // Haversine distance calculation (moved from RoutePlanningTable for reuse)
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

  useEffect(() => {
    if (!mapRef.current || trackPoints.length === 0) return;

    // Initialize map if it doesn't exist
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        touchZoom: true
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Clear existing route layer
    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
    }

    // Create new layer group for route elements
    routeLayerRef.current = L.layerGroup().addTo(map);

    // Convert track points to LatLng array
    const routeCoordinates: L.LatLngExpression[] = trackPoints.map(point => [point.lat, point.lon]);

    // Add route polyline
    const routeLine = L.polyline(routeCoordinates, {
      color: '#2563eb',
      weight: 3,
      opacity: 0.8
    });
    routeLayerRef.current.addLayer(routeLine);

    // Create custom icons for different marker types
    const startIcon = L.divIcon({
      className: 'custom-marker start-marker',
      html: '<div style="background-color: #10B981; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">S</div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const endIcon = L.divIcon({
      className: 'custom-marker end-marker',
      html: '<div style="background-color: #EF4444; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">E</div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const waypointIcon = L.divIcon({
      className: 'custom-marker waypoint-marker',
      html: '<div style="background-color: #3B82F6; color: white; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">W</div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });

    // Enhanced waypoint icons
    const getWaypointIcon = (type: 'start' | 'finish' | 'checkpoint' | 'poi') => {
      const colors: Record<'start' | 'finish' | 'checkpoint' | 'poi', string> = {
        start: '#10B981',
        finish: '#EF4444', 
        checkpoint: '#3B82F6',
        poi: '#F59E0B'
      };
      const labels: Record<'start' | 'finish' | 'checkpoint' | 'poi', string> = {
        start: 'S',
        finish: 'F',
        checkpoint: 'C',
        poi: 'P'
      };
      
      return L.divIcon({
        className: `custom-marker ${type}-marker`,
        html: `<div style="background-color: ${colors[type]}; color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${labels[type]}</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
    };

    // Add start marker
    if (trackPoints.length > 0) {
      const startPoint = trackPoints[0];
      if (startPoint && typeof startPoint.lat === 'number' && typeof startPoint.lon === 'number') {
        const startMarker = L.marker([startPoint.lat, startPoint.lon], { icon: startIcon })
          .bindPopup('<strong>Start</strong>');
        routeLayerRef.current.addLayer(startMarker);
      } else {
        console.warn('Invalid start point coordinates:', startPoint);
      }
    }

    // Add end marker
    if (trackPoints.length > 1) {
      const endPoint = trackPoints[trackPoints.length - 1];
      if (endPoint && typeof endPoint.lat === 'number' && typeof endPoint.lon === 'number') {
        const endMarker = L.marker([endPoint.lat, endPoint.lon], { icon: endIcon })
          .bindPopup('<strong>End</strong>');
        routeLayerRef.current.addLayer(endMarker);
      } else {
        console.warn('Invalid end point coordinates:', endPoint);
      }
    }

    // Add legacy waypoint markers with bulletproof error handling
    if (waypoints && Array.isArray(waypoints)) {
      waypoints.forEach((waypoint, index) => {
        try {
          // Comprehensive validation
          if (!waypoint) {
            console.warn(`Waypoint ${index} is null/undefined`);
            return;
          }
          
          const lat = Number(waypoint.latitude);
          const lon = Number(waypoint.longitude);
          
          if (!isFinite(lat) || !isFinite(lon)) {
            console.warn(`Waypoint ${index} has invalid coordinates:`, { lat, lon, waypoint });
            return;
          }
          
          if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
            console.warn(`Waypoint ${index} coordinates out of valid range:`, { lat, lon });
            return;
          }
          
          // Create marker with validated coordinates
          const waypointMarker = L.marker([lat, lon], { icon: waypointIcon })
            .bindPopup(
              `<div class="waypoint-popup">
                <strong>Waypoint ${index + 1}</strong><br/>
                ${waypoint.legName || `Leg ${waypoint.legNumber || index}`}<br/>
                Distance: ${Number(waypoint.distanceMiles || 0).toFixed(2)} mi<br/>
                Elevation: ${Number(waypoint.elevation || 0).toFixed(0)} ft
                ${waypoint.notes ? `<br/>Notes: ${waypoint.notes}` : ''}
              </div>`
            );
          
          if (routeLayerRef.current) {
            routeLayerRef.current.addLayer(waypointMarker);
          }
          
        } catch (error) {
          console.error(`Error creating waypoint marker ${index}:`, error, waypoint);
        }
      });
    }

    // Add enhanced route waypoints
    if (routeWaypoints && Array.isArray(routeWaypoints)) {
      routeWaypoints.forEach((waypoint) => {
        try {
          const lat = Number(waypoint.latitude);
          const lon = Number(waypoint.longitude);
          
          if (!isFinite(lat) || !isFinite(lon)) {
            console.warn(`Route waypoint ${waypoint.id} has invalid coordinates:`, { lat, lon });
            return;
          }
          
          const waypointMarker = L.marker([lat, lon], { 
            icon: getWaypointIcon(waypoint.waypoint_type),
            draggable: true // Enable dragging for enhanced waypoints
          })
          .bindPopup(
            `<div class="enhanced-waypoint-popup">
              <strong>${waypoint.name}</strong><br/>
              Type: ${waypoint.waypoint_type}<br/>
              ${waypoint.description ? `Description: ${waypoint.description}<br/>` : ''}
              ${waypoint.elevation_meters ? `Elevation: ${waypoint.elevation_meters.toFixed(0)}m<br/>` : ''}
              <div class="waypoint-actions" style="margin-top: 8px;">
                <button onclick="editWaypoint(${waypoint.id})" style="margin-right: 4px; padding: 2px 6px; font-size: 11px;">Edit</button>
                <button onclick="deleteWaypoint(${waypoint.id})" style="padding: 2px 6px; font-size: 11px; background: #ef4444; color: white;">Delete</button>
              </div>
            </div>`
          );

          // Handle waypoint drag
          waypointMarker.on('dragend', async (e) => {
            const newLatLng = e.target.getLatLng();
            try {
              await routeApi.updateWaypoint(waypoint.id.toString(), {
                latitude: newLatLng.lat,
                longitude: newLatLng.lng
              });
              
              updateRouteWaypoint(waypoint.id, {
                latitude: newLatLng.lat,
                longitude: newLatLng.lng
              });
              
              addToast({
                type: 'success',
                message: 'Waypoint position updated'
              });
            } catch (error) {
              addToast({
                type: 'error',
                message: `Failed to update waypoint: ${handleApiError(error)}`
              });
              // Revert marker position
              waypointMarker.setLatLng([waypoint.latitude, waypoint.longitude]);
            }
          });
          
          if (routeLayerRef.current) {
            routeLayerRef.current.addLayer(waypointMarker);
          }
          
        } catch (error) {
          console.error(`Error creating enhanced waypoint marker ${waypoint.id}:`, error);
        }
      });
    }
    
    console.log('Waypoint markers created successfully!');

    // Add click handler for waypoint creation
    map.off('click', handleMapClick); // Remove existing handler
    if (isWaypointCreationMode) {
      map.on('click', handleMapClick);
      map.getContainer().style.cursor = 'crosshair';
    } else {
      map.getContainer().style.cursor = '';
    }

    // Fit map to route bounds
    if (routeCoordinates.length > 0) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off('click', handleMapClick);
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [trackPoints, waypoints, routeWaypoints, isWaypointCreationMode, currentRouteId, isCreatingWaypoint]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">Route Map</h3>
        {currentRouteId && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWaypointCreationMode(!isWaypointCreationMode)}
              disabled={isCreatingWaypoint}
              className={`px-3 py-1 text-sm font-medium rounded ${
                isWaypointCreationMode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } transition-colors disabled:opacity-50`}
            >
              {isWaypointCreationMode ? 'Exit Creation Mode' : 'Add Waypoints'}
            </button>
            {isWaypointCreationMode && (
              <span className="text-sm text-gray-600">
                Click on map to add waypoints
              </span>
            )}
            {isCreatingWaypoint && (
              <span className="text-sm text-blue-600">
                Creating waypoint...
              </span>
            )}
          </div>
        )}
      </div>
      <div 
        ref={mapRef} 
        style={{ height }}
        className="w-full"
      />
    </div>
  );
} 