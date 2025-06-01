import pytest
from fastapi import status


@pytest.mark.integration
class TestIntegration:
    """Integration tests for full API workflow"""

    def test_full_route_lifecycle(self, client, sample_route_data):
        """Test complete route lifecycle: create, read, update, delete"""
        # 1. Create a route
        create_response = client.post("/api/routes", json=sample_route_data)
        assert create_response.status_code == status.HTTP_200_OK
        
        route_id = create_response.json()["routeId"]
        assert route_id is not None
        
        # 2. Verify route appears in all routes list
        list_response = client.get("/api/routes")
        assert list_response.status_code == status.HTTP_200_OK
        
        routes = list_response.json()
        assert len(routes) == 1
        assert routes[0]["id"] == route_id
        assert routes[0]["filename"] == sample_route_data["filename"]
        
        # 3. Get specific route details
        get_response = client.get(f"/api/routes/{route_id}")
        assert get_response.status_code == status.HTTP_200_OK
        
        route_data = get_response.json()
        assert route_data["route"]["id"] == route_id
        assert len(route_data["waypoints"]) == len(sample_route_data["waypoints"])
        assert len(route_data["trackPoints"]) == len(sample_route_data["trackPoints"])
        
        # 4. Update waypoint notes
        waypoint_id = route_data["waypoints"][0]["id"]
        new_notes = {"notes": "Updated integration test notes"}
        
        update_response = client.put(f"/api/waypoints/{waypoint_id}/notes", json=new_notes)
        assert update_response.status_code == status.HTTP_200_OK
        
        # 5. Verify notes were updated
        get_updated_response = client.get(f"/api/routes/{route_id}")
        updated_waypoints = get_updated_response.json()["waypoints"]
        assert updated_waypoints[0]["notes"] == new_notes["notes"]
        
        # 6. Delete the route
        delete_response = client.delete(f"/api/routes/{route_id}")
        assert delete_response.status_code == status.HTTP_200_OK
        
        # 7. Verify route is deleted
        get_deleted_response = client.get(f"/api/routes/{route_id}")
        assert get_deleted_response.status_code == status.HTTP_404_NOT_FOUND
        
        # 8. Verify route no longer appears in list
        final_list_response = client.get("/api/routes")
        final_routes = final_list_response.json()
        assert len(final_routes) == 0

    def test_multiple_routes_management(self, client, sample_route_data, minimal_route_data):
        """Test managing multiple routes"""
        # Create multiple routes
        routes_created = []
        
        # Create first route
        response1 = client.post("/api/routes", json=sample_route_data)
        assert response1.status_code == status.HTTP_200_OK
        routes_created.append(response1.json()["routeId"])
        
        # Create second route
        response2 = client.post("/api/routes", json=minimal_route_data)
        assert response2.status_code == status.HTTP_200_OK
        routes_created.append(response2.json()["routeId"])
        
        # Verify both routes exist
        list_response = client.get("/api/routes")
        routes = list_response.json()
        assert len(routes) == 2
        
        route_ids = [route["id"] for route in routes]
        for created_id in routes_created:
            assert created_id in route_ids
        
        # Delete first route
        delete_response = client.delete(f"/api/routes/{routes_created[0]}")
        assert delete_response.status_code == status.HTTP_200_OK
        
        # Verify only second route remains
        remaining_response = client.get("/api/routes")
        remaining_routes = remaining_response.json()
        assert len(remaining_routes) == 1
        assert remaining_routes[0]["id"] == routes_created[1]
        
        # Clean up remaining route
        client.delete(f"/api/routes/{routes_created[1]}")

    def test_waypoint_notes_across_multiple_routes(self, client, sample_route_data):
        """Test waypoint notes management across multiple routes"""
        # Create two identical routes
        response1 = client.post("/api/routes", json=sample_route_data)
        response2 = client.post("/api/routes", json=sample_route_data)
        
        route_id1 = response1.json()["routeId"]
        route_id2 = response2.json()["routeId"]
        
        # Get waypoint IDs from both routes
        route1_data = client.get(f"/api/routes/{route_id1}").json()
        route2_data = client.get(f"/api/routes/{route_id2}").json()
        
        waypoint_id1 = route1_data["waypoints"][0]["id"]
        waypoint_id2 = route2_data["waypoints"][0]["id"]
        
        # Update notes for first route's waypoint
        notes1 = {"notes": "Route 1 waypoint notes"}
        client.put(f"/api/waypoints/{waypoint_id1}/notes", json=notes1)
        
        # Update notes for second route's waypoint
        notes2 = {"notes": "Route 2 waypoint notes"}
        client.put(f"/api/waypoints/{waypoint_id2}/notes", json=notes2)
        
        # Verify notes are independent
        updated_route1 = client.get(f"/api/routes/{route_id1}").json()
        updated_route2 = client.get(f"/api/routes/{route_id2}").json()
        
        assert updated_route1["waypoints"][0]["notes"] == notes1["notes"]
        assert updated_route2["waypoints"][0]["notes"] == notes2["notes"]
        
        # Clean up
        client.delete(f"/api/routes/{route_id1}")
        client.delete(f"/api/routes/{route_id2}")

    def test_route_data_persistence(self, client, sample_route_data):
        """Test that route data persists correctly through save/load cycle"""
        # Create route
        create_response = client.post("/api/routes", json=sample_route_data)
        route_id = create_response.json()["routeId"]
        
        # Retrieve route
        get_response = client.get(f"/api/routes/{route_id}")
        retrieved_data = get_response.json()
        
        # Verify all data fields are preserved
        route = retrieved_data["route"]
        assert route["filename"] == sample_route_data["filename"]
        assert route["total_distance"] == sample_route_data["totalDistance"]
        assert route["total_elevation_gain"] == sample_route_data["totalElevationGain"]
        assert route["total_elevation_loss"] == sample_route_data["totalElevationLoss"]
        assert route["start_time"] == sample_route_data["startTime"]
        assert route["target_time_seconds"] == sample_route_data["targetTimeSeconds"]
        assert route["slowdown_factor_percent"] == sample_route_data["slowdownFactorPercent"]
        assert route["has_valid_time"] == sample_route_data["hasValidTime"]
        assert route["using_target_time"] == sample_route_data["usingTargetTime"]
        assert route["gpx_data"] == sample_route_data["gpxData"]
        
        # Verify waypoint data
        waypoints = retrieved_data["waypoints"]
        assert len(waypoints) == len(sample_route_data["waypoints"])
        
        original_waypoint = sample_route_data["waypoints"][0]
        retrieved_waypoint = waypoints[0]
        
        assert retrieved_waypoint["leg_number"] == original_waypoint["legNumber"]
        assert retrieved_waypoint["leg_name"] == original_waypoint["legName"]
        assert retrieved_waypoint["distance_miles"] == original_waypoint["distanceMiles"]
        assert retrieved_waypoint["latitude"] == original_waypoint["latitude"]
        assert retrieved_waypoint["longitude"] == original_waypoint["longitude"]
        
        # Verify track point data
        track_points = retrieved_data["trackPoints"]
        assert len(track_points) == len(sample_route_data["trackPoints"])
        
        original_point = sample_route_data["trackPoints"][0]
        retrieved_point = track_points[0]
        
        assert retrieved_point["latitude"] == original_point["lat"]
        assert retrieved_point["longitude"] == original_point["lon"]
        assert retrieved_point["elevation"] == original_point["elevation"]
        
        # Clean up
        client.delete(f"/api/routes/{route_id}")

    def test_database_constraints_enforcement(self, client, sample_route_data):
        """Test that database constraints are properly enforced"""
        # Create route
        create_response = client.post("/api/routes", json=sample_route_data)
        route_id = create_response.json()["routeId"]
        
        # Get waypoint and track point counts
        route_data = client.get(f"/api/routes/{route_id}").json()
        waypoint_count = len(route_data["waypoints"])
        track_point_count = len(route_data["trackPoints"])
        
        assert waypoint_count > 0
        assert track_point_count > 0
        
        # Delete route
        delete_response = client.delete(f"/api/routes/{route_id}")
        assert delete_response.status_code == status.HTTP_200_OK
        
        # Verify that waypoints and track points were cascaded
        # (We can't directly check the database in this integration test,
        # but we can verify the route is gone)
        get_response = client.get(f"/api/routes/{route_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_error_handling_integration(self, client):
        """Test error handling across the full stack"""
        # Test invalid route ID format
        invalid_id_response = client.get("/api/routes/invalid-id")
        assert invalid_id_response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test non-existent route
        missing_route_response = client.get("/api/routes/123e4567-e89b-12d3-a456-426614174000")
        assert missing_route_response.status_code == status.HTTP_404_NOT_FOUND
        
        # Test invalid route data
        invalid_data = {
            "filename": "",  # Empty filename should trigger validation error
            "totalDistance": 10.0,
            "totalElevationGain": 100.0,
            "totalElevationLoss": 50.0
        }
        
        invalid_create_response = client.post("/api/routes", json=invalid_data)
        assert invalid_create_response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        # Test invalid waypoint update
        invalid_waypoint_response = client.put(
            "/api/waypoints/invalid-id/notes", 
            json={"notes": "test"}
        )
        assert invalid_waypoint_response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_health_check_reflects_data(self, client, minimal_route_data):
        """Test that health check accurately reflects application state"""
        # Check initial health
        initial_health = client.get("/health").json()
        assert initial_health["status"] == "healthy"
        assert initial_health["routes_count"] == 0
        
        # Create a route
        create_response = client.post("/api/routes", json=minimal_route_data)
        route_id = create_response.json()["routeId"]
        
        # Check health with data
        health_with_data = client.get("/health").json()
        assert health_with_data["status"] == "healthy"
        assert health_with_data["routes_count"] == 1
        
        # Delete route
        client.delete(f"/api/routes/{route_id}")
        
        # Check health after deletion
        final_health = client.get("/health").json()
        assert final_health["status"] == "healthy"
        assert final_health["routes_count"] == 0 