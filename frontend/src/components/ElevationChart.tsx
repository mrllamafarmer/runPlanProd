import React, { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { TrackPoint, Waypoint } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ElevationChartProps {
  trackPoints: TrackPoint[];
  waypoints?: Waypoint[];
  height?: string;
}

export default function ElevationChart({ 
  trackPoints, 
  waypoints = [], 
  height = '400px' 
}: ElevationChartProps) {
  const chartRef = useRef(null);

  // Prepare chart data
  const chartData = React.useMemo(() => {
    if (trackPoints.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    // Filter track points with elevation data
    const pointsWithElevation = trackPoints.filter(point => 
      point.elevation !== undefined && point.elevation !== null
    );

    if (pointsWithElevation.length === 0) {
      return {
        labels: ['No elevation data'],
        datasets: [{
          label: 'Elevation',
          data: [0],
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          tension: 0.1
        }]
      };
    }

    // Calculate cumulative distance for x-axis
    let cumulativeDistance = 0;
    const distances = [0];
    
    for (let i = 1; i < pointsWithElevation.length; i++) {
      const prev = pointsWithElevation[i - 1];
      const curr = pointsWithElevation[i];
      
      // Calculate distance between points using Haversine formula
      const R = 3959; // Earth radius in miles
      const dLat = (curr.lat - prev.lat) * Math.PI / 180;
      const dLon = (curr.lon - prev.lon) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      
      cumulativeDistance += distance;
      distances.push(cumulativeDistance);
    }

    // Create labels (distance in miles)
    const labels = distances.map(d => d.toFixed(1));

    // Elevation data
    const elevationData = pointsWithElevation.map(point => point.elevation!);

    // Find waypoint positions on the chart
    const waypointAnnotations = waypoints.map(waypoint => {
      // Find closest track point to waypoint
      let closestIndex = 0;
      let minDistance = Infinity;
      
      pointsWithElevation.forEach((point, index) => {
        const distance = Math.sqrt(
          Math.pow(point.lat - waypoint.latitude, 2) + 
          Math.pow(point.lon - waypoint.longitude, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });

      return {
        index: closestIndex,
        distance: distances[closestIndex],
        elevation: pointsWithElevation[closestIndex].elevation,
        name: waypoint.legName || `Leg ${waypoint.legNumber}`
      };
    });

    return {
      labels,
      datasets: [
        {
          label: 'Elevation (ft)',
          data: elevationData,
          borderColor: 'rgb(37, 99, 235)',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          fill: true,
          tension: 0.1,
          pointRadius: 1,
          pointHoverRadius: 4
        }
      ],
      waypointAnnotations
    };
  }, [trackPoints, waypoints]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Elevation Profile'
      },
      tooltip: {
        callbacks: {
          title: (tooltipItems: any[]) => {
            const item = tooltipItems[0];
            return `Distance: ${item.label} miles`;
          },
          label: (tooltipItem: any) => {
            return `Elevation: ${tooltipItem.raw.toFixed(0)} ft`;
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Distance (miles)'
        },
        ticks: {
          maxTicksLimit: 10
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Elevation (feet)'
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    }
  };

  if (trackPoints.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 -m-8 mb-4">
          <h3 className="font-semibold text-gray-800">Elevation Profile</h3>
        </div>
        <div className="text-center text-gray-500">
          <p>No track points available for elevation chart</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">Elevation Profile</h3>
      </div>
      <div className="p-4" style={{ height }}>
        <Line ref={chartRef} data={chartData} options={chartOptions} />
        
        {/* Waypoint indicators */}
        {chartData.waypointAnnotations && chartData.waypointAnnotations.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            <h4 className="font-medium mb-2">Waypoints:</h4>
            <div className="flex flex-wrap gap-2">
              {chartData.waypointAnnotations.map((waypoint, index) => (
                <span 
                  key={index}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                >
                  {waypoint.name} - {waypoint.distance.toFixed(1)} mi
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 