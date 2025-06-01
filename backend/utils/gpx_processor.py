"""
GPX File Processing Module

This module handles parsing of GPX XML files and converting them 
to the format expected by the database.
"""

import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, List, Any, Optional
import math
import logging

logger = logging.getLogger(__name__)


def process_gpx_content(gpx_content: str, filename: str) -> Dict[str, Any]:
    """
    Process GPX XML content and return route data in database format.
    
    Args:
        gpx_content: Raw GPX XML content as string
        filename: Original filename for the route
        
    Returns:
        Dictionary containing route data in the format expected by the database
    """
    try:
        # Parse XML
        root = ET.fromstring(gpx_content)
        
        # Find namespace - handle default namespace properly
        namespace = {'gpx': 'http://www.topografix.com/GPX/1/1'}  # Default GPX namespace
        if root.tag.startswith('{'):
            # Extract namespace from root tag
            ns_uri = root.tag[1:].split('}')[0]
            namespace = {'gpx': ns_uri}
        
        # Extract track points
        track_points = []
        waypoints = []
        
        # Process tracks - try both with and without namespace
        tracks = root.findall('.//gpx:trk', namespace)
        if not tracks:
            tracks = root.findall('.//trk')  # Fallback without namespace
            
        for track in tracks:
            track_segments = track.findall('.//gpx:trkseg', namespace)
            if not track_segments:
                track_segments = track.findall('.//trkseg')
                
            for segment in track_segments:
                points = segment.findall('.//gpx:trkpt', namespace)
                if not points:
                    points = segment.findall('.//trkpt')
                
                for point in points:
                    lat = float(point.get('lat', 0))
                    lon = float(point.get('lon', 0))
                    
                    # Extract elevation - try both namespace and no namespace
                    ele_elem = point.find('gpx:ele', namespace)
                    if ele_elem is None:
                        ele_elem = point.find('ele')
                    elevation = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0.0
                    
                    # Extract time - try both namespace and no namespace  
                    time_elem = point.find('gpx:time', namespace)
                    if time_elem is None:
                        time_elem = point.find('time')
                    time_str = None
                    if time_elem is not None and time_elem.text:
                        try:
                            # Parse ISO 8601 time format
                            time_str = datetime.fromisoformat(time_elem.text.replace('Z', '+00:00')).isoformat()
                        except ValueError:
                            # Try alternative time formats
                            for fmt in ['%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%SZ']:
                                try:
                                    time_str = datetime.strptime(time_elem.text.rstrip('Z'), fmt.rstrip('Z')).isoformat()
                                    break
                                except ValueError:
                                    continue
                    
                    track_points.append({
                        'latitude': lat,
                        'longitude': lon,
                        'elevation': elevation,
                        'time': time_str
                    })
        
        # Process waypoints - try both namespace and no namespace
        wpt_elements = root.findall('.//gpx:wpt', namespace)
        if not wpt_elements:
            wpt_elements = root.findall('.//wpt')
            
        for wpt in wpt_elements:
            lat = float(wpt.get('lat', 0))
            lon = float(wpt.get('lon', 0))
            
            name_elem = wpt.find('gpx:name', namespace)
            if name_elem is None:
                name_elem = wpt.find('name')
            name = name_elem.text if name_elem is not None else ''
            
            desc_elem = wpt.find('gpx:desc', namespace)
            if desc_elem is None:
                desc_elem = wpt.find('desc')
            description = desc_elem.text if desc_elem is not None else ''
            
            waypoints.append({
                'latitude': lat,
                'longitude': lon,
                'name': name,
                'description': description,
                'type': 'waypoint'
            })
        
        if not track_points:
            raise ValueError("No track points found in GPX file")
        
        # Calculate route statistics
        route_stats = calculate_route_statistics(track_points)
        
        # Check if time data is valid
        has_valid_time = any(point.get('time') for point in track_points)
        
        # Get start time if available
        start_time = None
        if has_valid_time:
            for point in track_points:
                if point.get('time'):
                    start_time = point['time']
                    break
        
        # Prepare route data
        route_data = {
            'filename': filename,
            'totalDistance': route_stats['total_distance'],
            'totalElevationGain': route_stats['elevation_gain'],
            'totalElevationLoss': route_stats['elevation_loss'],
            'hasValidTime': has_valid_time,
            'startTime': start_time,
            'trackPoints': track_points,
            'waypoints': waypoints
        }
        
        logger.info(f"Processed GPX file {filename}: {len(track_points)} track points, "
                   f"{route_stats['total_distance']:.1f}m distance, "
                   f"{route_stats['elevation_gain']:.1f}m elevation gain")
        
        return route_data
        
    except ET.ParseError as e:
        logger.error(f"XML parsing error in GPX file {filename}: {e}")
        raise ValueError(f"Invalid GPX XML format: {e}")
    except Exception as e:
        logger.error(f"Error processing GPX file {filename}: {e}")
        raise ValueError(f"Error processing GPX file: {e}")


def calculate_route_statistics(track_points: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Calculate basic route statistics from track points.
    
    Args:
        track_points: List of track point dictionaries
        
    Returns:
        Dictionary containing route statistics
    """
    if len(track_points) < 2:
        return {
            'total_distance': 0.0,
            'elevation_gain': 0.0,
            'elevation_loss': 0.0
        }
    
    total_distance = 0.0
    elevation_gain = 0.0
    elevation_loss = 0.0
    
    for i in range(1, len(track_points)):
        prev_point = track_points[i - 1]
        curr_point = track_points[i]
        
        # Calculate distance between points
        distance = haversine_distance(
            prev_point['latitude'], prev_point['longitude'],
            curr_point['latitude'], curr_point['longitude']
        )
        total_distance += distance
        
        # Calculate elevation changes
        prev_elevation = prev_point.get('elevation', 0)
        curr_elevation = curr_point.get('elevation', 0)
        elevation_diff = curr_elevation - prev_elevation
        
        if elevation_diff > 0:
            elevation_gain += elevation_diff
        else:
            elevation_loss += abs(elevation_diff)
    
    return {
        'total_distance': total_distance,
        'elevation_gain': elevation_gain,
        'elevation_loss': elevation_loss
    }


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points on Earth.
    
    Args:
        lat1, lon1: Latitude and longitude of first point in decimal degrees
        lat2, lon2: Latitude and longitude of second point in decimal degrees
        
    Returns:
        Distance in meters
    """
    # Convert to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Haversine formula
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    
    # Earth's radius in meters
    earth_radius = 6371000
    
    return earth_radius * c 