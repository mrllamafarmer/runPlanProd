interface RoutePlanningTableProps {
  trackPoints: any[];
}

export default function RoutePlanningTable({ trackPoints }: RoutePlanningTableProps) {
  return (
    <div className="bg-purple-50 p-4 rounded-lg">
      <h3 className="font-semibold text-purple-800">Route Planning Table</h3>
      <p className="text-purple-700">Interactive waypoint table will go here</p>
      <p className="text-purple-700">Track points: {trackPoints.length}</p>
    </div>
  );
} 