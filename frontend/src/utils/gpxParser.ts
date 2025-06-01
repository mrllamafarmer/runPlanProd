import { TrackPoint, FileInfo } from '../types';

/**
 * Calculate the Haversine distance between two points
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Radius of Earth in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Parse GPX file and extract track points
 */
export function parseGPX(xmlString: string, filename: string): {
  trackPoints: TrackPoint[];
  fileInfo: FileInfo;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');
  
  // Check for parsing errors
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid GPX file format');
  }
  
  const trackPoints: TrackPoint[] = [];
  const trkpts = doc.querySelectorAll('trkpt');
  
  if (trkpts.length === 0) {
    throw new Error('No track points found in GPX file');
  }
  
  let hasValidTime = false;
  let startTime: string | undefined;
  let endTime: string | undefined;
  
  trkpts.forEach((trkpt) => {
    const lat = parseFloat(trkpt.getAttribute('lat') || '0');
    const lon = parseFloat(trkpt.getAttribute('lon') || '0');
    
    if (isNaN(lat) || isNaN(lon)) {
      return; // Skip invalid points
    }
    
    const eleElement = trkpt.querySelector('ele');
    const timeElement = trkpt.querySelector('time');
    
    const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : undefined;
    const time = timeElement?.textContent || undefined;
    
    if (time && !hasValidTime) {
      hasValidTime = true;
      startTime = time;
    }
    
    if (time) {
      endTime = time;
    }
    
    trackPoints.push({
      lat,
      lon,
      elevation,
      time,
      distance: 0,
      cumulativeDistance: 0,
    });
  });
  
  // Calculate distances
  const processedPoints = calculateDistances(trackPoints);
  const totalDistance = processedPoints.length > 0 ? 
    processedPoints[processedPoints.length - 1].cumulativeDistance || 0 : 0;
  
  // Calculate elevation gains/losses
  const { totalElevationGain, totalElevationLoss } = calculateElevationStats(processedPoints);
  
  const fileInfo: FileInfo = {
    filename,
    trackPointCount: processedPoints.length,
    hasValidTime,
    startTime,
    endTime,
    totalDistance,
    totalElevationGain,
    totalElevationLoss,
  };
  
  return {
    trackPoints: processedPoints,
    fileInfo,
  };
}

/**
 * Calculate distances between track points
 */
export function calculateDistances(points: TrackPoint[]): TrackPoint[] {
  if (points.length === 0) return points;
  
  const processedPoints = [...points];
  let cumulativeDistance = 0;
  
  for (let i = 0; i < processedPoints.length; i++) {
    if (i === 0) {
      processedPoints[i].distance = 0;
      processedPoints[i].cumulativeDistance = 0;
    } else {
      const distance = haversineDistance(
        processedPoints[i - 1].lat,
        processedPoints[i - 1].lon,
        processedPoints[i].lat,
        processedPoints[i].lon
      );
      
      cumulativeDistance += distance;
      processedPoints[i].distance = distance;
      processedPoints[i].cumulativeDistance = cumulativeDistance;
    }
  }
  
  return processedPoints;
}

/**
 * Calculate total elevation gain and loss
 */
export function calculateElevationStats(points: TrackPoint[]): {
  totalElevationGain: number;
  totalElevationLoss: number;
} {
  let totalGain = 0;
  let totalLoss = 0;
  
  for (let i = 1; i < points.length; i++) {
    const prevElevation = points[i - 1].elevation;
    const currentElevation = points[i].elevation;
    
    if (prevElevation !== undefined && currentElevation !== undefined) {
      const elevationChange = currentElevation - prevElevation;
      
      if (elevationChange > 0) {
        totalGain += elevationChange;
      } else {
        totalLoss += Math.abs(elevationChange);
      }
    }
  }
  
  return {
    totalElevationGain: totalGain,
    totalElevationLoss: totalLoss,
  };
}

/**
 * Find the track point at a specific distance
 */
export function findPointAtDistance(points: TrackPoint[], targetDistance: number): TrackPoint | null {
  if (points.length === 0) return null;
  
  // Find the closest point
  let closestPoint = points[0];
  let minDiff = Math.abs((closestPoint.cumulativeDistance || 0) - targetDistance);
  
  for (const point of points) {
    const diff = Math.abs((point.cumulativeDistance || 0) - targetDistance);
    if (diff < minDiff) {
      minDiff = diff;
      closestPoint = point;
    }
  }
  
  return closestPoint;
}

/**
 * Format time in seconds to HH:MM:SS
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format pace in seconds per mile to MM:SS/mile
 */
export function formatPace(secondsPerMile: number): string {
  const minutes = Math.floor(secondsPerMile / 60);
  const seconds = Math.floor(secondsPerMile % 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}/mi`;
}

/**
 * Convert target time to seconds
 */
export function targetTimeToSeconds(hours: number, minutes: number, seconds: number): number {
  return (hours * 3600) + (minutes * 60) + seconds;
}

/**
 * Convert seconds to target time object
 */
export function secondsToTargetTime(totalSeconds: number): { hours: number; minutes: number; seconds: number } {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  return { hours, minutes, seconds };
}

/**
 * Generate sample test data for demonstration
 */
export function generateSampleData(): {
  trackPoints: TrackPoint[];
  fileInfo: FileInfo;
} {
  const startLat = 40.7128;
  const startLon = -74.0060;
  const points: TrackPoint[] = [];
  
  // Generate 100 points along a route
  for (let i = 0; i < 100; i++) {
    const lat = startLat + (i * 0.001) + (Math.random() - 0.5) * 0.0005;
    const lon = startLon + (i * 0.001) + (Math.random() - 0.5) * 0.0005;
    const elevation = 100 + (Math.sin(i * 0.1) * 50) + (Math.random() - 0.5) * 20;
    const time = new Date(Date.now() + i * 60000).toISOString(); // 1 minute intervals
    
    points.push({
      lat,
      lon,
      elevation,
      time,
      distance: 0,
      cumulativeDistance: 0,
    });
  }
  
  const processedPoints = calculateDistances(points);
  const totalDistance = processedPoints[processedPoints.length - 1].cumulativeDistance || 0;
  const { totalElevationGain, totalElevationLoss } = calculateElevationStats(processedPoints);
  
  const fileInfo: FileInfo = {
    filename: 'sample_route.gpx',
    trackPointCount: processedPoints.length,
    hasValidTime: true,
    startTime: points[0].time,
    endTime: points[points.length - 1].time,
    totalDistance,
    totalElevationGain,
    totalElevationLoss,
  };
  
  return {
    trackPoints: processedPoints,
    fileInfo,
  };
} 