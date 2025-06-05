/**
 * Utility functions for time formatting and conversion
 */

/**
 * Convert seconds to mm:ss format
 * @param seconds - Time in seconds
 * @returns Formatted time string in mm:ss format
 */
export function secondsToMMSS(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Convert mm:ss format to seconds
 * @param timeString - Time string in mm:ss format
 * @returns Time in seconds, or 0 if invalid format
 */
export function mmssToSeconds(timeString: string): number {
  if (!timeString || typeof timeString !== 'string') return 0;
  
  const parts = timeString.split(':');
  if (parts.length !== 2) return 0;
  
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  
  if (isNaN(minutes) || isNaN(seconds) || seconds >= 60 || seconds < 0) return 0;
  if (minutes < 0) return 0;
  
  return minutes * 60 + seconds;
}

/**
 * Validate mm:ss time format
 * @param timeString - Time string to validate
 * @returns True if valid mm:ss format
 */
export function isValidMMSS(timeString: string): boolean {
  if (!timeString || typeof timeString !== 'string') return false;
  
  const regex = /^\d{1,}:\d{2}$/;
  if (!regex.test(timeString)) return false;
  
  const parts = timeString.split(':');
  const minutes = parseInt(parts[0], 10);
  const seconds = parseInt(parts[1], 10);
  
  return !isNaN(minutes) && !isNaN(seconds) && seconds >= 0 && seconds < 60 && minutes >= 0;
}

/**
 * Format rest time for display with appropriate units
 * @param seconds - Rest time in seconds
 * @returns Human-readable rest time string
 */
export function formatRestTime(seconds: number): string {
  if (!seconds || seconds <= 0) return 'No rest';
  
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  let result = `${hours}h`;
  if (minutes > 0) result += ` ${minutes}m`;
  if (remainingSeconds > 0) result += ` ${remainingSeconds}s`;
  
  return result;
}

/**
 * Convert seconds to HH:MM:SS format (for times > 24 hours)
 * @param seconds - Time in seconds
 * @returns Formatted time string in HH:MM:SS format
 */
export function secondsToHHMMSS(seconds: number): string {
  if (!seconds || seconds < 0) return '00:00:00';
  
  // Round to avoid floating point precision issues
  const totalSeconds = Math.round(seconds);
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Convert HH:MM:SS format to seconds (supports times > 24 hours)
 * @param timeString - Time string in HH:MM:SS format
 * @returns Time in seconds, or 0 if invalid format
 */
export function hhmmssToSeconds(timeString: string): number {
  if (!timeString || typeof timeString !== 'string') return 0;
  
  const parts = timeString.split(':');
  if (parts.length !== 3) return 0;
  
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  
  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return 0;
  if (hours < 0 || minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60) return 0;
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Validate HH:MM:SS time format (supports times > 24 hours)
 * @param timeString - Time string to validate
 * @returns True if valid HH:MM:SS format
 */
export function isValidHHMMSS(timeString: string): boolean {
  if (!timeString || typeof timeString !== 'string') return false;
  
  const regex = /^\d{1,}:\d{2}:\d{2}$/;
  if (!regex.test(timeString)) return false;
  
  const parts = timeString.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const seconds = parseInt(parts[2], 10);
  
  return !isNaN(hours) && !isNaN(minutes) && !isNaN(seconds) && 
         hours >= 0 && minutes >= 0 && minutes < 60 && seconds >= 0 && seconds < 60;
}

/**
 * Calculate pace in seconds per mile
 * @param totalTimeSeconds - Total time in seconds
 * @param distanceMiles - Distance in miles
 * @returns Pace in seconds per mile
 */
export function calculatePaceSecondsPerMile(totalTimeSeconds: number, distanceMiles: number): number {
  if (!totalTimeSeconds || !distanceMiles || distanceMiles <= 0) return 0;
  return totalTimeSeconds / distanceMiles;
}

/**
 * Format pace as MM:SS per mile
 * @param paceSecondsPerMile - Pace in seconds per mile
 * @returns Formatted pace string (e.g., "08:30 per mile")
 */
export function formatPacePerMile(paceSecondsPerMile: number): string {
  if (!paceSecondsPerMile || paceSecondsPerMile <= 0) return '00:00 per mile';
  
  const minutes = Math.floor(paceSecondsPerMile / 60);
  const seconds = Math.floor(paceSecondsPerMile % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} per mile`;
}

/**
 * Calculate pace at a specific distance with linear slowdown factor
 * @param distanceFromStart - Distance from start in miles
 * @param totalDistance - Total route distance in miles
 * @param averagePaceSeconds - Average pace in seconds per mile
 * @param slowdownFactorPercent - Slowdown percentage (0-100)
 * @returns Pace in seconds per mile at the specified distance
 */
export function calculatePaceAtDistance(
  distanceFromStart: number,
  totalDistance: number,
  averagePaceSeconds: number,
  slowdownFactorPercent: number
): number {
  if (slowdownFactorPercent === 0 || totalDistance <= 0) {
    return averagePaceSeconds;
  }

  const slowdownFactor = slowdownFactorPercent / 100;
  const progressRatio = distanceFromStart / totalDistance;
  
  // Linear interpolation: startPace * (1 + slowdownFactor * progressRatio)
  // We need to find startPace such that the average equals averagePaceSeconds
  const startPace = averagePaceSeconds / (1 + slowdownFactor / 2);
  
  return startPace * (1 + slowdownFactor * progressRatio);
}

/**
 * Calculate time for a specific leg with variable pacing
 * @param legStartDistance - Starting distance of the leg in miles
 * @param legEndDistance - Ending distance of the leg in miles
 * @param totalDistance - Total route distance in miles
 * @param totalMovingTimeSeconds - Total moving time in seconds
 * @param slowdownFactorPercent - Slowdown percentage (0-100)
 * @returns Time for the leg in seconds
 */
export function calculateLegTimeWithSlowdown(
  legStartDistance: number,
  legEndDistance: number,
  totalDistance: number,
  totalMovingTimeSeconds: number,
  slowdownFactorPercent: number
): number {
  if (slowdownFactorPercent === 0 || totalDistance <= 0) {
    // Constant pace case
    const legDistance = legEndDistance - legStartDistance;
    return (legDistance / totalDistance) * totalMovingTimeSeconds;
  }

  const slowdownFactor = slowdownFactorPercent / 100;
  const averagePace = totalMovingTimeSeconds / totalDistance;
  const startPace = averagePace / (1 + slowdownFactor / 2);
  
  // For linear pace degradation, we need to integrate the pace function
  // over the leg distance. The pace function is: pace(x) = startPace * (1 + slowdownFactor * x/totalDistance)
  // Integrating from legStartDistance to legEndDistance:
  // ∫[legStartDistance to legEndDistance] startPace * (1 + slowdownFactor * x/totalDistance) dx
  
  const legDistance = legEndDistance - legStartDistance;
  const startProgress = legStartDistance / totalDistance;
  const endProgress = legEndDistance / totalDistance;
  
  // Integration result: startPace * [x + slowdownFactor * x²/(2*totalDistance)]
  const integralEnd = legEndDistance + (slowdownFactor * legEndDistance * legEndDistance) / (2 * totalDistance);
  const integralStart = legStartDistance + (slowdownFactor * legStartDistance * legStartDistance) / (2 * totalDistance);
  
  return startPace * (integralEnd - integralStart);
}

/**
 * Calculate average pace for a specific leg with variable pacing
 * @param legStartDistance - Starting distance of the leg in miles
 * @param legEndDistance - Ending distance of the leg in miles  
 * @param totalDistance - Total route distance in miles
 * @param totalMovingTimeSeconds - Total moving time in seconds
 * @param slowdownFactorPercent - Slowdown percentage (0-100)
 * @returns Average pace for the leg in seconds per mile
 */
export function calculateLegAveragePace(
  legStartDistance: number,
  legEndDistance: number,
  totalDistance: number,
  totalMovingTimeSeconds: number,
  slowdownFactorPercent: number
): number {
  const legTime = calculateLegTimeWithSlowdown(
    legStartDistance,
    legEndDistance,
    totalDistance,
    totalMovingTimeSeconds,
    slowdownFactorPercent
  );
  
  const legDistance = legEndDistance - legStartDistance;
  if (legDistance <= 0) return 0;
  
  return legTime / legDistance;
}

/**
 * Get pace range information for display
 * @param totalMovingTimeSeconds - Total moving time in seconds
 * @param totalDistance - Total distance in miles
 * @param slowdownFactorPercent - Slowdown percentage (0-100)
 * @returns Object with start pace, end pace, and average pace
 */
export function getPaceRangeInfo(
  totalMovingTimeSeconds: number,
  totalDistance: number,
  slowdownFactorPercent: number
): {
  startPace: string;
  endPace: string;
  averagePace: string;
  isConstant: boolean;
} {
  const averagePaceSeconds = totalMovingTimeSeconds / totalDistance;
  
  if (slowdownFactorPercent === 0) {
    return {
      startPace: formatPacePerMile(averagePaceSeconds),
      endPace: formatPacePerMile(averagePaceSeconds),
      averagePace: formatPacePerMile(averagePaceSeconds),
      isConstant: true
    };
  }
  
  const slowdownFactor = slowdownFactorPercent / 100;
  const startPaceSeconds = averagePaceSeconds / (1 + slowdownFactor / 2);
  const endPaceSeconds = startPaceSeconds * (1 + slowdownFactor);
  
  return {
    startPace: formatPacePerMile(startPaceSeconds),
    endPace: formatPacePerMile(endPaceSeconds),
    averagePace: formatPacePerMile(averagePaceSeconds),
    isConstant: false
  };
}

/**
 * Calculate elevation gain and loss between two waypoints using track point indices
 * @param startWaypoint - Starting waypoint with lat/lon
 * @param endWaypoint - Ending waypoint with lat/lon  
 * @param trackPoints - Array of track points
 * @returns Object with elevation gain and loss in meters
 */
export function calculateElevationGainLossBetweenWaypoints(
  startWaypoint: any,
  endWaypoint: any,
  trackPoints: any[]
): { elevationGain: number; elevationLoss: number } {
  if (trackPoints.length === 0) {
    return { elevationGain: 0, elevationLoss: 0 };
  }

  // Find the closest track point indices for start and end waypoints
  const findClosestTrackPointIndex = (waypoint: any): number => {
    let closestIndex = 0;
    let minDistance = Number.MAX_VALUE;
    
    for (let i = 0; i < trackPoints.length; i++) {
      const tp = trackPoints[i];
      if (tp.lat === undefined || tp.lon === undefined) continue;
      
      // Calculate Haversine distance
      const R = 6371000; // Earth's radius in meters
      const toRadians = (degrees: number) => degrees * (Math.PI / 180);
      
      const dLat = toRadians(waypoint.latitude - tp.lat);
      const dLon = toRadians(waypoint.longitude - tp.lon);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(toRadians(tp.lat)) * Math.cos(toRadians(waypoint.latitude)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    
    return closestIndex;
  };

  const startIndex = findClosestTrackPointIndex(startWaypoint);
  const endIndex = findClosestTrackPointIndex(endWaypoint);
  
  // Ensure we have a valid range
  if (startIndex >= endIndex) {
    return { elevationGain: 0, elevationLoss: 0 };
  }

  console.log(`Calculating elevation between indices ${startIndex} and ${endIndex}`);

  let elevationGain = 0;
  let elevationLoss = 0;

  // Calculate elevation changes between consecutive track points in the range
  for (let i = startIndex + 1; i <= endIndex && i < trackPoints.length; i++) {
    const prevElevation = trackPoints[i - 1].elevation || 0;
    const currentElevation = trackPoints[i].elevation || 0;
    
    const elevationChange = currentElevation - prevElevation;
    
    if (elevationChange > 0) {
      elevationGain += elevationChange;
    } else {
      elevationLoss += Math.abs(elevationChange);
    }
  }

  console.log(`Elevation gain: ${elevationGain}m, loss: ${elevationLoss}m`);

  return { elevationGain, elevationLoss };
}

/**
 * Format elevation gain/loss for display
 * @param elevationGainMeters - Elevation gain in meters
 * @param elevationLossMeters - Elevation loss in meters
 * @returns Formatted string like "+1,100 / -2,100"
 */
export function formatElevationGainLoss(elevationGainMeters: number, elevationLossMeters: number): string {
  // Convert meters to feet
  const gainFeet = Math.round(elevationGainMeters * 3.28084);
  const lossFeet = Math.round(elevationLossMeters * 3.28084);
  
  if (gainFeet === 0 && lossFeet === 0) {
    return 'No change';
  }
  
  // Format with commas for thousands
  const formatNumber = (num: number) => num.toLocaleString();
  
  return `+${formatNumber(gainFeet)} / -${formatNumber(lossFeet)}`;
}

/**
 * Calculate waypoint distances along track points
 * @param waypoints - Array of waypoints
 * @param trackPoints - Array of track points
 * @param actualRouteDistanceMiles - Actual route distance in miles (optional, for fallback calculation)
 * @returns Array of waypoints with legDistance, cumulativeDistance, and elevation data
 */
export function calculateWaypointDistances(waypoints: any[], trackPoints: any[], actualRouteDistanceMiles?: number): Array<any & { 
  legDistance: number; 
  cumulativeDistance: number;
  legElevationGain?: number;
  legElevationLoss?: number;
  elevationGainLossDisplay?: string;
}> {
  if (waypoints.length === 0 || trackPoints.length === 0) return [];
  
  const sortedWaypoints = [...waypoints].sort((a, b) => a.order_index - b.order_index);
  
  // Helper function for distance calculation
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 3.959; // Earth's radius in miles
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };
  
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  
  // Check if track points have valid cumulative distance data
  const hasValidCumulativeDistance = trackPoints.length > 0 && 
    trackPoints.some(tp => tp.cumulativeDistance !== undefined && tp.cumulativeDistance > 0);
  
  if (hasValidCumulativeDistance) {
    // Use track point cumulative distances (Method 1 - Preferred)
    const results = [];
    let previousCumulativeDistance = 0;
    
    for (let i = 0; i < sortedWaypoints.length; i++) {
      const waypoint = sortedWaypoints[i];
      
      // Find the closest track point to this waypoint
      let closestCumulativeDistance = 0;
      let minDistance = Number.MAX_VALUE;
      
      for (let j = 0; j < trackPoints.length; j++) {
        const tp = trackPoints[j];
        if (tp.lat === undefined || tp.lon === undefined) continue;
        
        const distance = calculateHaversineDistance(
          waypoint.latitude, waypoint.longitude,
          tp.lat, tp.lon
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          closestCumulativeDistance = tp.cumulativeDistance || 0;
        }
      }
      
      const legDistance = i === 0 ? 0 : Math.max(0, closestCumulativeDistance - previousCumulativeDistance);
      
      // Calculate elevation gain/loss for this leg
      let legElevationGain = 0;
      let legElevationLoss = 0;
      let elevationGainLossDisplay = 'Start';
      
      if (i > 0) {
        const elevationStats = calculateElevationGainLossBetweenWaypoints(
          sortedWaypoints[i - 1],
          sortedWaypoints[i],
          trackPoints
        );
        legElevationGain = elevationStats.elevationGain;
        legElevationLoss = elevationStats.elevationLoss;
        elevationGainLossDisplay = formatElevationGainLoss(legElevationGain, legElevationLoss);
      }
      
      results.push({
        ...waypoint,
        legDistance,
        cumulativeDistance: closestCumulativeDistance,
        legElevationGain,
        legElevationLoss,
        elevationGainLossDisplay
      });
      
      previousCumulativeDistance = closestCumulativeDistance;
    }
    
    // Validate the results
    const totalCalculated = results[results.length - 1]?.cumulativeDistance || 0;
    
    if (totalCalculated > 50 && totalCalculated < 200) {
      // Results look reasonable
      return results;
    }
  }
  
  // Fallback: Use the known total distance and distribute proportionally based on waypoint spacing
  
  // Calculate relative positions of waypoints along the route
  let totalStraightLineDistance = 0;
  const straightLineDistances = [];
  
  for (let i = 0; i < sortedWaypoints.length; i++) {
    if (i === 0) {
      straightLineDistances.push(0);
    } else {
      const distance = calculateHaversineDistance(
        sortedWaypoints[i - 1].latitude, sortedWaypoints[i - 1].longitude,
        sortedWaypoints[i].latitude, sortedWaypoints[i].longitude
      );
      straightLineDistances.push(distance);
      totalStraightLineDistance += distance;
    }
  }
  
  // Use actual route distance if provided, otherwise try to calculate from track points
  let knownTotalDistance = actualRouteDistanceMiles || 0;
  
  // If no distance provided, try to get it from track points
  if (!knownTotalDistance && trackPoints.length > 0) {
    const lastTrackPoint = trackPoints[trackPoints.length - 1];
    if (lastTrackPoint?.cumulativeDistance) {
      knownTotalDistance = lastTrackPoint.cumulativeDistance * 0.000621371; // Convert meters to miles
    }
  }
  
  // Final fallback - use straight line distance scaled up by typical route factor
  if (!knownTotalDistance) {
    knownTotalDistance = totalStraightLineDistance * 1.2; // Assume 20% longer than straight line
  }
  
  // Scale the distances proportionally
  const results = [];
  let cumulativeDistance = 0;
  
  for (let i = 0; i < sortedWaypoints.length; i++) {
    const waypoint = sortedWaypoints[i];
    
    let legDistance = 0;
    if (i > 0 && totalStraightLineDistance > 0) {
      // Scale the straight-line distance by the ratio of actual route distance to total straight-line distance
      const scaleFactor = knownTotalDistance / totalStraightLineDistance;
      legDistance = straightLineDistances[i] * scaleFactor;
      cumulativeDistance += legDistance;
    }
    
    // Calculate elevation gain/loss for this leg using the new method
    let legElevationGain = 0;
    let legElevationLoss = 0;
    let elevationGainLossDisplay = 'Start';
    
    if (i > 0) {
      const elevationStats = calculateElevationGainLossBetweenWaypoints(
        sortedWaypoints[i - 1],
        sortedWaypoints[i],
        trackPoints
      );
      legElevationGain = elevationStats.elevationGain;
      legElevationLoss = elevationStats.elevationLoss;
      elevationGainLossDisplay = formatElevationGainLoss(legElevationGain, legElevationLoss);
    }
    
    results.push({
      ...waypoint,
      legDistance,
      cumulativeDistance,
      legElevationGain,
      legElevationLoss,
      elevationGainLossDisplay
    });
  }
  
  return results;
}

/**
 * Calculate elevation-adjusted leg times based on elevation relative to route average
 * @param waypointsWithDistances - Array of waypoints with distances and elevation data
 * @param totalMovingTimeSeconds - Total moving time in seconds
 * @param slowdownFactorPercent - Linear slowdown factor percentage (0-100)
 * @returns Array of waypoints with adjusted leg times and paces
 */
export function calculateElevationAdjustedLegTimes(
  waypointsWithDistances: Array<any & { 
    legDistance: number; 
    cumulativeDistance: number;
    legElevationGain?: number;
    legElevationLoss?: number;
  }>,
  totalMovingTimeSeconds: number,
  slowdownFactorPercent: number = 0
): Array<any & { 
  legDistance: number; 
  cumulativeDistance: number;
  legElevationGain?: number;
  legElevationLoss?: number;
  elevationAdjustedLegTime?: number;
  elevationAdjustedPace?: number;
  elevationAdjustedPaceDisplay?: string;
}> {
  if (waypointsWithDistances.length === 0 || totalMovingTimeSeconds <= 0) {
    return waypointsWithDistances;
  }

  // Calculate route totals
  const totalDistance = waypointsWithDistances[waypointsWithDistances.length - 1]?.cumulativeDistance || 0;
  if (totalDistance <= 0) return waypointsWithDistances;

  const totalElevationGain = waypointsWithDistances.reduce((sum, wp) => sum + (wp.legElevationGain || 0), 0);
  const totalElevationLoss = waypointsWithDistances.reduce((sum, wp) => sum + (wp.legElevationLoss || 0), 0);
  
  // Calculate route average elevation rates (in meters per mile)
  const routeAvgGainPerMile = totalElevationGain / totalDistance;
  const routeAvgLossPerMile = totalElevationLoss / totalDistance;

  // Apply linear slowdown factor first to get base leg times
  const baseLegTimes = waypointsWithDistances.map((waypoint, index) => {
    if (index === 0 || waypoint.legDistance <= 0) return 0;
    
    return calculateLegTimeWithSlowdown(
      waypoint.cumulativeDistance - waypoint.legDistance,
      waypoint.cumulativeDistance,
      totalDistance,
      totalMovingTimeSeconds,
      slowdownFactorPercent
    );
  });

  // Calculate elevation multipliers for each leg
  const elevationMultipliers = waypointsWithDistances.map((waypoint, index) => {
    if (index === 0 || waypoint.legDistance <= 0) return 1.0;

    const legGainPerMile = (waypoint.legElevationGain || 0) / waypoint.legDistance;
    const legLossPerMile = (waypoint.legElevationLoss || 0) / waypoint.legDistance;
    
    // Calculate excess elevation gain/loss compared to route average
    const excessGainPerMile = legGainPerMile - routeAvgGainPerMile;
    const excessLossPerMile = legLossPerMile - routeAvgLossPerMile;
    
    // Convert meters to feet for the 30ft increment calculations
    const excessGainFeetPerMile = excessGainPerMile * 3.28084;
    const excessLossFeetPerMile = excessLossPerMile * 3.28084;
    
    // Apply 5% slowdown per 30ft excess gain, 4% speedup per 30ft excess loss
    const gainMultiplier = 1 + (excessGainFeetPerMile / 30) * 0.05;
    const lossMultiplier = 1 - (excessLossFeetPerMile / 30) * 0.04;
    
    // Combine the multipliers
    return gainMultiplier * lossMultiplier;
  });

  // Apply elevation multipliers to base leg times
  const elevationAdjustedTimes = baseLegTimes.map((baseTime, index) => {
    return baseTime * elevationMultipliers[index];
  });

  // Calculate scaling factor to maintain total moving time
  const totalAdjustedTime = elevationAdjustedTimes.reduce((sum, time) => sum + time, 0);
  const scalingFactor = totalAdjustedTime > 0 ? totalMovingTimeSeconds / totalAdjustedTime : 1;

  // Apply scaling factor and calculate final values
  return waypointsWithDistances.map((waypoint, index) => {
    const elevationAdjustedLegTime = elevationAdjustedTimes[index] * scalingFactor;
    const elevationAdjustedPace = waypoint.legDistance > 0 ? elevationAdjustedLegTime / waypoint.legDistance : 0;
    const elevationAdjustedPaceDisplay = elevationAdjustedPace > 0 ? formatPacePerMile(elevationAdjustedPace) : '';

    return {
      ...waypoint,
      elevationAdjustedLegTime,
      elevationAdjustedPace,
      elevationAdjustedPaceDisplay
    };
  });
}

/**
 * Get elevation adjustment summary for a route
 * @param waypointsWithDistances - Array of waypoints with elevation data
 * @returns Summary of elevation adjustments
 */
export function getElevationAdjustmentSummary(
  waypointsWithDistances: Array<any & { 
    legDistance: number; 
    cumulativeDistance: number;
    legElevationGain?: number;
    legElevationLoss?: number;
  }>
): {
  totalGainFeet: number;
  totalLossFeet: number;
  avgGainPerMile: number;
  avgLossPerMile: number;
  totalDistance: number;
} {
  if (waypointsWithDistances.length === 0) {
    return {
      totalGainFeet: 0,
      totalLossFeet: 0,
      avgGainPerMile: 0,
      avgLossPerMile: 0,
      totalDistance: 0
    };
  }

  const totalDistance = waypointsWithDistances[waypointsWithDistances.length - 1]?.cumulativeDistance || 0;
  const totalElevationGain = waypointsWithDistances.reduce((sum, wp) => sum + (wp.legElevationGain || 0), 0);
  const totalElevationLoss = waypointsWithDistances.reduce((sum, wp) => sum + (wp.legElevationLoss || 0), 0);

  // Convert meters to feet
  const totalGainFeet = totalElevationGain * 3.28084;
  const totalLossFeet = totalElevationLoss * 3.28084;
  
  const avgGainPerMile = totalDistance > 0 ? totalGainFeet / totalDistance : 0;
  const avgLossPerMile = totalDistance > 0 ? totalLossFeet / totalDistance : 0;

  return {
    totalGainFeet,
    totalLossFeet,
    avgGainPerMile,
    avgLossPerMile,
    totalDistance
  };
} 