export interface TrackPoint {
  lat: number;
  lon: number;
  elevation?: number;
  time?: string;
  distance?: number;
  cumulativeDistance?: number;
}

export interface Waypoint {
  id?: string;
  legNumber: number;
  legName?: string;
  distanceMiles: number;
  cumulativeDistance: number;
  durationSeconds: number;
  legPaceSeconds: number;
  elevationGain: number;
  elevationLoss: number;
  cumulativeElevationGain: number;
  cumulativeElevationLoss: number;
  restTimeSeconds?: number;
  notes?: string;
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface RouteData {
  filename: string;
  totalDistance: number;
  totalElevationGain: number;
  totalElevationLoss: number;
  startTime?: string;
  targetTimeSeconds?: number;
  slowdownFactorPercent?: number;
  hasValidTime?: boolean;
  usingTargetTime?: boolean;
  gpxData?: string;
  waypoints?: Waypoint[];
  trackPoints?: TrackPoint[];
}

export interface RouteListItem {
  id: string;
  filename: string;
  upload_date: string;
  total_distance: number;
  total_elevation_gain: number;
  total_elevation_loss: number;
  start_time?: string;
  target_time_seconds?: number;
  slowdown_factor_percent?: number;
  has_valid_time?: boolean;
  using_target_time?: boolean;
}

export interface RouteDetail {
  route: {
    id: string;
    name: string;
    description?: string;
    totalDistance: number;
    totalElevationGain: number;
    totalElevationLoss: number;
    targetTimeSeconds: number;
    created_at?: string;
    owner?: string;
    is_public?: boolean;
  };
  waypoints: Array<{
    id: string;
    leg_number: number;
    leg_name?: string;
    distance_miles: number;
    cumulative_distance: number;
    duration_seconds: number;
    leg_pace_seconds: number;
    elevation_gain: number;
    elevation_loss: number;
    cumulative_elevation_gain: number;
    cumulative_elevation_loss: number;
    rest_time_seconds?: number;
    notes?: string;
    latitude: number;
    longitude: number;
    elevation: number;
  }>;
  trackPoints: Array<{
    lat: number;
    lon: number;
    elevation?: number;
    time?: string;
    distance?: number;
    cumulativeDistance?: number;
  }>;
}

export interface RouteResponse {
  routeId: string;
  message: string;
}

export interface WaypointNotesUpdate {
  notes: string;
}

// New enhanced waypoint types for API integration
export interface WaypointDB {
  id: number;
  route_id: number;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  elevation_meters?: number;
  order_index: number;
  waypoint_type: 'start' | 'checkpoint' | 'finish' | 'poi';
  target_pace_per_km_seconds?: number;
  rest_time_seconds?: number;
  created_at: string;
}

export interface WaypointCreate {
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  elevation_meters?: number;
  order_index: number;
  waypoint_type: 'start' | 'checkpoint' | 'finish' | 'poi';
  target_pace_per_km_seconds?: number;
  rest_time_seconds?: number;
}

export interface WaypointUpdate {
  name?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  elevation_meters?: number;
  order_index?: number;
  waypoint_type?: 'start' | 'checkpoint' | 'finish' | 'poi';
  target_pace_per_km_seconds?: number;
  rest_time_seconds?: number;
}

export interface CustomLeg {
  distance: number;
  name?: string;
  restTime?: number;
}

export interface TargetTime {
  hours: number;
  minutes: number;
  seconds: number;
}

export interface FileInfo {
  filename: string;
  trackPointCount: number;
  hasValidTime: boolean;
  startTime?: string;
  endTime?: string;
  totalDistance: number;
  totalElevationGain: number;
  totalElevationLoss: number;
}

export interface VisualizationTab {
  id: string;
  label: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface AppState {
  // Route data
  currentRoute: RouteData | null;
  trackPoints: TrackPoint[];
  waypoints: Waypoint[];
  customLegs: CustomLeg[];
  
  // Enhanced waypoint management
  currentRouteId: string | null;
  routeWaypoints: WaypointDB[];
  isWaypointCreationMode: boolean;
  
  // Route settings
  targetTimeSeconds: number | null;
  slowdownFactorPercent: number;
  hasValidTime: boolean;
  usingTargetTime: boolean;
  
  // UI state
  activeTab: 'analyzer' | 'saved-routes';
  activeVizTab: 'map' | 'elevation';
  isLoading: boolean;
  
  // File info
  fileInfo: FileInfo | null;
  
  // Saved routes
  savedRoutes: RouteListItem[];
  
  // Toasts
  toasts: Toast[];
} 