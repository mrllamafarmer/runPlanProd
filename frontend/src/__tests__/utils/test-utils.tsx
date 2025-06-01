import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { TrackPoint, Waypoint, FileInfo } from '../../types';

// Mock data for testing
export const mockTrackPoints: TrackPoint[] = [
  {
    lat: 37.7749,
    lon: -122.4194,
    elevation: 100,
    time: '2023-01-01T10:00:00Z',
    distance: 0,
    cumulativeDistance: 0,
  },
  {
    lat: 37.7849,
    lon: -122.4094,
    elevation: 150,
    time: '2023-01-01T10:05:00Z',
    distance: 0.5,
    cumulativeDistance: 0.5,
  },
  {
    lat: 37.7949,
    lon: -122.3994,
    elevation: 200,
    time: '2023-01-01T10:10:00Z',
    distance: 0.5,
    cumulativeDistance: 1.0,
  },
];

export const mockWaypoints: Waypoint[] = [
  {
    id: '1',
    legNumber: 1,
    legName: 'Start to Checkpoint 1',
    distanceMiles: 0.5,
    cumulativeDistance: 0.5,
    durationSeconds: 300,
    legPaceSeconds: 600,
    elevationGain: 50,
    elevationLoss: 0,
    cumulativeElevationGain: 50,
    cumulativeElevationLoss: 0,
    latitude: 37.7849,
    longitude: -122.4094,
    elevation: 150,
    notes: 'First checkpoint',
  },
  {
    id: '2',
    legNumber: 2,
    legName: 'Checkpoint 1 to End',
    distanceMiles: 0.5,
    cumulativeDistance: 1.0,
    durationSeconds: 300,
    legPaceSeconds: 600,
    elevationGain: 50,
    elevationLoss: 0,
    cumulativeElevationGain: 100,
    cumulativeElevationLoss: 0,
    latitude: 37.7949,
    longitude: -122.3994,
    elevation: 200,
    notes: 'Final destination',
  },
];

export const mockFileInfo: FileInfo = {
  filename: 'test-route.gpx',
  trackPointCount: 3,
  hasValidTime: true,
  startTime: '2023-01-01T10:00:00Z',
  endTime: '2023-01-01T10:10:00Z',
  totalDistance: 1.0,
  totalElevationGain: 100,
  totalElevationLoss: 0,
};

// Create a wrapper component with all necessary providers
const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

// Custom render function that includes providers
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Helper to setup store with mock data
export const setupMockStore = (overrides: Partial<ReturnType<typeof useAppStore.getState>> = {}) => {
  const store = useAppStore.getState();
  
  // Reset store to initial state
  store.resetState();
  
  // Apply overrides
  Object.entries(overrides).forEach(([key, value]) => {
    (store as any)[key] = value;
  });
  
  return store;
};

// Helper to create mock file for upload testing
export const createMockFile = (content: string, filename: string = 'test.gpx'): File => {
  const file = new File([content], filename, { type: 'application/gpx+xml' });
  return file;
};

// Mock GPX content for testing
export const mockGPXContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test Route</name>
    <trkseg>
      <trkpt lat="37.7749" lon="-122.4194">
        <ele>100</ele>
        <time>2023-01-01T10:00:00Z</time>
      </trkpt>
      <trkpt lat="37.7849" lon="-122.4094">
        <ele>150</ele>
        <time>2023-01-01T10:05:00Z</time>
      </trkpt>
      <trkpt lat="37.7949" lon="-122.3994">
        <ele>200</ele>
        <time>2023-01-01T10:10:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

// Accessibility testing helper
export const checkAccessibility = async (container: HTMLElement) => {
  const { axe } = await import('jest-axe');
  const results = await axe(container);
  return results;
};

// Common assertions
export const expectElementToBeVisible = (element: HTMLElement | null) => {
  expect(element).toBeInTheDocument();
  expect(element).toBeVisible();
};

export const expectElementToHaveText = (element: HTMLElement | null, text: string) => {
  expect(element).toBeInTheDocument();
  expect(element).toHaveTextContent(text);
};

// Re-export testing library utilities
export * from '@testing-library/react';
export { customRender as render }; 