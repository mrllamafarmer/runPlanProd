interface RouteVisualizationProps {
  trackPoints: any[];
}

export default function RouteVisualization({ trackPoints }: RouteVisualizationProps) {
  return (
    <div className="bg-yellow-50 p-4 rounded-lg">
      <h3 className="font-semibold text-yellow-800">Route Visualization</h3>
      <p className="text-yellow-700">Map and elevation chart will go here</p>
      <p className="text-yellow-700">Track points: {trackPoints.length}</p>
    </div>
  );
} 