import pytest
import sqlite3
import tempfile
import os
from unittest.mock import patch, Mock

from database import Database
from exceptions import DatabaseException, RouteNotFoundException, WaypointNotFoundException


class TestDatabase:
    """Test suite for Database class"""

    def test_database_initialization(self):
        """Test database initialization creates tables correctly"""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp_file:
            test_db_path = tmp_file.name
        
        try:
            db = Database(db_path=test_db_path)
            
            # Verify tables were created
            with db.get_connection() as conn:
                cursor = conn.cursor()
                
                # Check routes table
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='routes'")
                assert cursor.fetchone() is not None
                
                # Check waypoints table
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='waypoints'")
                assert cursor.fetchone() is not None
                
                # Check track_points table
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='track_points'")
                assert cursor.fetchone() is not None
                
        finally:
            if os.path.exists(test_db_path):
                os.unlink(test_db_path)

    def test_database_initialization_failure(self):
        """Test database initialization handles failures correctly"""
        with patch('database.sqlite3.connect') as mock_connect:
            mock_connect.side_effect = sqlite3.Error("Connection failed")
            
            with pytest.raises(DatabaseException):
                Database(db_path="/invalid/path/test.db")

    def test_save_route_success(self, test_db, sample_route_data):
        """Test successful route saving"""
        route_id = test_db.save_route(sample_route_data)
        
        assert route_id is not None
        assert len(route_id) == 36  # UUID length
        
        # Verify route was saved
        with test_db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM routes WHERE id = ?", (route_id,))
            route = cursor.fetchone()
            assert route is not None

    def test_save_route_with_waypoints_and_track_points(self, test_db, sample_route_data):
        """Test saving route with waypoints and track points"""
        route_id = test_db.save_route(sample_route_data)
        
        # Verify waypoints were saved
        with test_db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM waypoints WHERE route_id = ?", (route_id,))
            waypoint_count = cursor.fetchone()[0]
            assert waypoint_count == len(sample_route_data['waypoints'])
            
            # Verify track points were saved
            cursor.execute("SELECT COUNT(*) FROM track_points WHERE route_id = ?", (route_id,))
            track_point_count = cursor.fetchone()[0]
            assert track_point_count == len(sample_route_data['trackPoints'])

    def test_save_route_minimal_data(self, test_db, minimal_route_data):
        """Test saving route with minimal required data"""
        route_id = test_db.save_route(minimal_route_data)
        
        assert route_id is not None
        
        # Verify route was saved with correct data
        with test_db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT filename, total_distance FROM routes WHERE id = ?", (route_id,))
            route = cursor.fetchone()
            assert route[0] == minimal_route_data['filename']
            assert route[1] == minimal_route_data['totalDistance']

    def test_save_route_database_error(self, test_db):
        """Test route saving handles database errors"""
        with patch.object(test_db, 'get_connection') as mock_conn:
            mock_conn.side_effect = sqlite3.Error("Database error")
            
            with pytest.raises(DatabaseException):
                test_db.save_route({"filename": "test.gpx", "totalDistance": 10.0})

    def test_get_all_routes_empty(self, test_db):
        """Test getting all routes when database is empty"""
        routes = test_db.get_all_routes()
        assert routes == []

    def test_get_all_routes_with_data(self, test_db, sample_route_data):
        """Test getting all routes with data"""
        # Save a test route
        route_id = test_db.save_route(sample_route_data)
        
        routes = test_db.get_all_routes()
        assert len(routes) == 1
        assert routes[0]['id'] == route_id
        assert routes[0]['filename'] == sample_route_data['filename']

    def test_get_all_routes_database_error(self, test_db):
        """Test get all routes handles database errors"""
        with patch.object(test_db, 'get_connection') as mock_conn:
            mock_conn.side_effect = sqlite3.Error("Database error")
            
            with pytest.raises(DatabaseException):
                test_db.get_all_routes()

    def test_get_route_by_id_success(self, test_db, sample_route_data):
        """Test getting route by ID successfully"""
        route_id = test_db.save_route(sample_route_data)
        
        route_data = test_db.get_route_by_id(route_id)
        
        assert route_data is not None
        assert 'route' in route_data
        assert 'waypoints' in route_data
        assert 'trackPoints' in route_data
        assert route_data['route']['id'] == route_id
        assert len(route_data['waypoints']) == len(sample_route_data['waypoints'])
        assert len(route_data['trackPoints']) == len(sample_route_data['trackPoints'])

    def test_get_route_by_id_not_found(self, test_db):
        """Test getting non-existent route raises exception"""
        with pytest.raises(RouteNotFoundException):
            test_db.get_route_by_id("123e4567-e89b-12d3-a456-426614174000")

    def test_get_route_by_id_database_error(self, test_db):
        """Test get route by ID handles database errors"""
        with patch.object(test_db, 'get_connection') as mock_conn:
            mock_conn.side_effect = sqlite3.Error("Database error")
            
            with pytest.raises(DatabaseException):
                test_db.get_route_by_id("123e4567-e89b-12d3-a456-426614174000")

    def test_update_waypoint_notes_success(self, test_db, sample_route_data):
        """Test updating waypoint notes successfully"""
        route_id = test_db.save_route(sample_route_data)
        
        # Get waypoint ID
        with test_db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM waypoints WHERE route_id = ?", (route_id,))
            waypoint_id = cursor.fetchone()[0]
        
        # Update notes
        new_notes = "Updated test notes"
        result = test_db.update_waypoint_notes(waypoint_id, new_notes)
        
        assert result is True
        
        # Verify notes were updated
        with test_db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT notes FROM waypoints WHERE id = ?", (waypoint_id,))
            notes = cursor.fetchone()[0]
            assert notes == new_notes

    def test_update_waypoint_notes_not_found(self, test_db):
        """Test updating non-existent waypoint raises exception"""
        with pytest.raises(WaypointNotFoundException):
            test_db.update_waypoint_notes("123e4567-e89b-12d3-a456-426614174000", "test notes")

    def test_update_waypoint_notes_database_error(self, test_db):
        """Test update waypoint notes handles database errors"""
        with patch.object(test_db, 'get_connection') as mock_conn:
            mock_conn.side_effect = sqlite3.Error("Database error")
            
            with pytest.raises(DatabaseException):
                test_db.update_waypoint_notes("123e4567-e89b-12d3-a456-426614174000", "test notes")

    def test_delete_route_success(self, test_db, sample_route_data):
        """Test deleting route successfully"""
        route_id = test_db.save_route(sample_route_data)
        
        # Verify route exists
        route_data = test_db.get_route_by_id(route_id)
        assert route_data is not None
        
        # Delete route
        result = test_db.delete_route(route_id)
        assert result is True
        
        # Verify route was deleted
        with pytest.raises(RouteNotFoundException):
            test_db.get_route_by_id(route_id)

    def test_delete_route_not_found(self, test_db):
        """Test deleting non-existent route raises exception"""
        with pytest.raises(RouteNotFoundException):
            test_db.delete_route("123e4567-e89b-12d3-a456-426614174000")

    def test_delete_route_database_error(self, test_db):
        """Test delete route handles database errors"""
        with patch.object(test_db, 'get_connection') as mock_conn:
            mock_conn.side_effect = sqlite3.Error("Database error")
            
            with pytest.raises(DatabaseException):
                test_db.delete_route("123e4567-e89b-12d3-a456-426614174000")

    def test_foreign_key_constraints(self, test_db, sample_route_data):
        """Test that foreign key constraints are properly enforced"""
        route_id = test_db.save_route(sample_route_data)
        
        # Delete route
        test_db.delete_route(route_id)
        
        # Verify waypoints and track points were cascaded
        with test_db.get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("SELECT COUNT(*) FROM waypoints WHERE route_id = ?", (route_id,))
            waypoint_count = cursor.fetchone()[0]
            assert waypoint_count == 0
            
            cursor.execute("SELECT COUNT(*) FROM track_points WHERE route_id = ?", (route_id,))
            track_point_count = cursor.fetchone()[0]
            assert track_point_count == 0

    def test_invalid_timestamp_handling(self, test_db):
        """Test handling of invalid timestamps in track points"""
        route_data = {
            "filename": "test.gpx",
            "totalDistance": 10.0,
            "totalElevationGain": 100.0,
            "totalElevationLoss": 50.0,
            "trackPoints": [
                {
                    "lat": 40.0,
                    "lon": -74.0,
                    "elevation": 100.0,
                    "time": "invalid-timestamp",
                    "distance": 0.0,
                    "cumulativeDistance": 0.0
                }
            ]
        }
        
        # Should not raise exception, just log warning
        route_id = test_db.save_route(route_data)
        assert route_id is not None 