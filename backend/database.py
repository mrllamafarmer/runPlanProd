import sqlite3
import os
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any
import uuid
from datetime import datetime

from exceptions import DatabaseException, RouteNotFoundException, WaypointNotFoundException

# Get logger for this module
logger = logging.getLogger('gpx_analyzer.database')

class Database:
    def __init__(self, db_path: str = "data/gpx_routes.db"):
        """Initialize database connection and tables"""
        try:
            # Ensure data directory exists
            data_dir = Path(db_path).parent
            data_dir.mkdir(exist_ok=True)
            
            self.db_path = db_path
            logger.info(f"Initializing database at {self.db_path}")
            self.init_database()
            logger.info("Database initialization completed successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise DatabaseException(f"Database initialization failed: {e}")
    
    def get_connection(self):
        """Get database connection with error handling"""
        try:
            conn = sqlite3.connect(self.db_path)
            conn.execute("PRAGMA foreign_keys = ON")  # Enable foreign key constraints
            return conn
        except sqlite3.Error as e:
            logger.error(f"Failed to connect to database: {e}")
            raise DatabaseException(f"Database connection failed: {e}")
    
    def init_database(self):
        """Initialize database tables"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Routes table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS routes (
                        id TEXT PRIMARY KEY,
                        filename TEXT NOT NULL,
                        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                        total_distance REAL,
                        total_elevation_gain REAL,
                        total_elevation_loss REAL,
                        start_time TEXT,
                        target_time_seconds INTEGER,
                        slowdown_factor_percent REAL DEFAULT 0,
                        has_valid_time BOOLEAN DEFAULT 0,
                        using_target_time BOOLEAN DEFAULT 0,
                        gpx_data TEXT
                    )
                """)
                
                # Waypoints/Legs table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS waypoints (
                        id TEXT PRIMARY KEY,
                        route_id TEXT,
                        leg_number INTEGER,
                        leg_name TEXT,
                        distance_miles REAL,
                        cumulative_distance REAL,
                        duration_seconds REAL,
                        leg_pace_seconds REAL,
                        elevation_gain REAL,
                        elevation_loss REAL,
                        cumulative_elevation_gain REAL,
                        cumulative_elevation_loss REAL,
                        rest_time_seconds INTEGER DEFAULT 0,
                        notes TEXT,
                        latitude REAL,
                        longitude REAL,
                        elevation REAL,
                        FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE CASCADE
                    )
                """)
                
                # Track points table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS track_points (
                        id TEXT PRIMARY KEY,
                        route_id TEXT,
                        point_number INTEGER,
                        latitude REAL,
                        longitude REAL,
                        elevation REAL,
                        timestamp TEXT,
                        distance_from_start REAL,
                        cumulative_distance REAL,
                        FOREIGN KEY (route_id) REFERENCES routes (id) ON DELETE CASCADE
                    )
                """)
                
                conn.commit()
                logger.debug("Database tables created/verified successfully")
                
        except sqlite3.Error as e:
            logger.error(f"Failed to initialize database tables: {e}")
            raise DatabaseException(f"Database table initialization failed: {e}")
    
    def save_route(self, route_data: Dict[str, Any]) -> str:
        """Save a complete route with all data"""
        route_id = str(uuid.uuid4())
        logger.info(f"Saving route {route_id} with filename: {route_data.get('filename')}")
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Begin transaction
                cursor.execute("BEGIN TRANSACTION")
                logger.debug(f"Started transaction for route {route_id}")
                
                try:
                    # Insert route
                    cursor.execute("""
                        INSERT INTO routes (
                            id, filename, total_distance, total_elevation_gain, total_elevation_loss,
                            start_time, target_time_seconds, slowdown_factor_percent, has_valid_time,
                            using_target_time, gpx_data
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        route_id,
                        route_data.get('filename'),
                        route_data.get('totalDistance'),
                        route_data.get('totalElevationGain'),
                        route_data.get('totalElevationLoss'),
                        route_data.get('startTime'),
                        route_data.get('targetTimeSeconds'),
                        route_data.get('slowdownFactorPercent'),
                        route_data.get('hasValidTime'),
                        route_data.get('usingTargetTime'),
                        route_data.get('gpxData')
                    ))
                    logger.debug(f"Inserted route record for {route_id}")
                    
                    # Insert waypoints
                    waypoints = route_data.get('waypoints', [])
                    if waypoints:
                        logger.debug(f"Inserting {len(waypoints)} waypoints for route {route_id}")
                        for i, waypoint in enumerate(waypoints):
                            try:
                                cursor.execute("""
                                    INSERT INTO waypoints (
                                        id, route_id, leg_number, leg_name, distance_miles, cumulative_distance,
                                        duration_seconds, leg_pace_seconds, elevation_gain, elevation_loss,
                                        cumulative_elevation_gain, cumulative_elevation_loss, rest_time_seconds,
                                        notes, latitude, longitude, elevation
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                """, (
                                    str(uuid.uuid4()),
                                    route_id,
                                    waypoint.get('legNumber'),
                                    waypoint.get('legName', f"Leg {waypoint.get('legNumber')}"),
                                    waypoint.get('distanceMiles'),
                                    waypoint.get('cumulativeDistance'),
                                    waypoint.get('durationSeconds'),
                                    waypoint.get('legPaceSeconds'),
                                    waypoint.get('elevationGain'),
                                    waypoint.get('elevationLoss'),
                                    waypoint.get('cumulativeElevationGain'),
                                    waypoint.get('cumulativeElevationLoss'),
                                    waypoint.get('restTimeSeconds', 0),
                                    waypoint.get('notes', ''),
                                    waypoint.get('latitude'),
                                    waypoint.get('longitude'),
                                    waypoint.get('elevation')
                                ))
                            except Exception as e:
                                logger.error(f"Failed to insert waypoint {i} for route {route_id}: {e}")
                                raise
                    
                    # Insert track points
                    track_points = route_data.get('trackPoints', [])
                    if track_points:
                        logger.debug(f"Inserting {len(track_points)} track points for route {route_id}")
                        for index, point in enumerate(track_points):
                            try:
                                # Handle timestamp
                                iso_timestamp = None
                                if point.get('time'):
                                    try:
                                        date_obj = datetime.fromisoformat(point['time'].replace('Z', '+00:00'))
                                        iso_timestamp = date_obj.isoformat()
                                    except ValueError as e:
                                        logger.warning(f"Invalid timestamp format for track point {index}: {point.get('time')}")
                                
                                cursor.execute("""
                                    INSERT INTO track_points (
                                        id, route_id, point_number, latitude, longitude, elevation,
                                        timestamp, distance_from_start, cumulative_distance
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                """, (
                                    str(uuid.uuid4()),
                                    route_id,
                                    index,
                                    point.get('lat'),
                                    point.get('lon'),
                                    point.get('elevation'),
                                    iso_timestamp,
                                    point.get('distance'),
                                    point.get('cumulativeDistance')
                                ))
                            except Exception as e:
                                logger.error(f"Failed to insert track point {index} for route {route_id}: {e}")
                                raise
                    
                    cursor.execute("COMMIT")
                    logger.info(f"Successfully saved route {route_id} with {len(waypoints)} waypoints and {len(track_points)} track points")
                    return route_id
                    
                except Exception as e:
                    cursor.execute("ROLLBACK")
                    logger.error(f"Transaction rolled back for route {route_id}: {e}")
                    raise
                    
        except sqlite3.Error as e:
            logger.error(f"Database error while saving route: {e}")
            raise DatabaseException(f"Failed to save route: {e}")
        except Exception as e:
            logger.error(f"Unexpected error while saving route: {e}")
            raise DatabaseException(f"Unexpected error saving route: {e}")
    
    def get_all_routes(self) -> List[Dict[str, Any]]:
        """Get all routes"""
        logger.debug("Retrieving all routes")
        
        try:
            with self.get_connection() as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute("""
                    SELECT 
                        id, filename, upload_date, total_distance, total_elevation_gain,
                        total_elevation_loss, start_time, target_time_seconds, slowdown_factor_percent,
                        has_valid_time, using_target_time
                    FROM routes ORDER BY upload_date DESC
                """)
                
                routes = [dict(row) for row in cursor.fetchall()]
                logger.info(f"Retrieved {len(routes)} routes")
                return routes
                
        except sqlite3.Error as e:
            logger.error(f"Database error while retrieving routes: {e}")
            raise DatabaseException(f"Failed to retrieve routes: {e}")
        except Exception as e:
            logger.error(f"Unexpected error while retrieving routes: {e}")
            raise DatabaseException(f"Unexpected error retrieving routes: {e}")
    
    def get_route_by_id(self, route_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific route with all data"""
        logger.debug(f"Retrieving route {route_id}")
        
        try:
            with self.get_connection() as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                # Get route
                cursor.execute("SELECT * FROM routes WHERE id = ?", (route_id,))
                route = cursor.fetchone()
                
                if not route:
                    logger.warning(f"Route {route_id} not found")
                    raise RouteNotFoundException(f"Route with ID {route_id} not found")
                
                # Get waypoints
                cursor.execute("SELECT * FROM waypoints WHERE route_id = ? ORDER BY leg_number", (route_id,))
                waypoints = [dict(row) for row in cursor.fetchall()]
                
                # Get track points
                cursor.execute("SELECT * FROM track_points WHERE route_id = ? ORDER BY point_number", (route_id,))
                track_points = [dict(row) for row in cursor.fetchall()]
                
                logger.info(f"Retrieved route {route_id} with {len(waypoints)} waypoints and {len(track_points)} track points")
                
                return {
                    "route": dict(route),
                    "waypoints": waypoints,
                    "trackPoints": track_points
                }
                
        except RouteNotFoundException:
            raise
        except sqlite3.Error as e:
            logger.error(f"Database error while retrieving route {route_id}: {e}")
            raise DatabaseException(f"Failed to retrieve route: {e}")
        except Exception as e:
            logger.error(f"Unexpected error while retrieving route {route_id}: {e}")
            raise DatabaseException(f"Unexpected error retrieving route: {e}")
    
    def update_waypoint_notes(self, waypoint_id: str, notes: str) -> bool:
        """Update waypoint notes"""
        logger.debug(f"Updating notes for waypoint {waypoint_id}")
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("UPDATE waypoints SET notes = ? WHERE id = ?", (notes, waypoint_id))
                
                if cursor.rowcount == 0:
                    logger.warning(f"Waypoint {waypoint_id} not found for notes update")
                    raise WaypointNotFoundException(f"Waypoint with ID {waypoint_id} not found")
                
                logger.info(f"Updated notes for waypoint {waypoint_id}")
                return True
                
        except WaypointNotFoundException:
            raise
        except sqlite3.Error as e:
            logger.error(f"Database error while updating waypoint {waypoint_id} notes: {e}")
            raise DatabaseException(f"Failed to update waypoint notes: {e}")
        except Exception as e:
            logger.error(f"Unexpected error while updating waypoint {waypoint_id} notes: {e}")
            raise DatabaseException(f"Unexpected error updating waypoint notes: {e}")
    
    def delete_route(self, route_id: str) -> bool:
        """Delete a route and all associated data"""
        logger.info(f"Deleting route {route_id}")
        
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check if route exists first
                cursor.execute("SELECT id FROM routes WHERE id = ?", (route_id,))
                if not cursor.fetchone():
                    logger.warning(f"Route {route_id} not found for deletion")
                    raise RouteNotFoundException(f"Route with ID {route_id} not found")
                
                # Delete route (cascading will handle waypoints and track_points)
                cursor.execute("DELETE FROM routes WHERE id = ?", (route_id,))
                
                logger.info(f"Successfully deleted route {route_id}")
                return True
                
        except RouteNotFoundException:
            raise
        except sqlite3.Error as e:
            logger.error(f"Database error while deleting route {route_id}: {e}")
            raise DatabaseException(f"Failed to delete route: {e}")
        except Exception as e:
            logger.error(f"Unexpected error while deleting route {route_id}: {e}")
            raise DatabaseException(f"Unexpected error deleting route: {e}") 