import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { TrackPoint, Waypoint } from '../types';

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

  useEffect(() => {
    if (!mapRef.current || trackPoints.length === 0) return;

    console.log('MapVisualization - waypoints received:', waypoints);
    
    // Debug alert to see if this code is running at all
    if (waypoints && waypoints.length > 0) {
      alert(`DEBUG: Received ${waypoints.length} waypoints. First waypoint: ${JSON.stringify(waypoints[0])}`);
    }

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

    // Add waypoint markers with bulletproof error handling
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
    
    console.log('Waypoint markers created successfully!');

    // Fit map to route bounds
    if (routeCoordinates.length > 0) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [trackPoints, waypoints]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Route Map</h3>
      </div>
      <div 
        ref={mapRef} 
        style={{ height }}
        className="w-full"
      />
    </div>
  );
} 