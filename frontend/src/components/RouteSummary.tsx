import { useAppStore } from '../store/useAppStore';
import PdfExport from './PdfExport';

interface RouteSummaryProps {
  fileInfo: any;
}

export default function RouteSummary({ fileInfo }: RouteSummaryProps) {
  const { currentRoute } = useAppStore();
  
  // Determine which data source to use
  const routeName = currentRoute?.filename || fileInfo?.filename || 'Unknown Route';
  
  // For distance, check both sources and use the non-zero one
  let totalDistanceMeters = 0;
  if (currentRoute?.totalDistance && currentRoute.totalDistance > 0) {
    totalDistanceMeters = currentRoute.totalDistance;
  } else if (fileInfo?.totalDistance && fileInfo.totalDistance > 0) {
    totalDistanceMeters = fileInfo.totalDistance;
  }
  
  // Convert meters to miles (1 meter = 0.000621371 miles)
  const distanceInMiles = totalDistanceMeters * 0.000621371;
  
  const trackPointCount = fileInfo?.trackPointCount || 0;
  const hasValidTime = currentRoute?.hasValidTime || fileInfo?.hasValidTime || false;
  
  return (
    <div className="bg-green-50 p-4 rounded-lg">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-green-800">Route Information</h3>
          <p className="text-green-700">Route: {routeName}</p>
          <p className="text-green-700">Distance: {distanceInMiles.toFixed(1)} miles</p>
          <p className="text-green-700">Track Points: {trackPointCount}</p>
          {hasValidTime && (
            <p className="text-green-700">✓ Contains time data</p>
          )}
        </div>
        <PdfExport className="mt-1" />
      </div>
    </div>
  );
} 