"""
Race Analysis API endpoints
Handles saving and retrieving race performance analysis data
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date, datetime
from decimal import Decimal
import json
import logging

from database import get_db_connection
from models import User
from auth import auth_manager
from exceptions import AuthenticationError

# Security scheme for JWT
security = HTTPBearer()

# Logger
logger = logging.getLogger(__name__)

# Authentication dependency
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current authenticated user from JWT token"""
    try:
        token = credentials.credentials
        user = auth_manager.get_current_user(token)
        return user
    except AuthenticationError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

router = APIRouter(prefix="/api/race-analysis", tags=["race-analysis"])

# Pydantic models for race analysis
class RaceTrackPointCreate(BaseModel):
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude") 
    elevation: Optional[float] = Field(None, description="Elevation in meters")
    cumulativeTime: int = Field(..., description="Cumulative time from race start in seconds")
    cumulativeDistance: float = Field(..., description="Cumulative distance in miles")
    order: int = Field(..., description="Point order in sequence")

class WaypointComparisonCreate(BaseModel):
    waypointId: int = Field(..., description="Waypoint ID")
    plannedCumulativeTime: int = Field(..., description="Planned cumulative time in seconds")
    actualCumulativeTime: Optional[int] = Field(None, description="Actual cumulative time in seconds")
    timeDifference: Optional[int] = Field(None, description="Time difference (actual - planned)")
    legDuration: Optional[int] = Field(None, description="Actual leg duration in seconds")
    legDistance: Optional[float] = Field(None, description="Leg distance in miles")
    actualPace: Optional[int] = Field(None, description="Actual pace in seconds per mile")
    plannedPace: Optional[int] = Field(None, description="Planned pace in seconds per mile")
    closestPointLat: Optional[float] = Field(None, description="Closest track point latitude")
    closestPointLon: Optional[float] = Field(None, description="Closest track point longitude")

class RaceAnalysisCreate(BaseModel):
    routeId: int = Field(..., description="Route ID this analysis is for")
    raceName: str = Field(..., max_length=255, description="Name for this race")
    raceDate: Optional[date] = Field(None, description="Date of the race")
    actualGpxFilename: str = Field(..., max_length=255, description="Original GPX filename")
    totalRaceTimeSeconds: int = Field(..., description="Total race time in seconds")
    totalActualDistanceMeters: float = Field(..., description="Total actual distance in meters")
    raceStartTime: Optional[datetime] = Field(None, description="Race start timestamp")
    notes: Optional[str] = Field(None, description="Additional notes")
    trackPoints: List[RaceTrackPointCreate] = Field(..., description="Sampled race track points")
    waypointComparisons: List[WaypointComparisonCreate] = Field(..., description="Waypoint comparisons")

class RaceAnalysisResponse(BaseModel):
    id: int
    routeId: int
    routeName: str
    raceName: str
    raceDate: Optional[date]
    actualGpxFilename: str
    totalRaceTimeSeconds: int
    totalActualDistanceMeters: float
    raceStartTime: Optional[datetime]
    notes: Optional[str]
    createdAt: datetime
    waypointCount: int
    trackPointCount: Optional[int] = None

class RaceAnalysisDetail(RaceAnalysisResponse):
    comparisonData: List[Dict[str, Any]]
    trackPointsData: List[Dict[str, Any]]

