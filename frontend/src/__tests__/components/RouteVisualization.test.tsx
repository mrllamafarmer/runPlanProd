import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { render, mockTrackPoints, mockWaypoints, checkAccessibility } from '../utils/test-utils';
import RouteVisualization from '../../components/RouteVisualization';

// Mock the child components
jest.mock('../../components/MapVisualization', () => {
  return function MockMapVisualization({ trackPoints, waypoints, height }: any) {
    return (
      <div data-testid="map-visualization">
        <h3>Route Map</h3>
        <div>Track points: {trackPoints.length}</div>
        <div>Waypoints: {waypoints.length}</div>
        <div>Height: {height}</div>
      </div>
    );
  };
});

jest.mock('../../components/ElevationChart', () => {
  return function MockElevationChart({ trackPoints, waypoints, height }: any) {
    return (
      <div data-testid="elevation-chart">
        <h3>Elevation Profile</h3>
        <div>Track points: {trackPoints.length}</div>
        <div>Waypoints: {waypoints.length}</div>
        <div>Height: {height}</div>
      </div>
    );
  };
});

describe('RouteVisualization', () => {
  describe('with no track points', () => {
    it('renders empty state message', () => {
      render(<RouteVisualization trackPoints={[]} />);
      
      expect(screen.getByText('Route Visualization')).toBeInTheDocument();
      expect(screen.getByText('Upload a GPX file to see the route visualization')).toBeInTheDocument();
    });

    it('does not render tabs when no data', () => {
      render(<RouteVisualization trackPoints={[]} />);
      
      expect(screen.queryByText('📍 Route Map')).not.toBeInTheDocument();
      expect(screen.queryByText('📈 Elevation Profile')).not.toBeInTheDocument();
    });

    it('is accessible when empty', async () => {
      const { container } = render(<RouteVisualization trackPoints={[]} />);
      const results = await checkAccessibility(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('with track points', () => {
    it('renders tab navigation', () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      expect(screen.getByText('📍 Route Map')).toBeInTheDocument();
      expect(screen.getByText('📈 Elevation Profile')).toBeInTheDocument();
    });

    it('defaults to map tab', () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      expect(screen.getByTestId('map-visualization')).toBeInTheDocument();
      expect(screen.queryByTestId('elevation-chart')).not.toBeInTheDocument();
    });

    it('switches to elevation tab when clicked', async () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      const elevationTab = screen.getByText('📈 Elevation Profile');
      fireEvent.click(elevationTab);
      
      await waitFor(() => {
        expect(screen.getByTestId('elevation-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('map-visualization')).not.toBeInTheDocument();
      });
    });

    it('switches back to map tab', async () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      // Switch to elevation
      fireEvent.click(screen.getByText('📈 Elevation Profile'));
      await waitFor(() => {
        expect(screen.getByTestId('elevation-chart')).toBeInTheDocument();
      });
      
      // Switch back to map
      fireEvent.click(screen.getByText('📍 Route Map'));
      await waitFor(() => {
        expect(screen.getByTestId('map-visualization')).toBeInTheDocument();
        expect(screen.queryByTestId('elevation-chart')).not.toBeInTheDocument();
      });
    });

    it('passes correct props to MapVisualization', () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      const mapViz = screen.getByTestId('map-visualization');
      expect(mapViz).toHaveTextContent('Track points: 3');
      expect(mapViz).toHaveTextContent('Waypoints: 2');
      expect(mapViz).toHaveTextContent('Height: 500px');
    });

    it('passes correct props to ElevationChart', async () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      fireEvent.click(screen.getByText('📈 Elevation Profile'));
      
      await waitFor(() => {
        const elevationChart = screen.getByTestId('elevation-chart');
        expect(elevationChart).toHaveTextContent('Track points: 3');
        expect(elevationChart).toHaveTextContent('Waypoints: 2');
        expect(elevationChart).toHaveTextContent('Height: 400px');
      });
    });

    it('renders route statistics', () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      expect(screen.getByText('Route Statistics')).toBeInTheDocument();
      expect(screen.getByText('Track Points:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Waypoints:')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders elevation statistics when available', () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      expect(screen.getByText('Min Elevation:')).toBeInTheDocument();
      expect(screen.getByText('100 ft')).toBeInTheDocument();
      expect(screen.getByText('Max Elevation:')).toBeInTheDocument();
      expect(screen.getByText('200 ft')).toBeInTheDocument();
    });

    it('does not render elevation statistics when no elevation data', () => {
      const trackPointsWithoutElevation = mockTrackPoints.map(point => ({
        ...point,
        elevation: undefined,
      }));
      
      render(<RouteVisualization trackPoints={trackPointsWithoutElevation} waypoints={mockWaypoints} />);
      
      expect(screen.queryByText('Min Elevation:')).not.toBeInTheDocument();
      expect(screen.queryByText('Max Elevation:')).not.toBeInTheDocument();
    });

    it('handles waypoints prop being undefined', () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} />);
      
      expect(screen.getByText('Waypoints:')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('is accessible with data', async () => {
      const { container } = render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      const results = await checkAccessibility(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper ARIA labels for tabs', () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      const tablist = screen.getByRole('navigation');
      expect(tablist).toHaveAttribute('aria-label', 'Tabs');
    });

    it('updates active tab styling correctly', () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      const mapTab = screen.getByText('📍 Route Map');
      const elevationTab = screen.getByText('📈 Elevation Profile');
      
      // Map tab should be active initially
      expect(mapTab).toHaveClass('border-blue-500', 'text-blue-600');
      expect(elevationTab).toHaveClass('border-transparent', 'text-gray-500');
      
      // Switch to elevation tab
      fireEvent.click(elevationTab);
      
      expect(elevationTab).toHaveClass('border-blue-500', 'text-blue-600');
      expect(mapTab).toHaveClass('border-transparent', 'text-gray-500');
    });
  });

  describe('responsive behavior', () => {
    it('renders with proper responsive classes', () => {
      render(<RouteVisualization trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      const statsGrid = screen.getByText('Route Statistics').parentElement?.querySelector('.grid');
      expect(statsGrid).toHaveClass('grid-cols-2', 'md:grid-cols-4');
    });
  });
}); 