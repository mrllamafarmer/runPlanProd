"""
PostgreSQL Database Operations and Connection Management

This module handles all database connections and operations for the GPX Route Analyzer.
Migrated from SQLite to PostgreSQL for production multi-user support.
"""

import os
import json
import psycopg2
import psycopg2.extras
import hashlib
from contextlib import contextmanager
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

from exceptions import DatabaseError, ValidationError
from logging_config import get_logger

logger = get_logger(__name__)

# Database configuration from environment variables
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://runplan_user:runplan_secure_password_123@localhost:5433/runplanprod"
)

def get_db_connection():
    """
    Create a new database connection.
    
    Returns:
        psycopg2.connection: Database connection object
        
    Raises:
        DatabaseError: If connection fails
    """
    try:
        conn = psycopg2.connect(
            DATABASE_URL,
            cursor_factory=psycopg2.extras.RealDictCursor
        )
        conn.autocommit = False  # Use transactions
        return conn
    except psycopg2.Error as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        raise DatabaseError(f"Database connection failed: {str(e)}")

@contextmanager
def get_db_cursor():
    """
    Context manager for database operations with automatic connection cleanup.
    
    Yields:
        psycopg2.cursor: Database cursor
        
    Example:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT * FROM routes")
            results = cursor.fetchall()
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        yield cursor
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database operation failed: {str(e)}")
        raise DatabaseError(f"Database operation failed: {str(e)}")
    finally:
        if conn:
            conn.close()

def init_database():
    """
    Initialize database tables if they don't exist.
    This is called on application startup.
    """
    try:
        with get_db_cursor() as cursor:
            # Check if users table exists (indicator that schema is initialized)
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'users'
                );
            """)
            
            result = cursor.fetchone()
            table_exists = result['exists'] if result else False
            
            if not table_exists:
                logger.info("Database tables not found. Schema will be initialized by Docker.")
            else:
                logger.info("Database tables already exist.")
                
    except Exception as e:
        logger.error(f"Error checking database initialization: {str(e)}")
        raise DatabaseError(f"Database initialization check failed: {str(e)}")

