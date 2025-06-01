interface RouteSummaryProps {
  fileInfo: any;
}

export default function RouteSummary({ fileInfo }: RouteSummaryProps) {
  return (
    <div className="bg-green-50 p-4 rounded-lg">
      <h3 className="font-semibold text-green-800">Route Information</h3>
      <p className="text-green-700">File: {fileInfo?.filename}</p>
      <p className="text-green-700">Distance: {fileInfo?.totalDistance?.toFixed(2)} miles</p>
      <p className="text-green-700">Track Points: {fileInfo?.trackPointCount}</p>
    </div>
  );
} 