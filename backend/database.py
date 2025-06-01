"""
PostgreSQL Database Operations and Connection Management

This module handles all database connections and operations for the GPX Route Analyzer.
Migrated from SQLite to PostgreSQL for production multi-user support.
"""

import os
import json
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

from exceptions import DatabaseError, ValidationError
from logging_config import get_logger

logger = get_logger(__name__)

# Database configuration from environment variables
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://runplan_user:runplan_secure_password_123@localhost:5432/runplanprod"
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
            cursor.execute("""
                INSERT INTO routes (
                    user_id, name, description, total_distance_meters,
                    total_elevation_gain_meters, estimated_time_seconds, is_public
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                user_id,
                route_data.get('name', 'Unnamed Route'),
                route_data.get('description'),
                route_data.get('totalDistance', 0) * 1000,  # Convert km to meters
                route_data.get('totalElevationGain', 0),
                route_data.get('targetTimeSeconds', 0),
                route_data.get('is_public', False)
            ))
            
            route_id = cursor.fetchone()[0]
            
            # Save waypoints if provided
            waypoints = route_data.get('waypoints', [])
            for i, waypoint in enumerate(waypoints):
                cursor.execute("""
                    INSERT INTO waypoints (
                        route_id, name, latitude, longitude, elevation_meters,
                        order_index, waypoint_type
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    route_id,
                    waypoint.get('legName', f'Waypoint {i+1}'),
                    waypoint.get('latitude'),
                    waypoint.get('longitude'),
                    waypoint.get('elevation'),
                    i,
                    'start' if i == 0 else ('finish' if i == len(waypoints)-1 else 'checkpoint')
                ))
            
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
                    total_elevation_gain_meters, estimated_time_seconds,
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
                    'total_elevation_loss': 0,  # TODO: Calculate this
                    'target_time_seconds': route['estimated_time_seconds'],
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
            
            # Get route segments and track points
            cursor.execute("""
                SELECT rs.*, tp.latitude, tp.longitude, tp.elevation_meters,
                       tp.distance_from_segment_start_meters, tp.point_index
                FROM route_segments rs
                LEFT JOIN track_points tp ON rs.id = tp.route_segment_id
                WHERE rs.route_id = %s
                ORDER BY rs.id, tp.point_index
            """, (route_id,))
            segments_and_points = cursor.fetchall()
            
            # Build response
            result = {
                'route': {
                    'id': route['id'],
                    'name': route['name'],
                    'description': route['description'],
                    'totalDistance': route['total_distance_meters'] / 1000,
                    'totalElevationGain': route['total_elevation_gain_meters'],
                    'targetTimeSeconds': route['estimated_time_seconds'],
                    'created_at': route['created_at'].isoformat() if route['created_at'] else None,
                    'owner': route['username'],
                    'is_public': route['is_public']
                },
                'waypoints': [dict(w) for w in waypoints],
                'trackPoints': []
            }
            
            # Process track points
            for segment_point in segments_and_points:
                if segment_point['latitude']:  # Has track point data
                    result['trackPoints'].append({
                        'lat': segment_point['latitude'],
                        'lon': segment_point['longitude'],
                        'elevation': segment_point['elevation_meters'],
                        'distance': segment_point['distance_from_segment_start_meters']
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