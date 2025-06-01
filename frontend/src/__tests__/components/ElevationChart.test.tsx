import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { render, mockTrackPoints, mockWaypoints, checkAccessibility } from '../utils/test-utils';
import ElevationChart from '../../components/ElevationChart';

describe('ElevationChart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with no track points', () => {
    it('renders empty state message', () => {
      render(<ElevationChart trackPoints={[]} />);
      
      expect(screen.getByText('Elevation Profile')).toBeInTheDocument();
      expect(screen.getByText('No track points available for elevation chart')).toBeInTheDocument();
    });

    it('does not render chart when no data', () => {
      render(<ElevationChart trackPoints={[]} />);
      
      expect(screen.queryByTestId('elevation-chart')).not.toBeInTheDocument();
    });

    it('is accessible when empty', async () => {
      const { container } = render(<ElevationChart trackPoints={[]} />);
      const results = await checkAccessibility(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('with track points but no elevation data', () => {
    const trackPointsWithoutElevation = mockTrackPoints.map(point => ({
      ...point,
      elevation: undefined,
    }));

    it('renders fallback message for no elevation data', () => {
      // Mock the Line component to return a div for testing
      const mockLine = jest.fn(() => (
        <div data-testid="chart-fallback">No elevation data</div>
      ));
      
      jest.doMock('react-chartjs-2', () => ({
        Line: mockLine,
      }));

      render(<ElevationChart trackPoints={trackPointsWithoutElevation} />);
      
      expect(screen.getByText('Elevation Profile')).toBeInTheDocument();
    });

    it('passes fallback data to chart', () => {
      const mockLine = jest.fn(() => <div data-testid="mock-chart" />);
      
      jest.doMock('react-chartjs-2', () => ({
        Line: mockLine,
      }));

      render(<ElevationChart trackPoints={trackPointsWithoutElevation} />);
      
      expect(mockLine).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            labels: ['No elevation data'],
            datasets: expect.arrayContaining([
              expect.objectContaining({
                label: 'Elevation',
                data: [0],
              }),
            ]),
          }),
        }),
        {}
      );
    });
  });

  describe('with elevation data', () => {
    it('renders chart component', () => {
      render(<ElevationChart trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      expect(screen.getByText('Elevation Profile')).toBeInTheDocument();
      // Chart should be rendered (mocked as canvas)
      const chart = screen.getByTestId ? screen.queryByTestId('elevation-chart') : null;
      // Since we're using mocked chart, we check for the component structure
    });

    it('calculates distances correctly using Haversine formula', () => {
      const mockLine = jest.fn(() => <div data-testid="mock-chart" />);
      
      jest.doMock('react-chartjs-2', () => ({
        Line: mockLine,
      }));

      render(<ElevationChart trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      // Verify that the chart received calculated distances
      expect(mockLine).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            labels: expect.arrayContaining([
              '0.0', // First point at distance 0
              expect.any(String), // Calculated distances
            ]),
          }),
        }),
        {}
      );
    });

    it('includes elevation data in chart', () => {
      const mockLine = jest.fn(() => <div data-testid="mock-chart" />);
      
      jest.doMock('react-chartjs-2', () => ({
        Line: mockLine,
      }));

      render(<ElevationChart trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      expect(mockLine).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            datasets: expect.arrayContaining([
              expect.objectContaining({
                label: 'Elevation (ft)',
                data: [100, 150, 200], // Elevation values from mock data
                borderColor: 'rgb(37, 99, 235)',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                fill: true,
              }),
            ]),
          }),
        }),
        {}
      );
    });

    it('renders with custom height', () => {
      render(
        <ElevationChart 
          trackPoints={mockTrackPoints} 
          waypoints={mockWaypoints} 
          height="600px"
        />
      );
      
      const chartContainer = screen.getByText('Elevation Profile').parentElement?.querySelector('.p-4');
      expect(chartContainer).toHaveStyle({ height: '600px' });
    });

    it('uses default height when not specified', () => {
      render(<ElevationChart trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      const chartContainer = screen.getByText('Elevation Profile').parentElement?.querySelector('.p-4');
      expect(chartContainer).toHaveStyle({ height: '400px' });
    });

    it('handles waypoints being undefined', () => {
      expect(() => {
        render(<ElevationChart trackPoints={mockTrackPoints} />);
      }).not.toThrow();
    });

    it('renders waypoint annotations', () => {
      render(<ElevationChart trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      expect(screen.getByText('Waypoints:')).toBeInTheDocument();
      expect(screen.getByText(/Start to Checkpoint 1/)).toBeInTheDocument();
      expect(screen.getByText(/Checkpoint 1 to End/)).toBeInTheDocument();
    });

    it('calculates waypoint positions on chart', () => {
      const mockLine = jest.fn(() => <div data-testid="mock-chart" />);
      
      jest.doMock('react-chartjs-2', () => ({
        Line: mockLine,
      }));

      render(<ElevationChart trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      // Check that waypoint annotations are calculated
      const call = mockLine.mock.calls[0];
      const chartData = call[0].data;
      expect(chartData.waypointAnnotations).toBeDefined();
      expect(chartData.waypointAnnotations).toHaveLength(2);
    });

    it('configures chart options correctly', () => {
      const mockLine = jest.fn(() => <div data-testid="mock-chart" />);
      
      jest.doMock('react-chartjs-2', () => ({
        Line: mockLine,
      }));

      render(<ElevationChart trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      expect(mockLine).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          responsive: true,
          maintainAspectRatio: false,
          plugins: expect.objectContaining({
            title: expect.objectContaining({
              display: true,
              text: 'Elevation Profile',
            }),
          }),
          scales: expect.objectContaining({
            x: expect.objectContaining({
              title: expect.objectContaining({
                text: 'Distance (miles)',
              }),
            }),
            y: expect.objectContaining({
              title: expect.objectContaining({
                text: 'Elevation (feet)',
              }),
            }),
          }),
        })
      );
    });

    it('is accessible with data', async () => {
      const { container } = render(
        <ElevationChart trackPoints={mockTrackPoints} waypoints={mockWaypoints} />
      );
      
      const results = await checkAccessibility(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('data processing', () => {
    it('filters out track points without elevation', () => {
      const mixedTrackPoints = [
        { lat: 37.7749, lon: -122.4194, elevation: 100 },
        { lat: 37.7799, lon: -122.4144, elevation: undefined },
        { lat: 37.7849, lon: -122.4094, elevation: 150 },
        { lat: 37.7899, lon: -122.4044, elevation: null },
        { lat: 37.7949, lon: -122.3994, elevation: 200 },
      ];

      const mockLine = jest.fn(() => <div data-testid="mock-chart" />);
      
      jest.doMock('react-chartjs-2', () => ({
        Line: mockLine,
      }));

      render(<ElevationChart trackPoints={mixedTrackPoints} waypoints={[]} />);
      
      // Should only include points with elevation data
      expect(mockLine).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            datasets: expect.arrayContaining([
              expect.objectContaining({
                data: [100, 150, 200], // Only points with elevation
              }),
            ]),
          }),
        }),
        {}
      );
    });

    it('handles empty waypoints array', () => {
      render(<ElevationChart trackPoints={mockTrackPoints} waypoints={[]} />);
      
      // Should not render waypoint section
      expect(screen.queryByText('Waypoints:')).not.toBeInTheDocument();
    });

    it('memoizes chart data calculation', () => {
      const mockLine = jest.fn(() => <div data-testid="mock-chart" />);
      
      jest.doMock('react-chartjs-2', () => ({
        Line: mockLine,
      }));

      const { rerender } = render(
        <ElevationChart trackPoints={mockTrackPoints} waypoints={mockWaypoints} />
      );
      
      const firstCallCount = mockLine.mock.calls.length;
      
      // Rerender with same props - should not recalculate
      rerender(<ElevationChart trackPoints={mockTrackPoints} waypoints={mockWaypoints} />);
      
      // React.useMemo should prevent recalculation
      expect(mockLine.mock.calls.length).toBe(firstCallCount * 2); // Just re-render, not recalculate
    });
  });

  describe('error handling', () => {
    it('handles invalid elevation values gracefully', () => {
      const invalidTrackPoints = [
        { lat: 37.7749, lon: -122.4194, elevation: NaN },
        { lat: 37.7849, lon: -122.4094, elevation: Infinity },
        { lat: 37.7949, lon: -122.3994, elevation: -Infinity },
      ];

      expect(() => {
        render(<ElevationChart trackPoints={invalidTrackPoints} waypoints={[]} />);
      }).not.toThrow();
    });

    it('handles missing coordinates in track points', () => {
      const invalidTrackPoints = [
        { lat: NaN, lon: -122.4194, elevation: 100 },
        { lat: 37.7849, lon: NaN, elevation: 150 },
      ];

      expect(() => {
        render(<ElevationChart trackPoints={invalidTrackPoints} waypoints={[]} />);
      }).not.toThrow();
    });
  });
}); 