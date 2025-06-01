import axios from 'axios';
import { RouteData, RouteListItem, RouteDetail, RouteResponse, WaypointNotesUpdate } from '../types';

// Configure axios defaults
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const routeApi = {
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

  // Update waypoint notes
  updateWaypointNotes: async (waypointId: string, notes: WaypointNotesUpdate): Promise<{ message: string }> => {
    const response = await api.put<{ message: string }>(`/waypoints/${waypointId}/notes`, notes);
    return response.data;
  },

  // Delete route
  deleteRoute: async (routeId: string): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/routes/${routeId}`);
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