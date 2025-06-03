import axios, { AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { RouteData, RouteListItem, RouteDetail, RouteResponse, WaypointNotesUpdate } from '../types';

// Configure axios defaults
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and auth
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    // Add auth token if available
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error: AxiosError) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    console.error('API Response Error:', error.response?.data || error.message);
    
    // Handle auth errors
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      // Could trigger a redirect to login here
    }
    
    return Promise.reject(error);
  }
);

export const routeApi = {
  // Upload GPX file
  uploadGpxFile: async (file: File): Promise<{
    route_id: number;
    route_name: string;
    original_points: number;
    optimized_points: number;
    compression_ratio: number;
    total_distance_meters: number;
    total_elevation_gain_meters: number;
    processing_time_seconds: number;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/routes/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Create a new route
  createRoute: async (routeData: RouteData): Promise<RouteResponse> => {
    const response = await api.post<RouteResponse>('/routes', routeData);
    return response.data;
  },

  // Get all routes
  getAllRoutes: async (): Promise<RouteListItem[]> => {
    const response = await api.get<RouteListItem[]>('/routes');
    return response.data;
  },

  // Get route by ID
  getRouteById: async (routeId: string): Promise<RouteDetail> => {
    const response = await api.get<RouteDetail>(`/routes/${routeId}`);
    return response.data;
  },

  // Update route
  updateRoute: async (routeId: string, routeData: {
    name?: string;
    description?: string;
    is_public?: boolean;
    target_time_seconds?: number;
  }): Promise<{ message: string }> => {
    const response = await api.put<{ message: string }>(`/routes/${routeId}`, routeData);
    return response.data;
  },

  // Update waypoint notes
  updateWaypointNotes: async (waypointId: string, notes: WaypointNotesUpdate): Promise<{ message: string }> => {
    const response = await api.put<{ message: string }>(`/waypoints/${waypointId}/notes`, notes);
    return response.data;
  },

  // Get waypoints for a route
  getRouteWaypoints: async (routeId: string): Promise<any[]> => {
    const response = await api.get<any[]>(`/routes/${routeId}/waypoints`);
    return response.data;
  },

  // Create a new waypoint
  createWaypoint: async (routeId: string, waypointData: {
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    elevation_meters?: number;
    order_index: number;
    waypoint_type: 'start' | 'checkpoint' | 'finish' | 'poi';
    target_pace_per_km_seconds?: number;
    rest_time_seconds?: number;
  }): Promise<{ waypoint_id: number; message: string }> => {
    const response = await api.post<{ waypoint_id: number; message: string }>(`/routes/${routeId}/waypoints`, waypointData);
    return response.data;
  },

  // Update an existing waypoint
  updateWaypoint: async (waypointId: string, waypointData: {
    name?: string;
    description?: string;
    latitude?: number;
    longitude?: number;
    elevation_meters?: number;
    order_index?: number;
    waypoint_type?: 'start' | 'checkpoint' | 'finish' | 'poi';
    target_pace_per_km_seconds?: number;
    rest_time_seconds?: number;
  }): Promise<{ message: string }> => {
    const response = await api.put<{ message: string }>(`/waypoints/${waypointId}`, waypointData);
    return response.data;
  },

  // Delete a waypoint
  deleteWaypoint: async (waypointId: string): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/waypoints/${waypointId}`);
    return response.data;
  },

  // Delete route
  deleteRoute: async (routeId: string): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/routes/${routeId}`);
    return response.data;
  },
};

export const authApi = {
  // Login
  login: async (credentials: { username_or_email: string; password: string }) => {
    const response = await api.post('/auth/login', credentials);
    const { access_token, ...userData } = response.data;
    
    // Store token and user data
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    return response.data;
  },

  // Register
  register: async (userData: { username: string; email: string; password: string }) => {
    const response = await api.post('/auth/register', userData);
    const { access_token, ...user } = response.data;
    
    // Store token and user data
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user', JSON.stringify(user));
    
    return response.data;
  },

  // Logout
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

export const healthApi = {
  // Check health status
  checkHealth: async (): Promise<{
    status: string;
    message: string;
    database: string;
    routes_count: number;
  }> => {
    const response = await api.get('/health');
    return response.data;
  },
};

// Error handling utilities
export const handleApiError = (error: any): string => {
  if (error.response?.data?.detail) {
    return error.response.data.detail;
  }
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

export default api; 