@router.post("/", response_model=Dict[str, Any])
async def create_race_analysis(
    analysis_data: RaceAnalysisCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new race analysis with track points and waypoint comparisons"""
    
    logger.info(f"Creating race analysis for user {current_user.id}, route {analysis_data.routeId}")
    logger.info(f"Analysis data: raceName={analysis_data.raceName}, raceDate={analysis_data.raceDate}")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Create the race analysis
            logger.info("Executing create_race_analysis function")
            cursor.execute("""
                SELECT create_race_analysis(%s, %s, %s, %s::date, %s, %s, %s::decimal, %s::timestamp, %s::text)
            """, (
                analysis_data.routeId,
                current_user.id,
                analysis_data.raceName,
                analysis_data.raceDate,
                analysis_data.actualGpxFilename,
                analysis_data.totalRaceTimeSeconds,
                analysis_data.totalActualDistanceMeters,
                analysis_data.raceStartTime,
                analysis_data.notes
            ))
            
            result = cursor.fetchone()
            logger.info(f"Raw result from cursor.fetchone(): {result}")
            logger.info(f"Result type: {type(result)}")
            
            if result is None:
                raise ValueError("Database function returned None")
            
            try:
                # Handle both tuple and RealDictRow formats
                if hasattr(result, 'keys'):
                    # RealDictRow format
                    analysis_id = result['create_race_analysis']
                else:
                    # Tuple format
                    analysis_id = result[0]
                logger.info(f"create_race_analysis returned: {analysis_id}")
            except (KeyError, IndexError, TypeError) as e:
                logger.error(f"Error accessing result: {e}")
                logger.error(f"Result content: {result}")
                raise ValueError(f"Invalid result format from database function: {result}")
            
            if not analysis_id:
                raise ValueError("Failed to create race analysis - no ID returned")
            
            # Add track points
            track_points_json = []
            for i, point in enumerate(analysis_data.trackPoints):
                track_points_json.append({
                    "lat": point.lat,
                    "lon": point.lon,
                    "elevation": point.elevation,
                    "cumulativeTime": point.cumulativeTime,
                    "cumulativeDistance": point.cumulativeDistance * 1609.34,  # Convert miles to meters
                    "order": i
                })
            
            cursor.execute("""
                SELECT add_race_track_points(%s, %s)
            """, (analysis_id, json.dumps(track_points_json)))
            
            track_result = cursor.fetchone()
            track_points_added = track_result['add_race_track_points'] if hasattr(track_result, 'keys') else track_result[0]
            
            # Add waypoint comparisons
            comparisons_json = []
            for comp in analysis_data.waypointComparisons:
                comparisons_json.append({
                    "waypointId": comp.waypointId,
                    "plannedCumulativeTime": comp.plannedCumulativeTime,
                    "actualCumulativeTime": comp.actualCumulativeTime,
                    "timeDifference": comp.timeDifference,
                    "legDuration": comp.legDuration,
                    "legDistance": comp.legDistance,
                    "actualPace": comp.actualPace,
                    "plannedPace": comp.plannedPace,
                    "closestPointLat": comp.closestPointLat,
                    "closestPointLon": comp.closestPointLon
                })
            
            cursor.execute("""
                SELECT add_waypoint_comparisons(%s, %s)
            """, (analysis_id, json.dumps(comparisons_json)))
            
            comparisons_result = cursor.fetchone()
            comparisons_added = comparisons_result['add_waypoint_comparisons'] if hasattr(comparisons_result, 'keys') else comparisons_result[0]
            
            conn.commit()
            
            return {
                "id": analysis_id,
                "message": "Race analysis saved successfully",
                "trackPointsAdded": track_points_added,
                "comparisonsAdded": comparisons_added
            }
            
    except Exception as e:
        logger.error(f"Exception in create_race_analysis: {str(e)}")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save race analysis: {str(e)}"
        )
    finally:
        conn.close()

@router.get("/", response_model=List[RaceAnalysisResponse])
async def get_user_race_analyses(current_user: User = Depends(get_current_user)):
    """Get all race analyses for the current user"""
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM get_user_race_analyses(%s)
            """, (current_user.id,))
            
            analyses = []
            for row in cursor.fetchall():
                # Handle both tuple and RealDictRow formats
                if hasattr(row, 'keys'):
                    analyses.append(RaceAnalysisResponse(
                        id=row['id'],
                        routeId=row['route_id'],
                        routeName=row['route_name'],
                        raceName=row['race_name'],
                        raceDate=row['race_date'],
                        actualGpxFilename=row['actual_gpx_filename'],
                        totalRaceTimeSeconds=row['total_race_time_seconds'],
                        totalActualDistanceMeters=float(row['total_actual_distance_meters']),
                        raceStartTime=row['race_start_time'],
                        notes=row['notes'],
                        createdAt=row['created_at'],
                        waypointCount=row['waypoint_count'],
                        trackPointCount=row['track_point_count']
                    ))
                else:
                    analyses.append(RaceAnalysisResponse(
                        id=row[0],
                        routeId=row[1],
                        routeName=row[2],
                        raceName=row[3],
                        raceDate=row[4],
                        actualGpxFilename=row[5],
                        totalRaceTimeSeconds=row[6],
                        totalActualDistanceMeters=float(row[7]),
                        raceStartTime=row[8],
                        notes=row[9],
                        createdAt=row[10],
                        waypointCount=row[11],
                        trackPointCount=row[12]
                    ))
            
            return analyses
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve race analyses: {str(e)}"
        )
    finally:
        conn.close()

