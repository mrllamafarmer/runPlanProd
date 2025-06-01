from fastapi import FastAPI, HTTPException, status, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
import os
import logging
import time
from pathlib import Path
from contextlib import asynccontextmanager

from database import Database
from models import RouteData, RouteResponse, WaypointNotesUpdate, RouteListItem, RouteDetail
from exceptions import (
    GPXAnalyzerException, DatabaseException, RouteNotFoundException, 
    WaypointNotFoundException, ValidationException
)
from logging_config import setup_logging

# Initialize logging first
logger = setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("Starting GPX Route Analyzer application")
    yield
    logger.info("Shutting down GPX Route Analyzer application")

# Initialize FastAPI app
app = FastAPI(
    title="GPX Route Analyzer", 
    version="1.0.0",
    description="A production-grade GPX route analysis API",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests and responses"""
    start_time = time.time()
    
    # Log request
    logger.info(f"Request: {request.method} {request.url}")
    logger.debug(f"Request headers: {dict(request.headers)}")
    
    try:
        response = await call_next(request)
        
        # Log response
        process_time = time.time() - start_time
        logger.info(f"Response: {request.method} {request.url} - {response.status_code} - {process_time:.3f}s")
        
        return response
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(f"Request failed: {request.method} {request.url} - {str(e)} - {process_time:.3f}s")
        raise

# Initialize database
try:
    db = Database()
    logger.info("Database initialized successfully")
except Exception as e:
    logger.critical(f"Failed to initialize database: {e}")
    raise

# Custom exception handlers
@app.exception_handler(RouteNotFoundException)
async def route_not_found_handler(request: Request, exc: RouteNotFoundException):
    logger.warning(f"Route not found: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": "Route not found", "detail": exc.message}
    )

@app.exception_handler(WaypointNotFoundException)
async def waypoint_not_found_handler(request: Request, exc: WaypointNotFoundException):
    logger.warning(f"Waypoint not found: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": "Waypoint not found", "detail": exc.message}
    )

@app.exception_handler(DatabaseException)
async def database_exception_handler(request: Request, exc: DatabaseException):
    logger.error(f"Database error: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Database error", "detail": "An internal database error occurred"}
    )

@app.exception_handler(ValidationException)
async def validation_exception_handler(request: Request, exc: ValidationException):
    logger.warning(f"Validation error: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "Validation error", "detail": exc.message}
    )

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Request validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "Request validation failed", "detail": exc.errors()}
    )

@app.exception_handler(GPXAnalyzerException)
async def gpx_exception_handler(request: Request, exc: GPXAnalyzerException):
    logger.error(f"GPX Analyzer error: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Application error", "detail": exc.message}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.critical(f"Unhandled exception: {type(exc).__name__}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error", "detail": "An unexpected error occurred"}
    )

# API Routes

@app.post("/api/routes", response_model=RouteResponse)
async def create_route(route_data: RouteData):
    """Save a complete route with all data"""
    logger.info(f"Creating new route with filename: {route_data.filename}")
    
    try:
        # Validate essential data
        if not route_data.filename:
            raise ValidationException("Filename is required")
        
        if route_data.totalDistance <= 0:
            raise ValidationException("Total distance must be greater than 0")
        
        # Convert Pydantic model to dict
        route_dict = route_data.model_dump()
        
        # Save to database
        route_id = db.save_route(route_dict)
        
        logger.info(f"Successfully created route {route_id}")
        return RouteResponse(
            routeId=route_id,
            message="Route saved successfully"
        )
    
    except ValidationException:
        raise
    except DatabaseException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating route: {e}")
        raise GPXAnalyzerException(f"Failed to create route: {str(e)}")

@app.get("/api/routes")
async def get_all_routes():
    """Get all routes"""
    logger.debug("Retrieving all routes")
    
    try:
        routes = db.get_all_routes()
        logger.info(f"Successfully retrieved {len(routes)} routes")
        return routes
    
    except DatabaseException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error retrieving routes: {e}")
        raise GPXAnalyzerException(f"Failed to retrieve routes: {str(e)}")

@app.get("/api/routes/{route_id}")
async def get_route(route_id: str):
    """Get a specific route with all data"""
    logger.debug(f"Retrieving route {route_id}")
    
    try:
        # Validate route_id format (basic UUID validation)
        if not route_id or len(route_id) != 36:
            raise ValidationException("Invalid route ID format")
        
        route_data = db.get_route_by_id(route_id)
        
        logger.info(f"Successfully retrieved route {route_id}")
        return route_data
    
    except ValidationException:
        raise
    except RouteNotFoundException:
        raise
    except DatabaseException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error retrieving route {route_id}: {e}")
        raise GPXAnalyzerException(f"Failed to retrieve route: {str(e)}")

@app.put("/api/waypoints/{waypoint_id}/notes")
async def update_waypoint_notes(waypoint_id: str, notes_update: WaypointNotesUpdate):
    """Update waypoint notes"""
    logger.debug(f"Updating notes for waypoint {waypoint_id}")
    
    try:
        # Validate waypoint_id format
        if not waypoint_id or len(waypoint_id) != 36:
            raise ValidationException("Invalid waypoint ID format")
        
        # Validate notes length
        if len(notes_update.notes) > 1000:
            raise ValidationException("Notes cannot exceed 1000 characters")
        
        success = db.update_waypoint_notes(waypoint_id, notes_update.notes)
        
        logger.info(f"Successfully updated notes for waypoint {waypoint_id}")
        return {"message": "Notes updated successfully"}
    
    except ValidationException:
        raise
    except WaypointNotFoundException:
        raise
    except DatabaseException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error updating waypoint {waypoint_id} notes: {e}")
        raise GPXAnalyzerException(f"Failed to update waypoint notes: {str(e)}")

@app.delete("/api/routes/{route_id}")
async def delete_route(route_id: str):
    """Delete a route and all associated data"""
    logger.info(f"Deleting route {route_id}")
    
    try:
        # Validate route_id format
        if not route_id or len(route_id) != 36:
            raise ValidationException("Invalid route ID format")
        
        success = db.delete_route(route_id)
        
        logger.info(f"Successfully deleted route {route_id}")
        return {"message": "Route deleted successfully"}
    
    except ValidationException:
        raise
    except RouteNotFoundException:
        raise
    except DatabaseException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error deleting route {route_id}: {e}")
        raise GPXAnalyzerException(f"Failed to delete route: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        routes = db.get_all_routes()
        
        return {
            "status": "healthy", 
            "message": "GPX Route Analyzer API is running",
            "database": "connected",
            "routes_count": len(routes)
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "message": "Service is experiencing issues",
                "database": "disconnected"
            }
        )

# Mount static files after API routes
public_dir = Path("public")
if public_dir.exists():
    app.mount("/", StaticFiles(directory=str(public_dir), html=True), name="static")
    logger.info(f"Static files mounted from {public_dir}")
else:
    logger.warning(f"Public directory {public_dir} not found - static files not available")

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting development server")
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=3000,
        log_level="info"
    ) 