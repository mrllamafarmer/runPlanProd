import React, { useState } from 'react';
import { TrackPoint, Waypoint } from '../types';
import MapVisualization from './MapVisualization';
import ElevationChart from './ElevationChart';

interface RouteVisualizationProps {
  trackPoints: TrackPoint[];
  waypoints?: Waypoint[];
}

export default function RouteVisualization({ trackPoints, waypoints = [] }: RouteVisualizationProps) {
  const [activeTab, setActiveTab] = useState<'map' | 'elevation'>('map');

  if (trackPoints.length === 0) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg border border-gray-200">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Route Visualization</h3>
          <p className="text-gray-500">Upload a GPX file to see the route visualization</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('map')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'map'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📍 Route Map
          </button>
          <button
            onClick={() => setActiveTab('elevation')}
            className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'elevation'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📈 Elevation Profile
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'map' && (
          <MapVisualization 
            trackPoints={trackPoints} 
            waypoints={waypoints}
            height="500px"
          />
        )}
        
        {activeTab === 'elevation' && (
          <ElevationChart 
            trackPoints={trackPoints} 
            waypoints={waypoints}
            height="400px"
          />
        )}
      </div>

      {/* Route Statistics */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-semibold text-gray-800 mb-2">Route Statistics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Track Points:</span>
            <div className="font-medium">{trackPoints.length.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-gray-600">Waypoints:</span>
            <div className="font-medium">{waypoints.length}</div>
          </div>
          {trackPoints.length > 0 && trackPoints[0].elevation !== undefined && (
            <>
              <div>
                <span className="text-gray-600">Min Elevation:</span>
                <div className="font-medium">
                  {Math.min(...trackPoints.filter(p => p.elevation !== undefined).map(p => p.elevation!)).toFixed(0)} ft
                </div>
              </div>
              <div>
                <span className="text-gray-600">Max Elevation:</span>
                <div className="font-medium">
                  {Math.max(...trackPoints.filter(p => p.elevation !== undefined).map(p => p.elevation!)).toFixed(0)} ft
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 