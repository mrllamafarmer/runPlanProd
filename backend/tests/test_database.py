import pytest
import os
from unittest.mock import patch, Mock
import psycopg2

import database
from exceptions import DatabaseError, ValidationError


class TestDatabaseFunctions:
    """Test suite for PostgreSQL database functions"""

    def test_get_db_connection_success(self):
        """Test successful database connection"""
        conn = database.get_db_connection()
        assert conn is not None
        conn.close()

    def test_get_db_connection_failure(self):
        """Test database connection failure handling"""
        with patch('database.psycopg2.connect') as mock_connect:
            mock_connect.side_effect = psycopg2.Error("Connection failed")
            
            with pytest.raises(DatabaseError):
                database.get_db_connection()

    def test_get_db_cursor_context_manager(self):
        """Test database cursor context manager"""
        with database.get_db_cursor() as cursor:
            cursor.execute("SELECT 1 as test_value")
            result = cursor.fetchone()
            assert result['test_value'] == 1

    def test_get_db_cursor_rollback_on_error(self):
        """Test cursor context manager rolls back on error"""
        with pytest.raises(DatabaseError):
            with database.get_db_cursor() as cursor:
                cursor.execute("SELECT 1")
                raise Exception("Test error")

    def test_save_route_data_success(self, test_user, sample_route_data):
        """Test successful route saving"""
        user_id = test_user
        
        route_id = database.save_route_data(user_id, sample_route_data)
        
        assert route_id is not None
        assert isinstance(route_id, int)
        
        # Clean up
        database.delete_route(str(route_id), user_id)

    def test_save_route_data_minimal(self, test_user):
        """Test saving route with minimal data"""
        user_id = test_user
        minimal_data = {
            'name': 'Test Route',
            'totalDistance': 5.0,
            'totalElevationGain': 100.0
        }
        
        route_id = database.save_route_data(user_id, minimal_data)
        assert route_id is not None
        
        # Clean up
        database.delete_route(str(route_id), user_id)

    def test_get_user_routes_empty(self):
        """Test getting routes for user with no routes"""
        user_id = 999  # Non-existent user
        routes = database.get_user_routes(user_id)
        assert routes == []

    def test_get_route_detail_success(self, test_user, sample_route_data):
        """Test getting route details successfully"""
        user_id = test_user
        route_id = database.save_route_data(user_id, sample_route_data)
        
        route_detail = database.get_route_detail(str(route_id), user_id)
        
        assert route_detail is not None
        assert route_detail['route']['id'] == route_id
        assert 'waypoints' in route_detail
        
        # Clean up
        database.delete_route(str(route_id), user_id)

    def test_get_route_detail_not_found(self, test_user):
        """Test getting non-existent route returns None"""
        user_id = test_user
        route_detail = database.get_route_detail("999999", user_id)
        assert route_detail is None

    def test_update_route_data_success(self, test_user, sample_route_data):
        """Test updating route data successfully"""
        user_id = test_user
        route_id = database.save_route_data(user_id, sample_route_data)
        
        update_data = {
            'name': 'Updated Route Name',
            'target_time_seconds': 7200
        }
        
        result = database.update_route_data(str(route_id), update_data, user_id)
        assert result is True
        
        # Verify update
        route_detail = database.get_route_detail(str(route_id), user_id)
        assert route_detail['route']['name'] == 'Updated Route Name'
        assert route_detail['route']['targetTimeSeconds'] == 7200
        
        # Clean up
        database.delete_route(str(route_id), user_id)

    def test_create_waypoint_success(self, test_user, sample_waypoint_data):
        """Test creating waypoint successfully"""
        user_id = test_user
        # First create a route
        route_data = {'name': 'Test Route', 'totalDistance': 5.0}
        route_id = database.save_route_data(user_id, route_data)
        
        waypoint_id = database.create_waypoint(route_id, sample_waypoint_data, user_id)
        assert waypoint_id is not None
        
        # Clean up
        database.delete_route(str(route_id), user_id)

    def test_update_waypoint_success(self, test_user, sample_waypoint_data):
        """Test updating waypoint successfully"""
        user_id = test_user
        # Create route and waypoint
        route_data = {'name': 'Test Route', 'totalDistance': 5.0, 'waypoints': [sample_waypoint_data]}
        route_id = database.save_route_data(user_id, route_data)
        
        # Get waypoint ID
        waypoints = database.get_route_waypoints(route_id, user_id)
        waypoint_id = waypoints[0]['id']
        
        update_data = {'name': 'Updated Waypoint', 'notes': 'Updated notes'}
        result = database.update_waypoint(waypoint_id, update_data, user_id)
        assert result is True
        
        # Clean up
        database.delete_route(str(route_id), user_id)

    def test_delete_waypoint_success(self, test_user, sample_waypoint_data):
        """Test deleting waypoint successfully"""
        user_id = test_user
        # Create route and waypoint
        route_data = {'name': 'Test Route', 'totalDistance': 5.0, 'waypoints': [sample_waypoint_data]}
        route_id = database.save_route_data(user_id, route_data)
        
        # Get waypoint ID
        waypoints = database.get_route_waypoints(route_id, user_id)
        waypoint_id = waypoints[0]['id']
        
        result = database.delete_waypoint(waypoint_id, user_id)
        assert result is True
        
        # Clean up
        database.delete_route(str(route_id), user_id)

    def test_update_waypoint_notes_success(self, test_user, sample_waypoint_data):
        """Test updating waypoint notes successfully"""
        user_id = test_user
        # Create route and waypoint
        route_data = {'name': 'Test Route', 'totalDistance': 5.0, 'waypoints': [sample_waypoint_data]}
        route_id = database.save_route_data(user_id, route_data)
        
        # Get waypoint ID
        waypoints = database.get_route_waypoints(route_id, user_id)
        waypoint_id = waypoints[0]['id']
        
        new_notes = "Updated test notes"
        result = database.update_waypoint_notes(str(route_id), waypoint_id, new_notes, user_id)
        assert result is True
        
        # Clean up
        database.delete_route(str(route_id), user_id)

    def test_get_route_waypoints_success(self, test_user, sample_waypoint_data):
        """Test getting route waypoints successfully"""
        user_id = test_user
        # Create route with waypoints
        route_data = {'name': 'Test Route', 'totalDistance': 5.0, 'waypoints': [sample_waypoint_data]}
        route_id = database.save_route_data(user_id, route_data)
        
        waypoints = database.get_route_waypoints(route_id, user_id)
        assert len(waypoints) == 1
        assert waypoints[0]['name'] == sample_waypoint_data.get('legName', sample_waypoint_data.get('name'))
        
        # Clean up
        database.delete_route(str(route_id), user_id)

    def test_delete_route_success(self, test_user, sample_route_data):
        """Test deleting route successfully"""
        user_id = test_user
        route_id = database.save_route_data(user_id, sample_route_data)
        
        # Verify route exists
        route_detail = database.get_route_detail(str(route_id), user_id)
        assert route_detail is not None
        
        # Delete route
        result = database.delete_route(str(route_id), user_id)
        assert result is True
        
        # Verify route was deleted
        route_detail = database.get_route_detail(str(route_id), user_id)
        assert route_detail is None

    def test_check_database_health_success(self):
        """Test database health check returns success"""
        health = database.check_database_health()
        assert health['status'] == 'healthy'
        assert 'database_type' in health
        assert 'timestamp' in health

    def test_database_error_handling(self):
        """Test database error handling with invalid operations"""
        with patch('database.get_db_connection') as mock_conn:
            mock_conn.side_effect = psycopg2.Error("Connection failed")
            
            with pytest.raises(DatabaseError):
                database.get_user_routes(1) 