import React from 'react';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import { useAppStore } from '../store/useAppStore';
import { 
  secondsToHHMMSS, 
  formatPacePerMile,
  calculateWaypointDistances,
  calculateElevationAdjustedLegTimes,
  getElevationAdjustmentSummary,
  calculateLegTimeWithSlowdown,
  calculateLegAveragePace,
  calculatePaceSecondsPerMile,
  getPaceRangeInfo
} from '../utils/timeUtils';

interface PdfExportProps {
  className?: string;
}

export default function PdfExport({ className = '' }: PdfExportProps) {
  const {
    currentRoute,
    fileInfo,
    routeWaypoints,
    trackPoints,
    targetTimeSeconds,
    slowdownFactorPercent
  } = useAppStore();

  // Calculate total distance in miles
  const totalDistanceMiles = React.useMemo(() => {
    if (currentRoute?.totalDistance) {
      return currentRoute.totalDistance / 1609.34; // Convert meters to miles
    } else if (fileInfo?.totalDistance) {
      return fileInfo.totalDistance; // Already in miles
    }
    return 0;
  }, [currentRoute, fileInfo]);

  // Calculate total rest time from waypoints
  const totalRestTimeSeconds = React.useMemo(() => {
    if (!routeWaypoints?.length) return 0;
    return routeWaypoints.reduce((total: number, waypoint: any) => {
      return total + (waypoint.rest_time_seconds || 0);
    }, 0);
  }, [routeWaypoints]);

  const generatePDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = margin;

      // Title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      const title = currentRoute?.filename || fileInfo?.filename || 'Route Plan';
      doc.text(title, margin, yPosition);
      yPosition += 15;

      // Subtitle with date
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, yPosition);
      yPosition += 20;

      // Route Overview Section
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Route Overview', margin, yPosition);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const overviewData = [
        `Total Distance: ${totalDistanceMiles.toFixed(2)} miles`,
        `Waypoints: ${routeWaypoints?.length || 0}`,
        `Track Points: ${trackPoints?.length || 0}`,
      ];

      // Note: Description not available in current route format

      // Add elevation data if available
      if (trackPoints && trackPoints.length > 0 && trackPoints.some(p => p.elevation !== undefined)) {
        const elevations = trackPoints.filter(p => p.elevation !== undefined).map(p => p.elevation!);
        const minElevation = Math.min(...elevations);
        const maxElevation = Math.max(...elevations);
        overviewData.push(`Elevation Range: ${minElevation.toFixed(0)} - ${maxElevation.toFixed(0)} ft`);
      }

      overviewData.forEach(line => {
        doc.text(line, margin, yPosition);
        yPosition += 6;
      });
      yPosition += 10;

      // Pace Planning Section (only if target time is set)
      if (targetTimeSeconds && targetTimeSeconds > 0) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Pace Planning', margin, yPosition);
        yPosition += 10;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const overallPaceSecondsPerMile = calculatePaceSecondsPerMile(targetTimeSeconds, totalDistanceMiles);
        const movingTimeSeconds = targetTimeSeconds - totalRestTimeSeconds;
        const paceRangeInfo = getPaceRangeInfo(movingTimeSeconds, totalDistanceMiles, slowdownFactorPercent);

        const paceData = [
          `Target Time: ${secondsToHHMMSS(targetTimeSeconds)}`,
          `Overall Pace: ${formatPacePerMile(overallPaceSecondsPerMile)} per mile`,
          `Moving Time: ${secondsToHHMMSS(movingTimeSeconds)}`,
          `Rest Time: ${secondsToHHMMSS(totalRestTimeSeconds)}`,
        ];

        if (paceRangeInfo.isConstant) {
          paceData.push(`Moving Pace: ${paceRangeInfo.averagePace} per mile (constant)`);
        } else {
          paceData.push(`Moving Pace: ${paceRangeInfo.startPace} → ${paceRangeInfo.endPace} per mile`);
          paceData.push(`Average Moving Pace: ${paceRangeInfo.averagePace} per mile`);
          paceData.push(`Slowdown Factor: ${slowdownFactorPercent}%`);
        }

        paceData.forEach(line => {
          doc.text(line, margin, yPosition);
          yPosition += 6;
        });
        yPosition += 10;

        // Elevation Summary
        if (routeWaypoints && routeWaypoints.length > 0 && trackPoints && trackPoints.length > 0) {
          const waypointsWithDistances = calculateWaypointDistances(routeWaypoints, trackPoints, totalDistanceMiles);
          const elevationSummary = getElevationAdjustmentSummary(waypointsWithDistances);
          
          if (elevationSummary) {
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Elevation Summary', margin, yPosition);
            yPosition += 8;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            
            const elevationData = [
              `Total Elevation Gain: ${Math.round(elevationSummary.totalGainFeet).toLocaleString()} ft`,
              `Total Elevation Loss: ${Math.round(elevationSummary.totalLossFeet).toLocaleString()} ft`,
              `Average Gain per Mile: ${Math.round(elevationSummary.avgGainPerMile)} ft/mi`,
              `Average Loss per Mile: ${Math.round(elevationSummary.avgLossPerMile)} ft/mi`,
              'Note: Leg paces are adjusted +5% per 30ft excess climb, -4% per 30ft excess descent'
            ];

            elevationData.forEach(line => {
              doc.text(line, margin, yPosition);
              yPosition += 6;
            });
            yPosition += 10;
          }
        }

        // Leg-by-Leg Breakdown
        if (routeWaypoints && routeWaypoints.length > 0 && trackPoints && trackPoints.length > 0) {
          // Check if we need a new page
          if (yPosition > 200) {
            doc.addPage();
            yPosition = margin;
          }

          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text('Leg-by-Leg Breakdown', margin, yPosition);
          yPosition += 10;

          // Prepare leg breakdown data
          const waypointsWithDistances = calculateWaypointDistances(routeWaypoints, trackPoints, totalDistanceMiles);
          const elevationAdjustedWaypoints = calculateElevationAdjustedLegTimes(
            waypointsWithDistances,
            movingTimeSeconds,
            slowdownFactorPercent
          );

          let cumulativeTime = 0;
          let routeCumulativeDistance = 0;

          // Table headers
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          const headers = ['Leg', 'Dist', 'Base Pace', 'Elev Pace', 'Leg Time', 'Cum Time', 'Rest'];
          const colWidths = [35, 20, 25, 25, 20, 20, 20];
          let xPos = margin;

          headers.forEach((header, i) => {
            doc.text(header, xPos, yPosition);
            xPos += colWidths[i];
          });
          yPosition += 5;

          // Draw line under headers
          doc.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 3;

          // Table data
          doc.setFont('helvetica', 'normal');
          for (let index = 0; index < elevationAdjustedWaypoints.length; index++) {
            const waypoint = elevationAdjustedWaypoints[index];
            const legStartDistance = routeCumulativeDistance;
            const legDistance = waypoint.legDistance;
            const legEndDistance = legStartDistance + legDistance;

            const legTime = waypoint.elevationAdjustedLegTime || calculateLegTimeWithSlowdown(
              legStartDistance,
              legEndDistance,
              totalDistanceMiles,
              movingTimeSeconds,
              slowdownFactorPercent
            );

            const legAveragePace = calculateLegAveragePace(
              legStartDistance,
              legEndDistance,
              totalDistanceMiles,
              movingTimeSeconds,
              slowdownFactorPercent
            );

            const restTime = waypoint.rest_time_seconds || 0;
            cumulativeTime += legTime;

            // Check if we need a new page
            if (yPosition > 270) {
              doc.addPage();
              yPosition = margin;
            }

            xPos = margin;
            const rowData = [
              waypoint.name || `Leg ${index + 1}`,
              `${legDistance.toFixed(1)}mi`,
              formatPacePerMile(legAveragePace),
              waypoint.elevationAdjustedPaceDisplay || formatPacePerMile(legAveragePace),
              secondsToHHMMSS(legTime),
              secondsToHHMMSS(cumulativeTime),
              restTime > 0 ? secondsToHHMMSS(restTime) : '-'
            ];

            rowData.forEach((data, i) => {
              doc.text(data, xPos, yPosition);
              xPos += colWidths[i];
            });
            yPosition += 5;

            cumulativeTime += restTime;
            routeCumulativeDistance = legEndDistance;
          }
          yPosition += 5;
        }
      }

      // Waypoint Details Section
      if (routeWaypoints && routeWaypoints.length > 0) {
        // Check if we need a new page
        if (yPosition > 200) {
          doc.addPage();
          yPosition = margin;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Waypoint Details', margin, yPosition);
        yPosition += 10;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');

        routeWaypoints.forEach((waypoint: any, index: number) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = margin;
          }

          doc.setFont('helvetica', 'bold');
          doc.text(`${index + 1}. ${waypoint.name || waypoint.leg_name || `Waypoint ${index + 1}`}`, margin, yPosition);
          yPosition += 5;

          doc.setFont('helvetica', 'normal');
          const waypointDetails = [];
          
          if (waypoint.cumulative_distance !== undefined) {
            waypointDetails.push(`   Distance: ${waypoint.cumulative_distance.toFixed(2)} miles`);
          }
          if (waypoint.elevation !== undefined) {
            waypointDetails.push(`   Elevation: ${waypoint.elevation.toFixed(0)} ft`);
          }
          if (waypoint.rest_time_seconds) {
            waypointDetails.push(`   Rest Time: ${secondsToHHMMSS(waypoint.rest_time_seconds)}`);
          }
          if (waypoint.notes) {
            waypointDetails.push(`   Notes: ${waypoint.notes}`);
          }

          waypointDetails.forEach(detail => {
            doc.text(detail, margin, yPosition);
            yPosition += 4;
          });
          yPosition += 3;
        });
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Page ${i} of ${pageCount} - Generated by Route Planner`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Generate filename
      const fileName = currentRoute?.filename || fileInfo?.filename || 'route-plan';
      const sanitizedFileName = fileName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const timestamp = new Date().toISOString().split('T')[0];
      
      // Save the PDF
      doc.save(`${sanitizedFileName}_plan_${timestamp}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // Don't show the button if there's no route data
  if (!totalDistanceMiles || totalDistanceMiles <= 0) {
    return null;
  }

  return (
    <button
      onClick={generatePDF}
      className={`inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors ${className}`}
    >
      <Download className="h-4 w-4 mr-2" />
      Export PDF Plan
    </button>
  );
} 