"""
Pydantic models for request/response validation and data serialization.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime


# Authentication Models
class UserCreate(BaseModel):
    """Model for user registration."""
    username: str = Field(..., min_length=3, max_length=50, description="Username (3-50 characters)")
    email: str = Field(..., description="Valid email address")
    password: str = Field(..., min_length=8, description="Password (minimum 8 characters)")


class UserLogin(BaseModel):
    """Model for user login."""
    username_or_email: str = Field(..., description="Username or email address")
    password: str = Field(..., description="User password")


class User(BaseModel):
    """Model for user data (without sensitive information)."""
    id: int
    username: str
    email: str
    created_at: str
    is_active: bool = True


class UserResponse(BaseModel):
    """Model for user authentication response."""
    user_id: int
    username: str
    email: str
    access_token: str
    token_type: str = "bearer"


class PasswordChange(BaseModel):
    """Model for password change request."""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password (minimum 8 characters)")


# Route and GPX Models (Updated for Multi-user)
class RouteCreate(BaseModel):
    """Model for creating a new route."""
    name: str = Field(..., min_length=1, max_length=200, description="Route name")
    description: Optional[str] = Field(None, description="Route description")
    is_public: bool = Field(False, description="Make route publicly visible")


class RouteUpdate(BaseModel):
    """Model for updating an existing route."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    is_public: Optional[bool] = None
    target_time_seconds: Optional[int] = Field(None, ge=0, description="Target completion time in seconds")
    slowdown_factor_percent: Optional[float] = Field(None, ge=0, le=100, description="Slowdown factor percentage (0-100)")
    start_time: Optional[str] = Field(None, description="Race start time in HH:MM format")


class Route(BaseModel):
    """Model for route data."""
    id: int
    user_id: int
    name: str
    description: Optional[str]
    total_distance_meters: float
    total_elevation_gain_meters: float
    estimated_time_seconds: int
    created_at: str
    updated_at: str
    is_public: bool


class WaypointCreate(BaseModel):
    """Model for creating a waypoint."""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    elevation_meters: Optional[float] = None
    order_index: int = Field(..., ge=0)
    waypoint_type: str = Field("checkpoint", pattern="^(start|checkpoint|finish|poi)$")
    target_pace_per_km_seconds: Optional[int] = Field(None, gt=0)
    rest_time_seconds: Optional[int] = Field(0, ge=0, description="Rest time in seconds")


