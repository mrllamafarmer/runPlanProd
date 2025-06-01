from pydantic import BaseModel
from typing import List, Optional, Any
from datetime import datetime

class Waypoint(BaseModel):
    legNumber: int
    legName: Optional[str] = None
    distanceMiles: float
    cumulativeDistance: float
    durationSeconds: float
    legPaceSeconds: float
    elevationGain: float
    elevationLoss: float
    cumulativeElevationGain: float
    cumulativeElevationLoss: float
    restTimeSeconds: Optional[int] = 0
    notes: Optional[str] = ""
    latitude: float
    longitude: float
    elevation: float

class TrackPoint(BaseModel):
    lat: float
    lon: float
    elevation: Optional[float] = None
    time: Optional[str] = None
    distance: Optional[float] = None
    cumulativeDistance: Optional[float] = None

class RouteData(BaseModel):
    filename: str
    totalDistance: float
    totalElevationGain: float
    totalElevationLoss: float
    startTime: Optional[str] = None
    targetTimeSeconds: Optional[int] = None
    slowdownFactorPercent: Optional[float] = 0
    hasValidTime: Optional[bool] = False
    usingTargetTime: Optional[bool] = False
    gpxData: Optional[str] = None
    waypoints: Optional[List[Waypoint]] = []
    trackPoints: Optional[List[TrackPoint]] = []

class RouteResponse(BaseModel):
    routeId: str
    message: str

class WaypointNotesUpdate(BaseModel):
    notes: str

class RouteListItem(BaseModel):
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
    route: dict
    waypoints: List[dict]
    trackPoints: List[dict] 