# Route Management Functions
def save_route_data(user_id: int, route_data: Dict[str, Any]) -> int:
    """
    Save a new route to the database.
    
    Args:
        user_id: ID of the user creating the route
        route_data: Dictionary containing route information
        
    Returns:
        int: The ID of the created route
        
    Raises:
        DatabaseError: If save operation fails
    """
    try:
        with get_db_cursor() as cursor:
            # Handle both API format ('name') and GPX format ('filename')
            route_name = route_data.get('name') or route_data.get('filename', 'Unnamed Route')
            
            # Handle distance - could be in meters (GPX) or kilometers (API)
            total_distance = route_data.get('totalDistance', 0)
            if total_distance > 1000:  # Assume it's in meters if > 1000
                total_distance_meters = total_distance
            else:  # Assume it's in kilometers
                total_distance_meters = total_distance * 1000
            
            cursor.execute("""
                INSERT INTO routes (
                    user_id, name, description, total_distance_meters,
                    total_elevation_gain_meters, estimated_time_seconds, is_public
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                user_id,
                route_name,
                route_data.get('description'),
                total_distance_meters,
                route_data.get('totalElevationGain', 0),
                route_data.get('targetTimeSeconds', 0),
                route_data.get('is_public', False)
            ))
            
            result = cursor.fetchone()
            route_id = result['id'] if result else None
            
            if not route_id:
                raise DatabaseError("Failed to create route - no ID returned")
            
            # Save waypoints if provided
            waypoints = route_data.get('waypoints', [])
            start_waypoint_id = None
            end_waypoint_id = None
            
            for i, waypoint in enumerate(waypoints):
                # Handle both formats for waypoint data
                waypoint_name = (waypoint.get('name') or 
                               waypoint.get('legName') or 
                               f'Waypoint {i+1}')
                
                cursor.execute("""
                    INSERT INTO waypoints (
                        route_id, name, latitude, longitude, elevation_meters,
                        order_index, waypoint_type
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    route_id,
                    waypoint_name,
                    waypoint.get('latitude'),
                    waypoint.get('longitude'),
                    waypoint.get('elevation'),
                    i,
                    'start' if i == 0 else ('finish' if i == len(waypoints)-1 else 'checkpoint')
                ))
                
                waypoint_result = cursor.fetchone()
                if i == 0:
                    start_waypoint_id = waypoint_result['id'] if waypoint_result else None
                elif i == len(waypoints) - 1:
                    end_waypoint_id = waypoint_result['id'] if waypoint_result else None
            
            # Save track points if provided
            track_points = route_data.get('trackPoints', [])
            logger.info(f"Processing {len(track_points)} track points for route {route_id}")
            if track_points:
                # Create default waypoints from track points if none provided
                if not waypoints:
                    logger.info("Creating default waypoints from track points")
                    # Create start and end waypoints from first and last track points
                    first_point = track_points[0]
                    last_point = track_points[-1]
                    
                    # Create start waypoint
                    cursor.execute("""
                        INSERT INTO waypoints (
                            route_id, name, latitude, longitude, elevation_meters,
                            order_index, waypoint_type
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        route_id, 'Start', 
                        first_point.get('latitude', first_point.get('lat')),
                        first_point.get('longitude', first_point.get('lon')),
                        first_point.get('elevation'), 0, 'start'
                    ))
                    start_waypoint_id = cursor.fetchone()['id']
                    logger.info(f"Created start waypoint with ID: {start_waypoint_id}")
                    
                    # Create end waypoint
                    cursor.execute("""
                        INSERT INTO waypoints (
                            route_id, name, latitude, longitude, elevation_meters,
                            order_index, waypoint_type
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        route_id, 'Finish', 
                        last_point.get('latitude', last_point.get('lat')),
                        last_point.get('longitude', last_point.get('lon')),
                        last_point.get('elevation'), 1, 'finish'
                    ))
                    end_waypoint_id = cursor.fetchone()['id']
                    logger.info(f"Created end waypoint with ID: {end_waypoint_id}")
                
                # Save track points directly to route (no route segments needed)
                logger.info(f"Saving {len(track_points)} track points to route {route_id}")
                for i, point in enumerate(track_points):
                    cursor.execute("""
                        INSERT INTO track_points (
                            route_id, latitude, longitude, elevation_meters,
                            cumulative_distance_meters, point_index
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        route_id,
                        point.get('latitude', point.get('lat')),  # Support both formats
                        point.get('longitude', point.get('lon')),  # Support both formats
                        point.get('elevation'),
                        point.get('cumulativeDistance', point.get('distance', 0)),
                        i
                    ))
                
                logger.info(f"Saved {len(track_points)} track points for route {route_id}")
                
                # Save GPX file metadata
                file_content = route_data.get('gpxData', route_name)  # Use GPX data if available, otherwise filename
                file_hash = hashlib.sha256(file_content.encode('utf-8')).hexdigest()
                
                cursor.execute("""
                    INSERT INTO gpx_files (
                        route_id, original_filename, file_hash,
                        original_point_count, simplified_point_count, compression_ratio
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    route_id,
                    route_name,
                    file_hash,
                    len(track_points),  # Original points (TODO: could be different if we had raw GPX point count)
                    len(track_points),  # Simplified points (same for now, until optimization implemented)
                    1.0  # Compression ratio (1.0 = no compression for now)
                ))
                
                logger.info(f"Saved GPX file metadata for route {route_id}")
            
            logger.info(f"Route saved successfully for user {user_id} with ID {route_id}")
            return route_id
            
    except Exception as e:
        logger.error(f"Error saving route data for user {user_id}: {str(e)}")
        raise DatabaseError(f"Failed to save route: {str(e)}")

