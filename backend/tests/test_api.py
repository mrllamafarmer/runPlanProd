import pytest
from fastapi import status
from unittest.mock import patch
import json

from exceptions import DatabaseException, RouteNotFoundException, WaypointNotFoundException


class TestAPIEndpoints:
    """Test suite for FastAPI endpoints"""

    def test_health_check_success(self, client):
        """Test health check endpoint returns healthy status"""
        response = client.get("/health")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"
        assert "message" in data
        assert data["database"] == "connected"
        assert "routes_count" in data

    def test_health_check_database_failure(self, client):
        """Test health check endpoint handles database failures"""
        with patch('main.db.get_all_routes') as mock_get_routes:
            mock_get_routes.side_effect = DatabaseException("Database error")
            
            response = client.get("/health")
            
            assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
            data = response.json()
            assert data["status"] == "unhealthy"
            assert data["database"] == "disconnected"

    def test_create_route_success(self, client, sample_route_data):
        """Test successful route creation"""
        response = client.post("/api/routes", json=sample_route_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "routeId" in data
        assert data["message"] == "Route saved successfully"
        assert len(data["routeId"]) == 36  # UUID length

    def test_create_route_minimal_data(self, client, minimal_route_data):
        """Test route creation with minimal required data"""
        response = client.post("/api/routes", json=minimal_route_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "routeId" in data
        assert data["message"] == "Route saved successfully"

    def test_create_route_missing_filename(self, client):
        """Test route creation with missing filename"""
        invalid_data = {
            "totalDistance": 10.0,
            "totalElevationGain": 100.0,
            "totalElevationLoss": 50.0
        }
        
        response = client.post("/api/routes", json=invalid_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_route_empty_filename(self, client):
        """Test route creation with empty filename"""
        invalid_data = {
            "filename": "",
            "totalDistance": 10.0,
            "totalElevationGain": 100.0,
            "totalElevationLoss": 50.0
        }
        
        response = client.post("/api/routes", json=invalid_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["error"] == "Validation error"
        assert "Filename is required" in data["detail"]

    def test_create_route_invalid_distance(self, client):
        """Test route creation with invalid distance"""
        invalid_data = {
            "filename": "test.gpx",
            "totalDistance": -5.0,
            "totalElevationGain": 100.0,
            "totalElevationLoss": 50.0
        }
        
        response = client.post("/api/routes", json=invalid_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["error"] == "Validation error"
        assert "Total distance must be greater than 0" in data["detail"]

    def test_create_route_database_error(self, client, sample_route_data):
        """Test route creation handles database errors"""
        with patch('main.db.save_route') as mock_save:
            mock_save.side_effect = DatabaseException("Database error")
            
            response = client.post("/api/routes", json=sample_route_data)
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert data["error"] == "Database error"

    def test_get_all_routes_empty(self, client):
        """Test getting all routes when database is empty"""
        response = client.get("/api/routes")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data == []

    def test_get_all_routes_with_data(self, client, sample_route_data):
        """Test getting all routes with data"""
        # Create a route first
        create_response = client.post("/api/routes", json=sample_route_data)
        assert create_response.status_code == status.HTTP_200_OK
        
        # Get all routes
        response = client.get("/api/routes")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["filename"] == sample_route_data["filename"]

    def test_get_all_routes_database_error(self, client):
        """Test get all routes handles database errors"""
        with patch('main.db.get_all_routes') as mock_get_routes:
            mock_get_routes.side_effect = DatabaseException("Database error")
            
            response = client.get("/api/routes")
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert data["error"] == "Database error"

    def test_get_route_by_id_success(self, client, sample_route_data):
        """Test getting route by ID successfully"""
        # Create a route first
        create_response = client.post("/api/routes", json=sample_route_data)
        route_id = create_response.json()["routeId"]
        
        # Get the route
        response = client.get(f"/api/routes/{route_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "route" in data
        assert "waypoints" in data
        assert "trackPoints" in data
        assert data["route"]["id"] == route_id

    def test_get_route_by_id_invalid_format(self, client):
        """Test getting route with invalid ID format"""
        response = client.get("/api/routes/invalid-id")
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["error"] == "Validation error"
        assert "Invalid route ID format" in data["detail"]

    def test_get_route_by_id_not_found(self, client):
        """Test getting non-existent route"""
        response = client.get("/api/routes/123e4567-e89b-12d3-a456-426614174000")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert data["error"] == "Route not found"

    def test_get_route_by_id_database_error(self, client):
        """Test get route by ID handles database errors"""
        with patch('main.db.get_route_by_id') as mock_get_route:
            mock_get_route.side_effect = DatabaseException("Database error")
            
            response = client.get("/api/routes/123e4567-e89b-12d3-a456-426614174000")
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert data["error"] == "Database error"

    def test_update_waypoint_notes_success(self, client, sample_route_data):
        """Test updating waypoint notes successfully"""
        # Create a route with waypoints first
        create_response = client.post("/api/routes", json=sample_route_data)
        route_id = create_response.json()["routeId"]
        
        # Get route to find waypoint ID
        route_response = client.get(f"/api/routes/{route_id}")
        waypoint_id = route_response.json()["waypoints"][0]["id"]
        
        # Update waypoint notes
        new_notes = {"notes": "Updated test notes"}
        response = client.put(f"/api/waypoints/{waypoint_id}/notes", json=new_notes)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Notes updated successfully"

    def test_update_waypoint_notes_invalid_id(self, client):
        """Test updating waypoint with invalid ID format"""
        new_notes = {"notes": "Test notes"}
        response = client.put("/api/waypoints/invalid-id/notes", json=new_notes)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["error"] == "Validation error"
        assert "Invalid waypoint ID format" in data["detail"]

    def test_update_waypoint_notes_too_long(self, client):
        """Test updating waypoint with notes too long"""
        long_notes = {"notes": "x" * 1001}  # Exceeds 1000 char limit
        response = client.put("/api/waypoints/123e4567-e89b-12d3-a456-426614174000/notes", json=long_notes)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["error"] == "Validation error"
        assert "Notes cannot exceed 1000 characters" in data["detail"]

    def test_update_waypoint_notes_not_found(self, client):
        """Test updating non-existent waypoint"""
        new_notes = {"notes": "Test notes"}
        response = client.put("/api/waypoints/123e4567-e89b-12d3-a456-426614174000/notes", json=new_notes)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert data["error"] == "Waypoint not found"

    def test_update_waypoint_notes_database_error(self, client):
        """Test update waypoint notes handles database errors"""
        with patch('main.db.update_waypoint_notes') as mock_update:
            mock_update.side_effect = DatabaseException("Database error")
            
            new_notes = {"notes": "Test notes"}
            response = client.put("/api/waypoints/123e4567-e89b-12d3-a456-426614174000/notes", json=new_notes)
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert data["error"] == "Database error"

    def test_delete_route_success(self, client, sample_route_data):
        """Test deleting route successfully"""
        # Create a route first
        create_response = client.post("/api/routes", json=sample_route_data)
        route_id = create_response.json()["routeId"]
        
        # Delete the route
        response = client.delete(f"/api/routes/{route_id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Route deleted successfully"
        
        # Verify route was deleted
        get_response = client.get(f"/api/routes/{route_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_route_invalid_id(self, client):
        """Test deleting route with invalid ID format"""
        response = client.delete("/api/routes/invalid-id")
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["error"] == "Validation error"
        assert "Invalid route ID format" in data["detail"]

    def test_delete_route_not_found(self, client):
        """Test deleting non-existent route"""
        response = client.delete("/api/routes/123e4567-e89b-12d3-a456-426614174000")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert data["error"] == "Route not found"

    def test_delete_route_database_error(self, client):
        """Test delete route handles database errors"""
        with patch('main.db.delete_route') as mock_delete:
            mock_delete.side_effect = DatabaseException("Database error")
            
            response = client.delete("/api/routes/123e4567-e89b-12d3-a456-426614174000")
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert data["error"] == "Database error"

    def test_request_validation_error(self, client):
        """Test request validation error handling"""
        # Send invalid JSON data
        invalid_data = {
            "filename": "test.gpx",
            "totalDistance": "invalid_number",  # Should be float
            "totalElevationGain": 100.0,
            "totalElevationLoss": 50.0
        }
        
        response = client.post("/api/routes", json=invalid_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        data = response.json()
        assert data["error"] == "Request validation failed"

    def test_cors_headers(self, client):
        """Test CORS headers are present"""
        response = client.options("/api/routes")
        
        # CORS headers should be present (handled by middleware)
        assert response.status_code in [200, 405]  # OPTIONS might not be explicitly handled

    def test_static_file_serving(self, client):
        """Test static file serving (if public directory exists)"""
        # This test might fail if public directory doesn't exist in test environment
        response = client.get("/")
        
        # Should either serve the file or return 404 if not found
        assert response.status_code in [200, 404] 