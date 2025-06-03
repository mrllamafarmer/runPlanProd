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
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
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