def get_user_routes(user_id: int) -> List[Dict[str, Any]]:
    """
    Get all routes for a specific user.
    
    Args:
        user_id: The user's ID
        
    Returns:
        List of route dictionaries
    """
    try:
        with get_db_cursor() as cursor:
            cursor.execute("""
                SELECT 
                    id, name, description, total_distance_meters,
                    total_elevation_gain_meters, total_elevation_loss_meters,
                    target_time_seconds, slowdown_factor_percent, start_time,
                    created_at, updated_at, is_public
                FROM routes 
                WHERE user_id = %s 
                ORDER BY updated_at DESC
            """, (user_id,))
            
            routes = cursor.fetchall()
            
            # Convert to list of dicts and format for API response
            result = []
            for route in routes:
                result.append({
                    'id': str(route['id']),
                    'filename': route['name'],
                    'upload_date': route['created_at'].isoformat() if route['created_at'] else None,
                    'total_distance': route['total_distance_meters'] / 1000,  # Convert to km
                    'total_elevation_gain': route['total_elevation_gain_meters'],
                    'total_elevation_loss': route['total_elevation_loss_meters'] or 0,
                    'target_time_seconds': route['target_time_seconds'],
                    'slowdown_factor_percent': route['slowdown_factor_percent'],
                    'start_time': str(route['start_time']) if route['start_time'] else None,
                    'is_public': route['is_public']
                })
            
            return result
            
    except Exception as e:
        logger.error(f"Error getting routes for user {user_id}: {str(e)}")
        raise DatabaseError(f"Failed to get user routes: {str(e)}")

def get_route_detail(route_id: str, user_id: int) -> Optional[Dict[str, Any]]:
    """
    Get detailed route information including waypoints and track points.
    
    Args:
        route_id: The route ID
        user_id: The requesting user's ID (for access control)
        
    Returns:
        Route detail dictionary or None if not found/accessible
    """
    try:
        with get_db_cursor() as cursor:
            # Check route access and get route data
            cursor.execute("""
                SELECT r.*, u.username
                FROM routes r
                JOIN users u ON r.user_id = u.id
                WHERE r.id = %s AND (r.user_id = %s OR r.is_public = TRUE)
            """, (route_id, user_id))
            
            route = cursor.fetchone()
            if not route:
                return None
            
            # Get waypoints
            cursor.execute("""
                SELECT * FROM waypoints 
                WHERE route_id = %s 
                ORDER BY order_index
            """, (route_id,))
            waypoints = cursor.fetchall()
            
            # Get track points directly from route
            cursor.execute("""
                SELECT latitude, longitude, elevation_meters,
                       cumulative_distance_meters, point_index
                FROM track_points
                WHERE route_id = %s
                ORDER BY point_index
            """, (route_id,))
            track_points = cursor.fetchall()
            
            # Build response
            result = {
                'route': {
                    'id': route['id'],
                    'name': route['name'],
                    'description': route['description'],
                    'totalDistance': route['total_distance_meters'] / 1000,
                    'totalElevationGain': route['total_elevation_gain_meters'],
                    'totalElevationLoss': route['total_elevation_loss_meters'] or 0,
                    'targetTimeSeconds': route['target_time_seconds'],
                    'slowdownFactorPercent': route['slowdown_factor_percent'],
                    'startTime': str(route['start_time']) if route['start_time'] else None,
                    'created_at': route['created_at'].isoformat() if route['created_at'] else None,
                    'owner': route['username'],
                    'is_public': route['is_public']
                },
                'waypoints': [dict(w) for w in waypoints],
                'trackPoints': []
            }
            
            # Process track points
            for point in track_points:
                result['trackPoints'].append({
                    'lat': point['latitude'],
                    'lon': point['longitude'],
                    'elevation': point['elevation_meters'],
                    'distance': point['cumulative_distance_meters']
                })
            
            return result
            
    except Exception as e:
        logger.error(f"Error getting route detail for route {route_id}, user {user_id}: {str(e)}")
        raise DatabaseError(f"Failed to get route detail: {str(e)}")

