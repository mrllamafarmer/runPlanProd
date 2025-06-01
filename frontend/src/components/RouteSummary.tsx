interface RouteSummaryProps {
  fileInfo: any;
}

export default function RouteSummary({ fileInfo }: RouteSummaryProps) {
  // Convert meters to miles (1 meter = 0.000621371 miles)
  const distanceInMiles = fileInfo?.totalDistance ? (fileInfo.totalDistance * 0.000621371) : 0;
  
  return (
    <div className="bg-green-50 p-4 rounded-lg">
      <h3 className="font-semibold text-green-800">Route Information</h3>
      <p className="text-green-700">File: {fileInfo?.filename}</p>
      <p className="text-green-700">Distance: {distanceInMiles.toFixed(1)} miles</p>
      <p className="text-green-700">Track Points: {fileInfo?.trackPointCount}</p>
    </div>
  );
} 