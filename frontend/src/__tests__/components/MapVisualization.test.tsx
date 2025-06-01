import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { render, mockTrackPoints, mockWaypoints, checkAccessibility } from '../utils/test-utils';
import MapVisualization from '../../components/MapVisualization';

describe('MapVisualization', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('with no track points', () => {
    it('does not initialize map when no track points', () => {
      render(<MapVisualization trackPoints={[]} />);
      
      // Map container should still be rendered
      expect(screen.getByText('Route Map')).toBeInTheDocument();
      
      // But map should not be initialized (no Leaflet map calls)
      const L = require('leaflet');
      expect(L.map).not.toHaveBeenCalled();
    });

    it('renders map container with proper structure', () => {
      render(<MapVisualization trackPoints={[]} />);
      
      expect(screen.getByText('Route Map')).toBeInTheDocument();
      
      // Check for proper container structure
      const container = screen.getByText('Route Map').closest('.bg-white');
      expect(container).toHaveClass('rounded-lg', 'border', 'border-gray-200', 'overflow-hidden');
    });
  });

  describe('with track points', () => {
    it('initializes Leaflet map', async () => {
      const { container } = render(
        <MapVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />
      );
      
      await waitFor(() => {
        const L = require('leaflet');
        expect(L.map).toHaveBeenCalled();
      });
    });

    it('adds tile layer to map', async () => {
      render(<MapVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      await waitFor(() => {
        const L = require('leaflet');
        expect(L.tileLayer).toHaveBeenCalledWith(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          expect.objectContaining({
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
          })
        );
      });
    });

    it('creates route polyline', async () => {
      render(<MapVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      await waitFor(() => {
        const L = require('leaflet');
        expect(L.polyline).toHaveBeenCalledWith(
          expect.arrayContaining([
            [37.7749, -122.4194],
            [37.7849, -122.4094],
            [37.7949, -122.3994],
          ]),
          expect.objectContaining({
            color: '#2563eb',
            weight: 3,
            opacity: 0.8,
          })
        );
      });
    });

    it('creates start and end markers', async () => {
      render(<MapVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      await waitFor(() => {
        const L = require('leaflet');
        
        // Should create markers for start and end points
        expect(L.marker).toHaveBeenCalledWith([37.7749, -122.4194], expect.any(Object));
        expect(L.marker).toHaveBeenCalledWith([37.7949, -122.3994], expect.any(Object));
      });
    });

    it('creates waypoint markers', async () => {
      render(<MapVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      await waitFor(() => {
        const L = require('leaflet');
        
        // Should create markers for waypoints
        expect(L.marker).toHaveBeenCalledWith([37.7849, -122.4094], expect.any(Object));
        expect(L.marker).toHaveBeenCalledWith([37.7949, -122.3994], expect.any(Object));
      });
    });

    it('fits map bounds to route', async () => {
      const mockMap = {
        setView: jest.fn(),
        addLayer: jest.fn(),
        removeLayer: jest.fn(),
        fitBounds: jest.fn(),
        remove: jest.fn(),
      };
      
      const L = require('leaflet');
      L.map.mockReturnValue(mockMap);
      
      render(<MapVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      await waitFor(() => {
        expect(L.latLngBounds).toHaveBeenCalled();
        expect(mockMap.fitBounds).toHaveBeenCalledWith(
          expect.anything(),
          { padding: [20, 20] }
        );
      });
    });

    it('uses custom div icons for markers', async () => {
      render(<MapVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      await waitFor(() => {
        const L = require('leaflet');
        expect(L.divIcon).toHaveBeenCalledTimes(3); // start, end, waypoint icons
      });
    });

    it('renders with custom height', () => {
      render(
        <MapVisualization 
          trackPoints={mockTrackPoints} 
          waypoints={mockWaypoints} 
          height="600px"
        />
      );
      
      const mapContainer = screen.getByText('Route Map').parentElement?.querySelector('div[style*="height"]');
      expect(mapContainer).toHaveStyle({ height: '600px' });
    });

    it('uses default height when not specified', () => {
      render(<MapVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      const mapContainer = screen.getByText('Route Map').parentElement?.querySelector('div[style*="height"]');
      expect(mapContainer).toHaveStyle({ height: '400px' });
    });

    it('handles waypoints being undefined', async () => {
      render(<MapVisualization trackPoints={mockTrackPoints} />);
      
      await waitFor(() => {
        const L = require('leaflet');
        // Should still create start and end markers, but no waypoint markers
        expect(L.marker).toHaveBeenCalledTimes(2);
      });
    });

    it('cleans up map on unmount', async () => {
      const mockMap = {
        setView: jest.fn(),
        addLayer: jest.fn(),
        removeLayer: jest.fn(),
        fitBounds: jest.fn(),
        remove: jest.fn(),
      };
      
      const L = require('leaflet');
      L.map.mockReturnValue(mockMap);
      
      const { unmount } = render(
        <MapVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />
      );
      
      await waitFor(() => {
        expect(L.map).toHaveBeenCalled();
      });
      
      unmount();
      
      // Map should be cleaned up
      expect(mockMap.remove).toHaveBeenCalled();
    });

    it('is accessible', async () => {
      const { container } = render(
        <MapVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />
      );
      
      const results = await checkAccessibility(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('map updates', () => {
    it('updates map when track points change', async () => {
      const mockMap = {
        setView: jest.fn(),
        addLayer: jest.fn(),
        removeLayer: jest.fn(),
        fitBounds: jest.fn(),
        remove: jest.fn(),
      };
      
      const mockLayerGroup = {
        addTo: jest.fn().mockReturnThis(),
        addLayer: jest.fn(),
        removeLayer: jest.fn(),
        remove: jest.fn(),
      };
      
      const L = require('leaflet');
      L.map.mockReturnValue(mockMap);
      L.layerGroup.mockReturnValue(mockLayerGroup);
      
      const { rerender } = render(
        <MapVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />
      );
      
      await waitFor(() => {
        expect(L.map).toHaveBeenCalled();
      });
      
      // Update with new track points
      const newTrackPoints = [
        ...mockTrackPoints,
        { lat: 37.8049, lon: -122.3894, elevation: 250, time: '2023-01-01T10:15:00Z' },
      ];
      
      rerender(<MapVisualization trackPoints={newTrackPoints} waypoints={mockWaypoints} />);
      
      await waitFor(() => {
        // Should remove old layer and add new one
        expect(mockMap.removeLayer).toHaveBeenCalled();
        expect(L.layerGroup).toHaveBeenCalledTimes(2); // Initial + update
      });
    });
  });

  describe('error handling', () => {
    it('handles single track point gracefully', async () => {
      const singlePoint = [mockTrackPoints[0]];
      
      render(<MapVisualization trackPoints={singlePoint} waypoints={[]} />);
      
      await waitFor(() => {
        const L = require('leaflet');
        expect(L.map).toHaveBeenCalled();
        // Should create start marker but not end marker
        expect(L.marker).toHaveBeenCalledTimes(1);
      });
    });

    it('handles invalid coordinates gracefully', async () => {
      const invalidTrackPoints = [
        { lat: NaN, lon: -122.4194, elevation: 100 },
        { lat: 37.7849, lon: NaN, elevation: 150 },
      ];
      
      // Should not throw error
      expect(() => {
        render(<MapVisualization trackPoints={invalidTrackPoints} waypoints={[]} />);
      }).not.toThrow();
    });
  });
}); 