def delete_route(route_id: str, user_id: int) -> bool:
    """
    Delete a route (only if owned by user).
    
    Args:
        route_id: The route ID to delete
        user_id: The user's ID (for ownership verification)
        
    Returns:
        bool: True if deleted successfully
    """
    try:
        with get_db_cursor() as cursor:
            # Delete route (cascading will handle related tables)
            cursor.execute("""
                DELETE FROM routes 
                WHERE id = %s AND user_id = %s
            """, (route_id, user_id))
            
            deleted_count = cursor.rowcount
            
            if deleted_count > 0:
                logger.info(f"Route {route_id} deleted by user {user_id}")
                return True
            else:
                logger.warning(f"Route {route_id} not found or not owned by user {user_id}")
                return False
                
    except Exception as e:
        logger.error(f"Error deleting route {route_id} for user {user_id}: {str(e)}")
        raise DatabaseError(f"Failed to delete route: {str(e)}")

def update_route_data(route_id: str, update_data: Dict[str, Any], user_id: int) -> bool:
    """
    Update a route (only if owned by user).
    
    Args:
        route_id: The route ID to update
        update_data: Dictionary containing fields to update
        user_id: The user's ID (for ownership verification)
        
    Returns:
        bool: True if updated successfully
    """
    try:
        with get_db_cursor() as cursor:
            # Build update query dynamically based on provided fields
            update_fields = []
            values = []
            
            # Map frontend field names to database field names
            field_mapping = {
                'name': 'name',
                'description': 'description',
                'is_public': 'is_public',
                'target_time_seconds': 'target_time_seconds',  # Updated to match current schema
                'slowdown_factor_percent': 'slowdown_factor_percent',
                'start_time': 'start_time'  # TIME type accepts HH:MM format directly
            }
            
            for field, value in update_data.items():
                if field in field_mapping:
                    db_field = field_mapping[field]
                    
                    # Special handling for start_time to ensure proper TIME format
                    if field == 'start_time' and value is not None:
                        # Validate HH:MM format and convert if needed
                        if isinstance(value, str) and ':' in value:
                            try:
                                # Validate time format
                                time_parts = value.split(':')
                                if len(time_parts) >= 2:
                                    hours = int(time_parts[0])
                                    minutes = int(time_parts[1])
                                    if 0 <= hours <= 23 and 0 <= minutes <= 59:
                                        # Format as HH:MM for TIME type
                                        formatted_time = f"{hours:02d}:{minutes:02d}"
                                        update_fields.append(f"{db_field} = %s")
                                        values.append(formatted_time)
                                        continue
                            except (ValueError, IndexError):
                                logger.warning(f"Invalid start_time format: {value}, skipping")
                                continue
                        else:
                            logger.warning(f"Invalid start_time value: {value}, skipping")
                            continue
                    
                    update_fields.append(f"{db_field} = %s")
                    values.append(value)
            
            if not update_fields:
                logger.warning(f"No valid fields to update for route {route_id}")
                return False
            
            # Add updated_at timestamp
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            
            # Add WHERE clause parameters
            values.extend([route_id, user_id])
            
            # Execute update with ownership check
            query = f"""
                UPDATE routes 
                SET {', '.join(update_fields)}
                WHERE id = %s AND user_id = %s
            """
            
            cursor.execute(query, values)
            
            updated_count = cursor.rowcount
            
            if updated_count > 0:
                logger.info(f"Route {route_id} updated by user {user_id}")
                return True
            else:
                logger.warning(f"Route {route_id} not found or not owned by user {user_id}")
                return False
                
    except Exception as e:
        logger.error(f"Error updating route {route_id} for user {user_id}: {str(e)}")
        raise DatabaseError(f"Failed to update route: {str(e)}")

