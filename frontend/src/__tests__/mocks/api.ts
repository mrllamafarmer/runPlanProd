import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { mockTrackPoints, mockWaypoints, mockFileInfo } from '../utils/test-utils';

// Mock API responses
const mockRouteResponse = {
  routeId: 'test-route-123',
  message: 'Route created successfully',
};

const mockRouteDetail = {
  route: {
    id: 'test-route-123',
    filename: 'test-route.gpx',
    upload_date: '2023-01-01T10:00:00Z',
    total_distance: 1.0,
    total_elevation_gain: 100,
    total_elevation_loss: 0,
    start_time: '2023-01-01T10:00:00Z',
    target_time_seconds: null,
    slowdown_factor_percent: 0,
    has_valid_time: true,
    using_target_time: false,
    gpx_data: '<gpx>test data</gpx>',
  },
  waypoints: mockWaypoints.map(wp => ({
    id: wp.id || '1',
    leg_number: wp.legNumber,
    leg_name: wp.legName,
    distance_miles: wp.distanceMiles,
    cumulative_distance: wp.cumulativeDistance,
    duration_seconds: wp.durationSeconds,
    leg_pace_seconds: wp.legPaceSeconds,
    elevation_gain: wp.elevationGain,
    elevation_loss: wp.elevationLoss,
    cumulative_elevation_gain: wp.cumulativeElevationGain,
    cumulative_elevation_loss: wp.cumulativeElevationLoss,
    rest_time_seconds: wp.restTimeSeconds,
    notes: wp.notes,
    latitude: wp.latitude,
    longitude: wp.longitude,
    elevation: wp.elevation,
  })),
  trackPoints: mockTrackPoints.map(tp => ({
    latitude: tp.lat,
    longitude: tp.lon,
    elevation: tp.elevation,
    time: tp.time,
    distance: tp.distance,
    cumulative_distance: tp.cumulativeDistance,
  })),
};

const mockRoutesList = [
  {
    id: 'route-1',
    filename: 'morning-run.gpx',
    upload_date: '2023-01-01T10:00:00Z',
    total_distance: 5.2,
    total_elevation_gain: 250,
    total_elevation_loss: 180,
    start_time: '2023-01-01T09:00:00Z',
    target_time_seconds: 1800,
    slowdown_factor_percent: 10,
    has_valid_time: true,
    using_target_time: true,
  },
  {
    id: 'route-2',
    filename: 'mountain-hike.gpx',
    upload_date: '2023-01-02T14:00:00Z',
    total_distance: 12.8,
    total_elevation_gain: 1200,
    total_elevation_loss: 950,
    start_time: '2023-01-02T08:00:00Z',
    target_time_seconds: null,
    slowdown_factor_percent: 0,
    has_valid_time: true,
    using_target_time: false,
  },
];

// API request handlers
export const handlers = [
  // Health check
  rest.get('/health', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ status: 'healthy' }));
  }),

  // Get all routes
  rest.get('/api/routes', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockRoutesList));
  }),

  // Create route
  rest.post('/api/routes', (req, res, ctx) => {
    return res(ctx.status(201), ctx.json(mockRouteResponse));
  }),

  // Get route detail
  rest.get('/api/routes/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(ctx.status(200), ctx.json(mockRouteDetail));
  }),

  // Update route
  rest.put('/api/routes/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(ctx.status(200), ctx.json({ ...mockRouteDetail.route, id }));
  }),

  // Delete route
  rest.delete('/api/routes/:id', (req, res, ctx) => {
    return res(ctx.status(204));
  }),

  // Update waypoint notes
  rest.put('/api/routes/:routeId/waypoints/:waypointId/notes', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ message: 'Notes updated successfully' }));
  }),

  // Parse GPX (file upload simulation)
  rest.post('/api/parse-gpx', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        trackPoints: mockTrackPoints,
        fileInfo: mockFileInfo,
      })
    );
  }),

  // Export routes
  rest.post('/api/routes/:id/export/csv', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'text/csv'),
      ctx.text('leg,distance,elevation,pace\n1,0.5,150,10:00\n2,0.5,200,10:30')
    );
  }),

  rest.post('/api/routes/:id/export/pdf', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.set('Content-Type', 'application/pdf'),
      ctx.body(new ArrayBuffer(8))
    );
  }),

  // Error responses for testing
  rest.get('/api/routes/error', (req, res, ctx) => {
    return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
  }),

  rest.post('/api/routes/error', (req, res, ctx) => {
    return res(ctx.status(400), ctx.json({ error: 'Invalid route data' }));
  }),
];

// Setup test server
export const server = setupServer(...handlers);

// Server lifecycle hooks
export const setupApiMocks = () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
};

// Helper functions for test-specific mocking
export const mockApiError = (endpoint: string, status: number, error: string) => {
  server.use(
    rest.get(endpoint, (req, res, ctx) => {
      return res(ctx.status(status), ctx.json({ error }));
    }),
    rest.post(endpoint, (req, res, ctx) => {
      return res(ctx.status(status), ctx.json({ error }));
    })
  );
};

export const mockApiSuccess = (endpoint: string, method: 'get' | 'post' | 'put' | 'delete', response: any) => {
  const restMethod = rest[method];
  server.use(
    restMethod(endpoint, (req, res, ctx) => {
      return res(ctx.status(200), ctx.json(response));
    })
  );
};

// Mock file for upload testing
export const mockGPXFile = new File(
  [`<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test Route</name>
    <trkseg>
      ${mockTrackPoints.map(point => `
        <trkpt lat="${point.lat}" lon="${point.lon}">
          <ele>${point.elevation}</ele>
          <time>${point.time}</time>
        </trkpt>
      `).join('')}
    </trkseg>
  </trk>
</gpx>`],
  'test-route.gpx',
  { type: 'application/gpx+xml' }
); 