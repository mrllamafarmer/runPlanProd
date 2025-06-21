/**
 * Race Analysis API Service
 * Handles communication with the backend for race analysis operations
 */

// Use the same base URL pattern as the main API
const API_BASE_URL = '/api';

export interface RaceTrackPoint {
  lat: number;
  lon: number;
  elevation?: number;
  cumulativeTime: number; // seconds from race start
  cumulativeDistance: number; // miles
  order: number;
}

export interface WaypointComparison {
  waypointId: number;
  plannedCumulativeTime: number;
  actualCumulativeTime?: number;
  timeDifference?: number;
  legDuration?: number;
  legDistance?: number;
  actualPace?: number;
  plannedPace?: number;
  closestPointLat?: number;
  closestPointLon?: number;
}

export interface RaceAnalysisCreate {
  routeId: number;
  raceName: string;
  raceDate?: string; // ISO date string
  actualGpxFilename: string;
  totalRaceTimeSeconds: number;
  totalActualDistanceMeters: number;
  raceStartTime?: string; // ISO datetime string
  notes?: string;
  trackPoints: RaceTrackPoint[];
  waypointComparisons: WaypointComparison[];
}

export interface RaceAnalysisResponse {
  id: number;
  routeId: number;
  routeName: string;
  raceName: string;
  raceDate?: string;
  actualGpxFilename: string;
  totalRaceTimeSeconds: number;
  totalActualDistanceMeters: number;
  raceStartTime?: string;
  notes?: string;
  createdAt: string;
  waypointCount: number;
  trackPointCount?: number;
}

export interface RaceAnalysisDetail extends RaceAnalysisResponse {
  comparisonData: Array<{
    id: number;
    waypointId: number;
    waypointName: string;
    waypointType: string;
    plannedCumulativeTime: number;
    actualCumulativeTime?: number;
    timeDifference?: number;
    legDuration?: number;
    legDistance?: number;
    actualPace?: number;
    plannedPace?: number;
  }>;
  trackPointsData: Array<{
    lat: number;
    lon: number;
    elevation?: number;
    cumulativeTime: number;
    cumulativeDistance: number;
  }>;
}

class RaceAnalysisApi {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Save a new race analysis
   */
  async saveRaceAnalysis(analysisData: RaceAnalysisCreate): Promise<{ id: number; message: string }> {
    const response = await fetch(`${API_BASE_URL}/race-analysis/`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(analysisData),
    });

    return this.handleResponse(response);
  }

  /**
   * Get all race analyses for the current user
   */
  async getUserRaceAnalyses(): Promise<RaceAnalysisResponse[]> {
    const response = await fetch(`${API_BASE_URL}/race-analysis/`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Get race analyses for a specific route
   */
  async getRouteRaceAnalyses(routeId: number): Promise<RaceAnalysisResponse[]> {
    const response = await fetch(`${API_BASE_URL}/race-analysis/route/${routeId}`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Get detailed race analysis with comparisons and track points
   */
  async getRaceAnalysisDetail(analysisId: number): Promise<RaceAnalysisDetail> {
    const response = await fetch(`${API_BASE_URL}/race-analysis/${analysisId}`, {
      method: 'GET',
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  /**
   * Delete a race analysis
   */
  async deleteRaceAnalysis(analysisId: number): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/race-analysis/${analysisId}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }
}

export const raceAnalysisApi = new RaceAnalysisApi(); 