def update_waypoint_notes(route_id: str, waypoint_id: int, notes: str, user_id: int) -> bool:
    """
    Update waypoint notes (only if user owns the route).
    
    Args:
        route_id: The route ID
        waypoint_id: The waypoint ID
        notes: New notes text
        user_id: The user's ID (for ownership verification)
        
    Returns:
        bool: True if updated successfully
    """
    try:
        with get_db_cursor() as cursor:
            # Update waypoint notes with ownership check
            cursor.execute("""
                UPDATE waypoints 
                SET description = %s
                WHERE id = %s 
                AND route_id = %s 
                AND EXISTS (
                    SELECT 1 FROM routes 
                    WHERE id = %s AND user_id = %s
                )
            """, (notes, waypoint_id, route_id, route_id, user_id))
            
            updated_count = cursor.rowcount
            
            if updated_count > 0:
                logger.info(f"Waypoint {waypoint_id} notes updated by user {user_id}")
                return True
            else:
                logger.warning(f"Waypoint {waypoint_id} not found or user {user_id} lacks permission")
                return False
                
    except Exception as e:
        logger.error(f"Error updating waypoint {waypoint_id} notes for user {user_id}: {str(e)}")
        raise DatabaseError(f"Failed to update waypoint notes: {str(e)}")

def create_waypoint(route_id: int, waypoint_data: Dict[str, Any], user_id: int) -> Optional[int]:
    """
    Create a new waypoint for a route (only if user owns the route).
    
    Args:
        route_id: The route ID
        waypoint_data: Waypoint data dictionary
        user_id: The user's ID (for ownership verification)
        
    Returns:
        int: The new waypoint ID if successful
    """
    try:
        with get_db_cursor() as cursor:
            # Verify route ownership
            cursor.execute("""
                SELECT id FROM routes 
                WHERE id = %s AND user_id = %s
            """, (route_id, user_id))
            
            if not cursor.fetchone():
                logger.warning(f"Route {route_id} not found or not owned by user {user_id}")
                return None
            
            # Create waypoint
            cursor.execute("""
                INSERT INTO waypoints (
                    route_id, name, description, latitude, longitude, 
                    elevation_meters, order_index, waypoint_type, target_pace_per_km_seconds,
                    rest_time_seconds
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                route_id,
                waypoint_data.get('name', 'New Waypoint'),
                waypoint_data.get('description'),
                waypoint_data['latitude'],
                waypoint_data['longitude'],
                waypoint_data.get('elevation_meters'),
                waypoint_data.get('order_index', 0),
                waypoint_data.get('waypoint_type', 'checkpoint'),
                waypoint_data.get('target_pace_per_km_seconds'),
                waypoint_data.get('rest_time_seconds', 0)
            ))
            
            waypoint_result = cursor.fetchone()
            waypoint_id = waypoint_result['id'] if waypoint_result else None
            
            if waypoint_id:
                logger.info(f"Waypoint {waypoint_id} created for route {route_id} by user {user_id}")
                return waypoint_id
            else:
                logger.error(f"Failed to create waypoint for route {route_id}")
                return None
                
    except Exception as e:
        logger.error(f"Error creating waypoint for route {route_id}: {str(e)}")
        raise DatabaseError(f"Failed to create waypoint: {str(e)}")

def update_waypoint(waypoint_id: int, waypoint_data: Dict[str, Any], user_id: int) -> bool:
    """
    Update an existing waypoint (only if user owns the route).
    
    Args:
        waypoint_id: The waypoint ID
        waypoint_data: Updated waypoint data dictionary
        user_id: The user's ID (for ownership verification)
        
    Returns:
        bool: True if updated successfully
    """
    try:
        with get_db_cursor() as cursor:
            # Build update query dynamically based on provided fields
            update_fields = []
            values = []
            
            for field, value in waypoint_data.items():
                if field in ['name', 'description', 'latitude', 'longitude', 
                           'elevation_meters', 'order_index', 'waypoint_type', 
                           'target_pace_per_km_seconds', 'rest_time_seconds']:
                    update_fields.append(f"{field} = %s")
                    values.append(value)
            
            if not update_fields:
                logger.warning(f"No valid fields to update for waypoint {waypoint_id}")
                return False
            
            # Add waypoint_id and user_id for WHERE clause
            values.extend([waypoint_id, user_id])
            
            query = f"""
                UPDATE waypoints 
                SET {', '.join(update_fields)}
                WHERE id = %s 
                AND EXISTS (
                    SELECT 1 FROM routes 
                    WHERE id = waypoints.route_id AND user_id = %s
                )
            """
            
            cursor.execute(query, values)
            updated_count = cursor.rowcount
            
            if updated_count > 0:
                logger.info(f"Waypoint {waypoint_id} updated by user {user_id}")
                return True
            else:
                logger.warning(f"Waypoint {waypoint_id} not found or user {user_id} lacks permission")
                return False
                
    except Exception as e:
        logger.error(f"Error updating waypoint {waypoint_id}: {str(e)}")
        raise DatabaseError(f"Failed to update waypoint: {str(e)}")

def delete_waypoint(waypoint_id: int, user_id: int) -> bool:
    """
    Delete a waypoint (only if user owns the route).
    
    Args:
        waypoint_id: The waypoint ID to delete
        user_id: The user's ID (for ownership verification)
        
    Returns:
        bool: True if deleted successfully
    """
    try:
        with get_db_cursor() as cursor:
            # Delete waypoint with ownership check
            cursor.execute("""
                DELETE FROM waypoints 
                WHERE id = %s 
                AND EXISTS (
                    SELECT 1 FROM routes 
                    WHERE id = waypoints.route_id AND user_id = %s
                )
            """, (waypoint_id, user_id))
            
            deleted_count = cursor.rowcount
            
            if deleted_count > 0:
                logger.info(f"Waypoint {waypoint_id} deleted by user {user_id}")
                return True
            else:
                logger.warning(f"Waypoint {waypoint_id} not found or user {user_id} lacks permission")
                return False
                
    except Exception as e:
        logger.error(f"Error deleting waypoint {waypoint_id}: {str(e)}")
        raise DatabaseError(f"Failed to delete waypoint: {str(e)}")

def get_route_waypoints(route_id: int, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Get all waypoints for a route.
    
    Args:
        route_id: The route ID
        user_id: The user's ID (for access control, None for public routes)
        
    Returns:
        List of waypoint dictionaries
    """
    try:
        with get_db_cursor() as cursor:
            # Check route access
            if user_id:
                cursor.execute("""
                    SELECT id FROM routes 
                    WHERE id = %s AND (user_id = %s OR is_public = TRUE)
                """, (route_id, user_id))
            else:
                cursor.execute("""
                    SELECT id FROM routes 
                    WHERE id = %s AND is_public = TRUE
                """, (route_id,))
            
            if not cursor.fetchone():
                logger.warning(f"Route {route_id} not found or not accessible to user {user_id}")
                return []
            
            # Get waypoints
            cursor.execute("""
                SELECT * FROM waypoints 
                WHERE route_id = %s 
                ORDER BY order_index, id
            """, (route_id,))
            
            waypoints = cursor.fetchall()
            return [dict(w) for w in waypoints]
            
    except Exception as e:
        logger.error(f"Error getting waypoints for route {route_id}: {str(e)}")
        raise DatabaseError(f"Failed to get route waypoints: {str(e)}")

# Health check function
def check_database_health() -> Dict[str, Any]:
    """
    Check database connectivity and return health status.
    
    Returns:
        Dictionary with health status information
    """
    try:
        with get_db_cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
            
            # Get basic stats
            cursor.execute("SELECT COUNT(*) as user_count FROM users")
            user_count = cursor.fetchone()['user_count']
            
            cursor.execute("SELECT COUNT(*) as route_count FROM routes")
            route_count = cursor.fetchone()['route_count']
            
            return {
                "status": "healthy",
                "database_type": "PostgreSQL",
                "connection": "active",
                "users": user_count,
                "routes": route_count,
                "timestamp": datetime.now().isoformat()
            }
            
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "database_type": "PostgreSQL",
            "connection": "failed",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        } 