class WaypointUpdate(BaseModel):
    """Model for updating a waypoint."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    elevation_meters: Optional[float] = None
    order_index: Optional[int] = Field(None, ge=0)
    waypoint_type: Optional[str] = Field(None, pattern="^(start|checkpoint|finish|poi)$")
    target_pace_per_km_seconds: Optional[int] = Field(None, gt=0)
    rest_time_seconds: Optional[int] = Field(None, ge=0, description="Rest time in seconds")


class WaypointDB(BaseModel):
    """Model for waypoint data from database."""
    id: int
    route_id: int
    name: str
    description: Optional[str]
    latitude: float
    longitude: float
    elevation_meters: Optional[float]
    order_index: int
    waypoint_type: str
    target_pace_per_km_seconds: Optional[int]
    rest_time_seconds: Optional[int]
    created_at: str


class RouteSegment(BaseModel):
    """Model for route segment data."""
    id: int
    route_id: int
    from_waypoint_id: int
    to_waypoint_id: int
    distance_meters: float
    elevation_gain_meters: float
    elevation_loss_meters: float
    estimated_time_seconds: Optional[int]
    created_at: str


class TrackPointDB(BaseModel):
    """Model for simplified track points from database."""
    id: int
    route_segment_id: int
    latitude: float
    longitude: float
    elevation_meters: Optional[float]
    distance_from_segment_start_meters: float
    point_index: int


class RouteWithDetails(Route):
    """Extended route model with waypoints and segments."""
    waypoints: List[WaypointDB] = []
    segments: List[RouteSegment] = []
    track_points: List[TrackPointDB] = []


# Original GPX Models (Updated)
class GPXPoint(BaseModel):
    """Model for a GPX track point with coordinates and elevation."""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude in decimal degrees")
    elevation: Optional[float] = Field(None, description="Elevation in meters")
    time: Optional[str] = Field(None, description="ISO timestamp")


class GPXAnalysisRequest(BaseModel):
    """Model for GPX analysis request."""
    track_points: List[GPXPoint] = Field(..., min_items=2, description="List of track points")
    route_name: Optional[str] = Field(None, description="Name for the route")
    optimize_storage: bool = Field(True, description="Apply storage optimization")


class GPXUploadResponse(BaseModel):
    """Model for GPX upload response."""
    route_id: int
    route_name: str
    original_points: int
    optimized_points: int
    compression_ratio: float
    total_distance_meters: float
    total_elevation_gain_meters: float
    processing_time_seconds: float


class PacePlan(BaseModel):
    """Model for pace planning data."""
    distance_km: float
    target_time_seconds: int
    pace_per_km_seconds: int
    splits: List[Dict[str, Any]]


class RouteExport(BaseModel):
    """Model for route export options."""
    format: str = Field(..., pattern="^(gpx|csv|pdf)$", description="Export format")
    include_waypoints: bool = Field(True, description="Include waypoints in export")
    include_elevation: bool = Field(True, description="Include elevation data")


class RouteAnalysis(BaseModel):
    """Model for route analysis results."""
    total_distance: float = Field(..., description="Total distance in kilometers")
    total_elevation_gain: float = Field(..., description="Total elevation gain in meters")
    total_elevation_loss: float = Field(..., description="Total elevation loss in meters")
    moving_time: float = Field(..., description="Estimated moving time in hours")
    pace_analysis: Dict[str, Any] = Field(..., description="Pace analysis data")
    elevation_profile: List[Dict[str, float]] = Field(..., description="Elevation profile points")


class SavedRoute(BaseModel):
    """Model for saved route data."""
    id: int
    name: str
    distance: float
    elevation_gain: float
    created_at: str


class ExportRequest(BaseModel):
    """Model for route export request."""
    format: str = Field(..., pattern="^(csv|pdf)$", description="Export format (csv or pdf)")
    include_pace_plan: bool = Field(False, description="Include pace planning data")


# Legacy models for backward compatibility
class Waypoint(BaseModel):
    """Legacy waypoint model for backward compatibility."""
    legNumber: int = Field(..., description="Leg number")
    legName: str = Field(..., description="Leg name")
    distanceMiles: float = Field(..., description="Distance in miles")
    cumulativeDistance: float = Field(..., description="Cumulative distance")
    durationSeconds: float = Field(..., description="Duration in seconds")
    legPaceSeconds: float = Field(..., description="Pace per mile in seconds")
    elevationGain: float = Field(..., description="Elevation gain")
    elevationLoss: float = Field(..., description="Elevation loss")
    cumulativeElevationGain: float = Field(..., description="Cumulative elevation gain")
    cumulativeElevationLoss: float = Field(..., description="Cumulative elevation loss")
    restTimeSeconds: int = Field(0, description="Rest time in seconds")
    notes: str = Field("", description="Notes")
    latitude: float = Field(..., description="Latitude")
    longitude: float = Field(..., description="Longitude")
    elevation: float = Field(..., description="Elevation")


class TrackPoint(BaseModel):
    """Legacy track point model for backward compatibility."""
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    elevation: Optional[float] = Field(None, description="Elevation")
    time: Optional[str] = Field(None, description="Timestamp")
    distance: Optional[float] = Field(None, description="Distance from start")
    cumulativeDistance: Optional[float] = Field(None, description="Cumulative distance")


class RouteData(BaseModel):
    """Legacy route data model for backward compatibility."""
    filename: str = Field(..., description="Route filename")
    totalDistance: float = Field(..., description="Total distance")
    totalElevationGain: float = Field(..., description="Total elevation gain")
    totalElevationLoss: float = Field(..., description="Total elevation loss")
    startTime: Optional[str] = Field(None, description="Start time")
    targetTimeSeconds: Optional[int] = Field(None, description="Target time in seconds")
    slowdownFactorPercent: float = Field(0, description="Slowdown factor percentage")
    hasValidTime: bool = Field(False, description="Has valid time data")
    usingTargetTime: bool = Field(False, description="Using target time")
    gpxData: Optional[str] = Field(None, description="GPX data")
    waypoints: List[Waypoint] = Field([], description="List of waypoints")
    trackPoints: List[TrackPoint] = Field([], description="List of track points")


class RouteResponse(BaseModel):
    """Response model for route operations."""
    routeId: str = Field(..., description="Route ID")
    message: str = Field(..., description="Response message")


class WaypointNotesUpdate(BaseModel):
    """Model for updating waypoint notes."""
    notes: str


class RouteListItem(BaseModel):
    """Model for route list items."""
    id: str
    filename: str
    upload_date: str
    total_distance: float
    total_elevation_gain: float
    total_elevation_loss: float
    start_time: Optional[str] = None
    target_time_seconds: Optional[int] = None
    slowdown_factor_percent: Optional[float] = None
    has_valid_time: Optional[bool] = None
    using_target_time: Optional[bool] = None


class RouteDetail(BaseModel):
    """Model for detailed route information."""
    route: dict
    waypoints: List[dict]
    trackPoints: List[dict] 