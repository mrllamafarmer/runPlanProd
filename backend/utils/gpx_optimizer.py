"""
GPX Track Optimization for Storage Efficiency

This module implements intelligent track point reduction while preserving:
- Route shape accuracy
- Elevation profile integrity  
- Turn points and significant features
- Distance calculation accuracy
"""

import math
from typing import List, Tuple, Dict, Any
from dataclasses import dataclass


@dataclass
class TrackPoint:
    """Represents a simplified track point with essential data."""
    latitude: float
    longitude: float
    elevation: float
    distance_from_start: float


class GPXOptimizer:
    """Optimizes GPX tracks for storage efficiency while maintaining accuracy."""
    
    def __init__(self, 
                 distance_tolerance: float = 10.0,  # meters
                 elevation_tolerance: float = 5.0,   # meters
                 max_points_per_km: int = 20):       # maximum density
        """
        Initialize optimizer with quality vs storage trade-off parameters.
        
        Args:
            distance_tolerance: Maximum deviation from original track (meters)
            elevation_tolerance: Maximum elevation deviation (meters)  
            max_points_per_km: Maximum point density for very detailed tracks
        """
        self.distance_tolerance = distance_tolerance
        self.elevation_tolerance = elevation_tolerance
        self.max_points_per_km = max_points_per_km
    
    def optimize_track(self, track_points: List[Dict[str, float]]) -> List[TrackPoint]:
        """
        Optimize a track using multi-step approach:
        1. Remove redundant points (straight lines, no elevation change)
        2. Apply Douglas-Peucker for shape preservation
        3. Preserve elevation features
        4. Ensure minimum point density for accurate calculations
        
        Args:
            track_points: List of dicts with lat, lng, elevation keys
            
        Returns:
            List of optimized TrackPoint objects
        """
        if len(track_points) < 3:
            return self._convert_to_track_points(track_points)
        
        # Step 1: Calculate distances and basic cleanup
        processed_points = self._add_distance_data(track_points)
        
        # Step 2: Remove redundant points (straight segments, no elevation change)
        filtered_points = self._remove_redundant_points(processed_points)
        
        # Step 3: Apply Douglas-Peucker algorithm for shape preservation
        simplified_points = self._douglas_peucker(filtered_points, self.distance_tolerance)
        
        # Step 4: Preserve elevation features
        elevation_preserved = self._preserve_elevation_features(
            processed_points, simplified_points
        )
        
        # Step 5: Ensure minimum point density for accurate distance calculations
        final_points = self._ensure_minimum_density(elevation_preserved)
        
        return self._convert_to_track_points(final_points)
    
    def _add_distance_data(self, points: List[Dict[str, float]]) -> List[Dict[str, Any]]:
        """Add cumulative distance and segment data to points."""
        processed = []
        total_distance = 0.0
        
        for i, point in enumerate(points):
            if i > 0:
                segment_distance = self._haversine_distance(
                    points[i-1]['latitude'], points[i-1]['longitude'],
                    point['latitude'], point['longitude']
                )
                total_distance += segment_distance
            
            processed.append({
                **point,
                'distance_from_start': total_distance,
                'index': i
            })
        
        return processed
    
    def _remove_redundant_points(self, points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove points that don't add significant value."""
        if len(points) < 3:
            return points
        
        filtered = [points[0]]  # Always keep first point
        
        for i in range(1, len(points) - 1):
            prev_point = filtered[-1]
            curr_point = points[i]
            next_point = points[i + 1]
            
            # Keep point if it represents a significant change
            should_keep = (
                self._is_significant_direction_change(prev_point, curr_point, next_point) or
                self._is_significant_elevation_change(prev_point, curr_point, next_point) or
                self._is_significant_distance_gap(prev_point, curr_point)
            )
            
            if should_keep:
                filtered.append(curr_point)
        
        filtered.append(points[-1])  # Always keep last point
        return filtered
    
    def _douglas_peucker(self, points: List[Dict[str, Any]], tolerance: float) -> List[Dict[str, Any]]:
        """Apply Douglas-Peucker algorithm for line simplification."""
        if len(points) < 3:
            return points
        
        # Find the point with maximum distance from line between first and last
        max_distance = 0
        max_index = 0
        
        for i in range(1, len(points) - 1):
            distance = self._perpendicular_distance(
                points[i], points[0], points[-1]
            )
            if distance > max_distance:
                max_distance = distance
                max_index = i
        
        # If max distance is greater than tolerance, recursively simplify
        if max_distance > tolerance:
            # Recursively simplify both parts
            left_part = self._douglas_peucker(points[:max_index + 1], tolerance)
            right_part = self._douglas_peucker(points[max_index:], tolerance)
            
            # Combine results (remove duplicate point at junction)
            return left_part[:-1] + right_part
        else:
            # Return only endpoints if within tolerance
            return [points[0], points[-1]]
    
    def _preserve_elevation_features(self, 
                                   original_points: List[Dict[str, Any]], 
                                   simplified_points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Add back points that represent significant elevation changes."""
        elevation_features = []
        
        for point in original_points:
            elevation = point.get('elevation', 0)
            
            # Check if this point represents a significant elevation feature
            # that might have been simplified away
            is_elevation_feature = self._is_elevation_peak_or_valley(
                original_points, point['index']
            )
            
            if is_elevation_feature:
                elevation_features.append(point)
        
        # Merge elevation features back into simplified points
        all_points = simplified_points + elevation_features
        
        # Sort by distance and remove duplicates
        all_points.sort(key=lambda x: x['distance_from_start'])
        
        # Remove points that are too close together
        merged = []
        for point in all_points:
            if not merged or self._haversine_distance(
                merged[-1]['latitude'], merged[-1]['longitude'],
                point['latitude'], point['longitude']
            ) > 5.0:  # Minimum 5m separation
                merged.append(point)
        
        return merged
    
    def _ensure_minimum_density(self, points: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Ensure minimum point density for accurate distance calculations."""
        if len(points) < 2:
            return points
        
        total_distance = points[-1]['distance_from_start']
        total_distance_km = total_distance / 1000.0
        max_total_points = int(total_distance_km * self.max_points_per_km)
        
        if len(points) <= max_total_points:
            return points
        
        # If we have too many points, sample uniformly while preserving key features
        step = len(points) / max_total_points
        sampled = []
        
        for i in range(max_total_points):
            index = int(i * step)
            if index < len(points):
                sampled.append(points[index])
        
        # Always include the last point
        if sampled[-1] != points[-1]:
            sampled.append(points[-1])
        
        return sampled
    
    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points using Haversine formula."""
        R = 6371000  # Earth's radius in meters
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_lat / 2) ** 2 + 
             math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    def _perpendicular_distance(self, point: Dict[str, Any], 
                              line_start: Dict[str, Any], 
                              line_end: Dict[str, Any]) -> float:
        """Calculate perpendicular distance from point to line segment."""
        # Convert to approximate Cartesian coordinates for distance calculation
        # This is an approximation but sufficient for the Douglas-Peucker algorithm
        
        x0, y0 = point['longitude'], point['latitude']
        x1, y1 = line_start['longitude'], line_start['latitude']
        x2, y2 = line_end['longitude'], line_end['latitude']
        
        # Calculate perpendicular distance using cross product
        numerator = abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1)
        denominator = math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2)
        
        if denominator == 0:
            return 0
        
        # Convert back to meters (approximate)
        distance_degrees = numerator / denominator
        return distance_degrees * 111000  # Rough conversion to meters
    
    def _is_significant_direction_change(self, p1: Dict[str, Any], 
                                       p2: Dict[str, Any], 
                                       p3: Dict[str, Any]) -> bool:
        """Check if point represents a significant direction change."""
        # Calculate bearing change
        bearing1 = self._calculate_bearing(p1, p2)
        bearing2 = self._calculate_bearing(p2, p3)
        
        angle_change = abs(bearing2 - bearing1)
        if angle_change > 180:
            angle_change = 360 - angle_change
        
        return angle_change > 15  # 15 degree threshold
    
    def _is_significant_elevation_change(self, p1: Dict[str, Any], 
                                       p2: Dict[str, Any], 
                                       p3: Dict[str, Any]) -> bool:
        """Check if point represents significant elevation change."""
        e1 = p1.get('elevation', 0)
        e2 = p2.get('elevation', 0)
        e3 = p3.get('elevation', 0)
        
        # Check if p2 is a local min/max
        if (e2 > e1 and e2 > e3) or (e2 < e1 and e2 < e3):
            elevation_change = max(abs(e2 - e1), abs(e2 - e3))
            return elevation_change > self.elevation_tolerance
        
        return False
    
    def _is_significant_distance_gap(self, p1: Dict[str, Any], p2: Dict[str, Any]) -> bool:
        """Check if there's a significant distance gap requiring a point."""
        distance = p2['distance_from_start'] - p1['distance_from_start']
        return distance > 100  # Keep points at least every 100m
    
    def _calculate_bearing(self, p1: Dict[str, Any], p2: Dict[str, Any]) -> float:
        """Calculate bearing between two points."""
        lat1 = math.radians(p1['latitude'])
        lat2 = math.radians(p2['latitude'])
        delta_lon = math.radians(p2['longitude'] - p1['longitude'])
        
        y = math.sin(delta_lon) * math.cos(lat2)
        x = (math.cos(lat1) * math.sin(lat2) - 
             math.sin(lat1) * math.cos(lat2) * math.cos(delta_lon))
        
        bearing = math.atan2(y, x)
        return math.degrees(bearing)
    
    def _is_elevation_peak_or_valley(self, points: List[Dict[str, Any]], index: int) -> bool:
        """Check if point is an elevation peak or valley."""
        if index <= 0 or index >= len(points) - 1:
            return False
        
        window_size = min(5, len(points) // 10)  # Look at nearby points
        start_idx = max(0, index - window_size)
        end_idx = min(len(points), index + window_size + 1)
        
        current_elevation = points[index].get('elevation', 0)
        nearby_elevations = [p.get('elevation', 0) for p in points[start_idx:end_idx] if p != points[index]]
        
        if not nearby_elevations:
            return False
        
        is_peak = current_elevation > max(nearby_elevations)
        is_valley = current_elevation < min(nearby_elevations)
        
        return is_peak or is_valley
    
    def _convert_to_track_points(self, points: List[Dict[str, Any]]) -> List[TrackPoint]:
        """Convert optimized points to TrackPoint objects."""
        return [
            TrackPoint(
                latitude=p['latitude'],
                longitude=p['longitude'],
                elevation=p.get('elevation', 0),
                distance_from_start=p.get('distance_from_start', 0)
            )
            for p in points
        ]
    
    def calculate_compression_stats(self, original_count: int, optimized_count: int) -> Dict[str, Any]:
        """Calculate compression statistics."""
        compression_ratio = ((original_count - optimized_count) / original_count * 100) if original_count > 0 else 0
        
        return {
            'original_points': original_count,
            'optimized_points': optimized_count,
            'compression_ratio': compression_ratio,
            'storage_reduction': f"{compression_ratio:.1f}%"
        } 