@router.get("/route/{route_id}", response_model=List[RaceAnalysisResponse])
async def get_route_race_analyses(
    route_id: int,
    current_user: User = Depends(get_current_user)
):
    """Get all race analyses for a specific route"""
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM get_route_race_analyses(%s, %s)
            """, (route_id, current_user.id))
            
            analyses = []
            for row in cursor.fetchall():
                # Handle both tuple and RealDictRow formats
                if hasattr(row, 'keys'):
                    analyses.append(RaceAnalysisResponse(
                        id=row['id'],
                        routeId=route_id,
                        routeName="",  # Not returned by this function
                        raceName=row['race_name'],
                        raceDate=row['race_date'],
                        actualGpxFilename=row['actual_gpx_filename'],
                        totalRaceTimeSeconds=row['total_race_time_seconds'],
                        totalActualDistanceMeters=float(row['total_actual_distance_meters']),
                        raceStartTime=row['race_start_time'],
                        notes=row['notes'],
                        createdAt=row['created_at'],
                        waypointCount=row['waypoint_count']
                    ))
                else:
                    analyses.append(RaceAnalysisResponse(
                        id=row[0],
                        routeId=route_id,
                        routeName="",  # Not returned by this function
                        raceName=row[1],
                        raceDate=row[2],
                        actualGpxFilename=row[3],
                        totalRaceTimeSeconds=row[4],
                        totalActualDistanceMeters=float(row[5]),
                        raceStartTime=row[6],
                        notes=row[7],
                        createdAt=row[8],
                        waypointCount=row[9]
                    ))
            
            return analyses
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve route race analyses: {str(e)}"
        )
    finally:
        conn.close()

@router.get("/{analysis_id}", response_model=RaceAnalysisDetail)
async def get_race_analysis_detail(
    analysis_id: int,
    current_user: User = Depends(get_current_user)
):
    """Get detailed race analysis with comparisons and track points"""
    
    logger.info(f"Getting race analysis detail for ID {analysis_id}, user {current_user.id}")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            logger.info("Executing get_race_analysis_detail database function")
            cursor.execute("""
                SELECT * FROM get_race_analysis_detail(%s, %s)
            """, (analysis_id, current_user.id))
            
            row = cursor.fetchone()
            logger.info(f"Database function returned: {row}")
            if not row:
                logger.warning(f"No race analysis found for ID {analysis_id}")
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Race analysis not found"
                )
            
            # Handle both tuple and RealDictRow formats
            if hasattr(row, 'keys'):
                return RaceAnalysisDetail(
                    id=row['analysis_id'],
                    routeId=row['route_id'],
                    routeName=row['route_name'],
                    raceName=row['race_name'],
                    raceDate=row['race_date'],
                    actualGpxFilename=row['actual_gpx_filename'],
                    totalRaceTimeSeconds=row['total_race_time_seconds'],
                    totalActualDistanceMeters=float(row['total_actual_distance_meters']),
                    raceStartTime=row['race_start_time'],
                    notes=row['notes'],
                    createdAt=row['created_at'],
                    comparisonData=row['comparison_data'] if row['comparison_data'] else [],
                    trackPointsData=row['track_points_data'] if row['track_points_data'] else [],
                    waypointCount=len(row['comparison_data']) if row['comparison_data'] else 0
                )
            else:
                return RaceAnalysisDetail(
                    id=row[0],
                    routeId=row[1],
                    routeName=row[2],
                    raceName=row[3],
                    raceDate=row[4],
                    actualGpxFilename=row[5],
                    totalRaceTimeSeconds=row[6],
                    totalActualDistanceMeters=float(row[7]),
                    raceStartTime=row[8],
                    notes=row[9],
                    createdAt=row[10],
                    comparisonData=row[11] if row[11] else [],
                    trackPointsData=row[12] if row[12] else [],
                    waypointCount=len(row[11]) if row[11] else 0
                )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Exception in get_race_analysis_detail: {str(e)}")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve race analysis detail: {str(e)}"
        )
    finally:
        conn.close()

@router.delete("/{analysis_id}")
async def delete_race_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user)
):
    """Delete a race analysis"""
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT delete_race_analysis(%s, %s)
            """, (analysis_id, current_user.id))
            
            delete_result = cursor.fetchone()
            deleted = delete_result['delete_race_analysis'] if hasattr(delete_result, 'keys') else delete_result[0]
            
            if not deleted:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Race analysis not found"
                )
            
            conn.commit()
            
            return {"message": "Race analysis deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete race analysis: {str(e)}"
        )
    finally:
        conn.close() 