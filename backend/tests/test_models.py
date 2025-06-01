import pytest
from pydantic import ValidationError

from models import (
    Waypoint, TrackPoint, RouteData, RouteResponse, 
    WaypointNotesUpdate, RouteListItem, RouteDetail
)


class TestModels:
    """Test suite for Pydantic models"""

    def test_waypoint_model_valid(self, sample_waypoint_data):
        """Test valid waypoint model creation"""
        waypoint = Waypoint(**sample_waypoint_data)
        
        assert waypoint.legNumber == sample_waypoint_data["legNumber"]
        assert waypoint.legName == sample_waypoint_data["legName"]
        assert waypoint.distanceMiles == sample_waypoint_data["distanceMiles"]
        assert waypoint.latitude == sample_waypoint_data["latitude"]
        assert waypoint.longitude == sample_waypoint_data["longitude"]

    def test_waypoint_model_defaults(self):
        """Test waypoint model with default values"""
        minimal_data = {
            "legNumber": 1,
            "distanceMiles": 1.0,
            "cumulativeDistance": 1.0,
            "durationSeconds": 360.0,
            "legPaceSeconds": 360.0,
            "elevationGain": 50.0,
            "elevationLoss": 10.0,
            "cumulativeElevationGain": 50.0,
            "cumulativeElevationLoss": 10.0,
            "latitude": 40.0,
            "longitude": -74.0,
            "elevation": 100.0
        }
        
        waypoint = Waypoint(**minimal_data)
        
        assert waypoint.legName is None
        assert waypoint.restTimeSeconds == 0
        assert waypoint.notes == ""

    def test_waypoint_model_invalid_types(self):
        """Test waypoint model with invalid data types"""
        invalid_data = {
            "legNumber": "invalid",  # Should be int
            "distanceMiles": 1.0,
            "cumulativeDistance": 1.0,
            "durationSeconds": 360.0,
            "legPaceSeconds": 360.0,
            "elevationGain": 50.0,
            "elevationLoss": 10.0,
            "cumulativeElevationGain": 50.0,
            "cumulativeElevationLoss": 10.0,
            "latitude": 40.0,
            "longitude": -74.0,
            "elevation": 100.0
        }
        
        with pytest.raises(ValidationError):
            Waypoint(**invalid_data)

    def test_track_point_model_valid(self):
        """Test valid track point model creation"""
        track_point_data = {
            "lat": 40.0,
            "lon": -74.0,
            "elevation": 100.0,
            "time": "2023-01-01T10:00:00Z",
            "distance": 0.5,
            "cumulativeDistance": 5.0
        }
        
        track_point = TrackPoint(**track_point_data)
        
        assert track_point.lat == track_point_data["lat"]
        assert track_point.lon == track_point_data["lon"]
        assert track_point.elevation == track_point_data["elevation"]
        assert track_point.time == track_point_data["time"]

    def test_track_point_model_minimal(self):
        """Test track point model with only required fields"""
        minimal_data = {
            "lat": 40.0,
            "lon": -74.0
        }
        
        track_point = TrackPoint(**minimal_data)
        
        assert track_point.lat == 40.0
        assert track_point.lon == -74.0
        assert track_point.elevation is None
        assert track_point.time is None
        assert track_point.distance is None
        assert track_point.cumulativeDistance is None

    def test_track_point_model_invalid_coordinates(self):
        """Test track point model with invalid coordinates"""
        invalid_data = {
            "lat": "invalid",  # Should be float
            "lon": -74.0
        }
        
        with pytest.raises(ValidationError):
            TrackPoint(**invalid_data)

    def test_route_data_model_valid(self, sample_route_data):
        """Test valid route data model creation"""
        route_data = RouteData(**sample_route_data)
        
        assert route_data.filename == sample_route_data["filename"]
        assert route_data.totalDistance == sample_route_data["totalDistance"]
        assert route_data.totalElevationGain == sample_route_data["totalElevationGain"]
        assert len(route_data.waypoints) == len(sample_route_data["waypoints"])
        assert len(route_data.trackPoints) == len(sample_route_data["trackPoints"])

    def test_route_data_model_minimal(self, minimal_route_data):
        """Test route data model with minimal required fields"""
        route_data = RouteData(**minimal_route_data)
        
        assert route_data.filename == minimal_route_data["filename"]
        assert route_data.totalDistance == minimal_route_data["totalDistance"]
        assert route_data.startTime is None
        assert route_data.targetTimeSeconds is None
        assert route_data.slowdownFactorPercent == 0
        assert route_data.hasValidTime is False
        assert route_data.usingTargetTime is False
        assert route_data.gpxData is None
        assert route_data.waypoints == []
        assert route_data.trackPoints == []

    def test_route_data_model_missing_required(self):
        """Test route data model with missing required fields"""
        invalid_data = {
            "totalDistance": 10.0,
            "totalElevationGain": 100.0,
            "totalElevationLoss": 50.0
            # Missing filename
        }
        
        with pytest.raises(ValidationError):
            RouteData(**invalid_data)

    def test_route_data_model_invalid_types(self):
        """Test route data model with invalid data types"""
        invalid_data = {
            "filename": "test.gpx",
            "totalDistance": "invalid",  # Should be float
            "totalElevationGain": 100.0,
            "totalElevationLoss": 50.0
        }
        
        with pytest.raises(ValidationError):
            RouteData(**invalid_data)

    def test_route_response_model(self):
        """Test route response model"""
        response_data = {
            "routeId": "123e4567-e89b-12d3-a456-426614174000",
            "message": "Route saved successfully"
        }
        
        response = RouteResponse(**response_data)
        
        assert response.routeId == response_data["routeId"]
        assert response.message == response_data["message"]

    def test_waypoint_notes_update_model(self):
        """Test waypoint notes update model"""
        notes_data = {"notes": "Updated notes"}
        
        notes_update = WaypointNotesUpdate(**notes_data)
        
        assert notes_update.notes == notes_data["notes"]

    def test_waypoint_notes_update_empty(self):
        """Test waypoint notes update with empty notes"""
        notes_data = {"notes": ""}
        
        notes_update = WaypointNotesUpdate(**notes_data)
        
        assert notes_update.notes == ""

    def test_route_list_item_model(self):
        """Test route list item model"""
        list_item_data = {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "filename": "test.gpx",
            "upload_date": "2023-01-01T10:00:00Z",
            "total_distance": 10.5,
            "total_elevation_gain": 500.0,
            "total_elevation_loss": 450.0,
            "start_time": "2023-01-01T10:00:00Z",
            "target_time_seconds": 3600,
            "slowdown_factor_percent": 5.0,
            "has_valid_time": True,
            "using_target_time": True
        }
        
        list_item = RouteListItem(**list_item_data)
        
        assert list_item.id == list_item_data["id"]
        assert list_item.filename == list_item_data["filename"]
        assert list_item.total_distance == list_item_data["total_distance"]

    def test_route_list_item_optional_fields(self):
        """Test route list item model with optional fields as None"""
        minimal_data = {
            "id": "123e4567-e89b-12d3-a456-426614174000",
            "filename": "test.gpx",
            "upload_date": "2023-01-01T10:00:00Z",
            "total_distance": 10.5,
            "total_elevation_gain": 500.0,
            "total_elevation_loss": 450.0
        }
        
        list_item = RouteListItem(**minimal_data)
        
        assert list_item.start_time is None
        assert list_item.target_time_seconds is None
        assert list_item.slowdown_factor_percent is None
        assert list_item.has_valid_time is None
        assert list_item.using_target_time is None

    def test_route_detail_model(self):
        """Test route detail model"""
        detail_data = {
            "route": {"id": "123e4567-e89b-12d3-a456-426614174000", "filename": "test.gpx"},
            "waypoints": [{"id": "waypoint1", "legNumber": 1}],
            "trackPoints": [{"lat": 40.0, "lon": -74.0}]
        }
        
        detail = RouteDetail(**detail_data)
        
        assert detail.route == detail_data["route"]
        assert detail.waypoints == detail_data["waypoints"]
        assert detail.trackPoints == detail_data["trackPoints"]

    def test_nested_model_validation(self):
        """Test nested model validation in route data"""
        route_data = {
            "filename": "test.gpx",
            "totalDistance": 10.0,
            "totalElevationGain": 100.0,
            "totalElevationLoss": 50.0,
            "waypoints": [
                {
                    "legNumber": "invalid",  # Should be int
                    "distanceMiles": 1.0,
                    "cumulativeDistance": 1.0,
                    "durationSeconds": 360.0,
                    "legPaceSeconds": 360.0,
                    "elevationGain": 50.0,
                    "elevationLoss": 10.0,
                    "cumulativeElevationGain": 50.0,
                    "cumulativeElevationLoss": 10.0,
                    "latitude": 40.0,
                    "longitude": -74.0,
                    "elevation": 100.0
                }
            ]
        }
        
        with pytest.raises(ValidationError):
            RouteData(**route_data)

    def test_model_serialization(self, sample_route_data):
        """Test model serialization to dict"""
        route_data = RouteData(**sample_route_data)
        serialized = route_data.model_dump()
        
        assert isinstance(serialized, dict)
        assert serialized["filename"] == sample_route_data["filename"]
        assert "waypoints" in serialized
        assert "trackPoints" in serialized 