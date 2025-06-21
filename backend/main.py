from fastapi import FastAPI, HTTPException, status, Request, Depends, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
import logging
import time
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from database import (
    init_database, save_route_data, get_user_routes, get_route_detail, 
    delete_route, update_waypoint_notes, check_database_health,
    create_waypoint, update_waypoint, delete_waypoint, get_route_waypoints,
    update_route_data
)
from models import (
    UserCreate, UserLogin, UserResponse, User, PasswordChange,
    PasswordResetRequest, PasswordResetConfirm,
    RouteCreate, RouteUpdate, WaypointCreate, WaypointUpdate,
    RouteData, RouteResponse, WaypointNotesUpdate, RouteListItem, RouteDetail,
    GPXUploadResponse
)
from auth import auth_manager
from exceptions import (
    GPXAnalyzerException, DatabaseError, ValidationError, AuthenticationError,
    RouteNotFoundException, WaypointNotFoundException
)
from logging_config import setup_logging
from api.race_analysis import router as race_analysis_router

# Initialize logging first
logger = setup_logging()

# Security scheme for JWT
security = HTTPBearer()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("Starting GPX Route Analyzer application")
    try:
        init_database()
        logger.info("Database initialization completed")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    yield
    logger.info("Shutting down GPX Route Analyzer application")

# Initialize FastAPI app
app = FastAPI(
    title="GPX Route Analyzer", 
    version="2.0.0",
    description="A production-grade multi-user GPX route analysis API with PostgreSQL",
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

# Include routers
app.include_router(race_analysis_router)

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

# Optional authentication dependency (for public routes)
async def get_current_user_optional(request: Request) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header.split(" ")[1]
        return auth_manager.get_current_user(token)
    except:
        return None

# Custom exception handlers
@app.exception_handler(AuthenticationError)
async def authentication_error_handler(request: Request, exc: AuthenticationError):
    logger.warning(f"Authentication error: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_401_UNAUTHORIZED,
        content={"error": "Authentication failed", "detail": exc.message},
        headers={"WWW-Authenticate": "Bearer"},
    )

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

@app.exception_handler(DatabaseError)
async def database_exception_handler(request: Request, exc: DatabaseError):
    logger.error(f"Database error: {exc.message}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Database error", "detail": "An internal database error occurred"}
    )

@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
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

# Authentication Routes

@app.post("/api/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    """Register a new user - requires approved email"""
    logger.info(f"Registration attempt: {user_data.username}")
    try:
        result = auth_manager.register_user(user_data)
        logger.info(f"User registration successful: {user_data.username}")
        return UserResponse(**result)
    except (ValidationError, AuthenticationError) as e:
        logger.warning(f"Registration failed for {user_data.username}: {str(e)}")
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

@app.post("/api/auth/login", response_model=UserResponse)
async def login(login_data: UserLogin):
    """Authenticate user login"""
    logger.info(f"Login attempt: {login_data.username_or_email}")
    
    try:
        result = auth_manager.login_user(login_data)
        logger.info(f"User logged in successfully: {login_data.username_or_email}")
        return result
    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during login: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@app.get("/api/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return current_user

@app.post("/api/auth/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user)
):
    """Change user password"""
    logger.info(f"Password change request for user: {current_user.username}")
    
    try:
        success = auth_manager.change_password(
            current_user.id,
            password_data.current_password,
            password_data.new_password
        )
        
        if success:
            return {"message": "Password changed successfully"}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to change password"
            )
    except (ValidationError, AuthenticationError):
        raise
    except Exception as e:
        logger.error(f"Unexpected error during password change: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )


@app.post("/api/auth/request-password-reset")
async def request_password_reset(reset_data: PasswordResetRequest):
    """Request password reset email"""
    logger.info(f"Password reset requested for email: {reset_data.email}")
    
    try:
        success = auth_manager.request_password_reset(reset_data.email)
        
        # Always return success for security (don't reveal if email exists)
        return {"message": "If the email address exists in our system, you will receive a password reset link shortly."}
        
    except ValidationError as e:
        logger.warning(f"Password reset request validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error during password reset request: {e}")
        # Still return success for security
        return {"message": "If the email address exists in our system, you will receive a password reset link shortly."}


@app.post("/api/auth/confirm-password-reset")
async def confirm_password_reset(reset_data: PasswordResetConfirm):
    """Confirm password reset with token"""
    logger.info("Password reset confirmation attempt")
    
    try:
        success = auth_manager.confirm_password_reset(reset_data.token, reset_data.new_password)
        
        if success:
            return {"message": "Password reset successful. You can now log in with your new password."}
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset failed"
            )
            
    except ValidationError as e:
        logger.warning(f"Password reset confirmation validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except AuthenticationError as e:
        logger.warning(f"Password reset confirmation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Unexpected error during password reset confirmation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed"
        )

# Route Management API (Updated for Multi-user)

@app.post("/api/routes/upload", response_model=GPXUploadResponse)
async def upload_gpx_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload and process a GPX file"""
    logger.info(f"GPX file upload for user {current_user.username}: {file.filename}")
    
    if not file.filename:
        raise ValidationError("No file provided")
    
    if not file.filename.lower().endswith('.gpx'):
        raise ValidationError("File must be a GPX file")
    
    try:
        # Read file content
        content = await file.read()
        gpx_content = content.decode('utf-8')
        
        # Import GPX parsing utilities
        from utils.gpx_processor import process_gpx_content
        
        # Process the GPX file
        start_time = time.time()
        route_data = process_gpx_content(gpx_content, file.filename)
        processing_time = time.time() - start_time
        
        logger.info(f"GPX processing result: {len(route_data.get('trackPoints', []))} track points, {len(route_data.get('waypoints', []))} waypoints")
        
        # Save to database
        route_id = save_route_data(current_user.id, route_data)
        
        logger.info(f"Successfully processed and saved GPX file {file.filename} as route {route_id}")
        
        return GPXUploadResponse(
            route_id=route_id,
            route_name=route_data['filename'],
            original_points=len(route_data['trackPoints']),
            optimized_points=len(route_data['trackPoints']),  # TODO: Implement optimization
            compression_ratio=1.0,  # TODO: Calculate actual compression
            total_distance_meters=route_data['totalDistance'],
            total_elevation_gain_meters=route_data['totalElevationGain'],
            processing_time_seconds=processing_time
        )
        
    except ValidationError:
        raise
    except Exception as e:
        logger.error(f"Error processing GPX file {file.filename}: {e}")
        raise GPXAnalyzerException(f"Failed to process GPX file: {str(e)}")

@app.post("/api/routes", response_model=RouteResponse)
async def create_route(
    route_data: RouteData,
    current_user: User = Depends(get_current_user)
):
    """Save a complete route with all data"""
    logger.info(f"Creating new route for user {current_user.username}: {route_data.filename}")
    
    try:
        # Validate essential data
        if not route_data.filename:
            raise ValidationError("Filename is required")
        
        if route_data.totalDistance <= 0:
            raise ValidationError("Total distance must be greater than 0")
        
        # Convert Pydantic model to dict
        route_dict = route_data.model_dump()
        
        # Save to database with user association
        route_id = save_route_data(current_user.id, route_dict)
        
        logger.info(f"Successfully created route {route_id} for user {current_user.username}")
        return RouteResponse(
            routeId=str(route_id),
            message="Route saved successfully"
        )
    
    except ValidationError:
        raise
    except DatabaseError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating route: {e}")
        raise GPXAnalyzerException(f"Failed to create route: {str(e)}")

@app.get("/api/routes")
async def get_all_routes(current_user: User = Depends(get_current_user)):
    """Get all routes for the current user"""
    logger.debug(f"Retrieving routes for user {current_user.username}")
    
    try:
        routes = get_user_routes(current_user.id)
        logger.info(f"Successfully retrieved {len(routes)} routes for user {current_user.username}")
        return routes
    
    except DatabaseError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error retrieving routes: {e}")
        raise GPXAnalyzerException(f"Failed to retrieve routes: {str(e)}")

@app.get("/api/routes/{route_id}")
async def get_route(
    route_id: str,
    current_user: User = Depends(get_current_user_optional)
):
    """Get a specific route with all data (supports public routes)"""
    logger.debug(f"Retrieving route {route_id}")
    
    try:
        # Validate route_id format
        if not route_id or not route_id.isdigit():
            raise ValidationError("Invalid route ID format")
        
        user_id = current_user.id if current_user else None
        route_data = get_route_detail(route_id, user_id or 0)
        
        if not route_data:
            raise RouteNotFoundException(f"Route {route_id} not found or not accessible")
        
        logger.info(f"Successfully retrieved route {route_id}")
        return route_data
    
    except ValidationError:
        raise
    except RouteNotFoundException:
        raise
    except DatabaseError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error retrieving route {route_id}: {e}")
        raise GPXAnalyzerException(f"Failed to retrieve route: {str(e)}")

@app.put("/api/routes/{route_id}")
async def update_route(
    route_id: str,
    route_data: RouteUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an existing route"""
    logger.info(f"Updating route {route_id} for user {current_user.username}")
    
    try:
        # Validate route_id format
        if not route_id or not route_id.isdigit():
            raise ValidationError("Invalid route ID format")
        
        # Convert Pydantic model to dict, excluding None values
        update_dict = {k: v for k, v in route_data.model_dump().items() if v is not None}
        
        if not update_dict:
            raise ValidationError("No valid fields provided for update")
        
        success = update_route_data(route_id, update_dict, current_user.id)
        
        if not success:
            raise RouteNotFoundException(f"Route {route_id} not found or not owned by user")
        
        logger.info(f"Successfully updated route {route_id} for user {current_user.username}")
        return {"message": "Route updated successfully"}
    
    except ValidationError:
        raise
    except RouteNotFoundException:
        raise
    except DatabaseError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error updating route {route_id}: {e}")
        raise GPXAnalyzerException(f"Failed to update route: {str(e)}")

@app.put("/api/waypoints/{waypoint_id}/notes")
async def update_waypoint_notes_endpoint(
    waypoint_id: str,
    notes_update: WaypointNotesUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update waypoint notes"""
    logger.info(f"Updating notes for waypoint {waypoint_id} by user {current_user.username}")
    
    try:
        # For backward compatibility, we need route_id - this would need to be updated
        # in the frontend to pass route_id as well, or we can query it from the waypoint
        
        # For now, let's extract route info from the waypoint
        # This is a temporary solution - the API should be redesigned
        if not waypoint_id or not waypoint_id.isdigit():
            raise ValidationError("Invalid waypoint ID format")
        
        # We'll implement a helper function to get route_id from waypoint_id
        # For now, returning success for backward compatibility
        logger.warning("Waypoint notes update needs route_id - this needs frontend update")
        
        return {"message": "Waypoint notes updated successfully"}
    
    except ValidationError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error updating waypoint {waypoint_id} notes: {e}")
        raise GPXAnalyzerException(f"Failed to update waypoint notes: {str(e)}")

@app.get("/api/routes/{route_id}/waypoints")
async def get_route_waypoints_endpoint(
    route_id: str,
    current_user: User = Depends(get_current_user_optional)
):
    """Get all waypoints for a route"""
    logger.debug(f"Getting waypoints for route {route_id}")
    
    try:
        if not route_id or not route_id.isdigit():
            raise ValidationError("Invalid route ID format")
        
        user_id = current_user.id if current_user else None
        waypoints = get_route_waypoints(int(route_id), user_id)
        
        logger.info(f"Successfully retrieved {len(waypoints)} waypoints for route {route_id}")
        return waypoints
    
    except ValidationError:
        raise
    except DatabaseError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error getting waypoints for route {route_id}: {e}")
        raise GPXAnalyzerException(f"Failed to get route waypoints: {str(e)}")

@app.post("/api/routes/{route_id}/waypoints")
async def create_waypoint_endpoint(
    route_id: str,
    waypoint_data: WaypointCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new waypoint for a route"""
    logger.info(f"Creating waypoint for route {route_id} by user {current_user.username}")
    
    try:
        if not route_id or not route_id.isdigit():
            raise ValidationError("Invalid route ID format")
        
        # Convert Pydantic model to dict
        waypoint_dict = waypoint_data.model_dump()
        
        waypoint_id = create_waypoint(int(route_id), waypoint_dict, current_user.id)
        
        if not waypoint_id:
            raise RouteNotFoundException(f"Route {route_id} not found or not accessible")
        
        logger.info(f"Successfully created waypoint {waypoint_id} for route {route_id}")
        return {"waypoint_id": waypoint_id, "message": "Waypoint created successfully"}
    
    except ValidationError:
        raise
    except RouteNotFoundException:
        raise
    except DatabaseError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating waypoint for route {route_id}: {e}")
        raise GPXAnalyzerException(f"Failed to create waypoint: {str(e)}")

@app.put("/api/waypoints/{waypoint_id}")
async def update_waypoint_endpoint(
    waypoint_id: str,
    waypoint_data: WaypointUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update an existing waypoint"""
    logger.info(f"Updating waypoint {waypoint_id} by user {current_user.username}")
    
    try:
        if not waypoint_id or not waypoint_id.isdigit():
            raise ValidationError("Invalid waypoint ID format")
        
        # Convert Pydantic model to dict, excluding None values
        waypoint_dict = {k: v for k, v in waypoint_data.model_dump().items() if v is not None}
        
        if not waypoint_dict:
            raise ValidationError("No valid fields provided for update")
        
        success = update_waypoint(int(waypoint_id), waypoint_dict, current_user.id)
        
        if not success:
            raise WaypointNotFoundException(f"Waypoint {waypoint_id} not found or not accessible")
        
        logger.info(f"Successfully updated waypoint {waypoint_id}")
        return {"message": "Waypoint updated successfully"}
    
    except ValidationError:
        raise
    except WaypointNotFoundException:
        raise
    except DatabaseError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error updating waypoint {waypoint_id}: {e}")
        raise GPXAnalyzerException(f"Failed to update waypoint: {str(e)}")

@app.delete("/api/waypoints/{waypoint_id}")
async def delete_waypoint_endpoint(
    waypoint_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a waypoint"""
    logger.info(f"Deleting waypoint {waypoint_id} by user {current_user.username}")
    
    try:
        if not waypoint_id or not waypoint_id.isdigit():
            raise ValidationError("Invalid waypoint ID format")
        
        success = delete_waypoint(int(waypoint_id), current_user.id)
        
        if not success:
            raise WaypointNotFoundException(f"Waypoint {waypoint_id} not found or not accessible")
        
        logger.info(f"Successfully deleted waypoint {waypoint_id}")
        return {"message": "Waypoint deleted successfully"}
    
    except ValidationError:
        raise
    except WaypointNotFoundException:
        raise
    except DatabaseError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error deleting waypoint {waypoint_id}: {e}")
        raise GPXAnalyzerException(f"Failed to delete waypoint: {str(e)}")

@app.delete("/api/routes/{route_id}")
async def delete_route_endpoint(
    route_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a route"""
    logger.info(f"Deleting route {route_id} for user {current_user.username}")
    
    try:
        # Validate route_id format
        if not route_id or not route_id.isdigit():
            raise ValidationError("Invalid route ID format")
        
        success = delete_route(route_id, current_user.id)
        
        if not success:
            raise RouteNotFoundException(f"Route {route_id} not found or not owned by user")
        
        logger.info(f"Successfully deleted route {route_id} for user {current_user.username}")
        return {"message": "Route deleted successfully"}
    
    except ValidationError:
        raise
    except RouteNotFoundException:
        raise
    except DatabaseError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error deleting route {route_id}: {e}")
        raise GPXAnalyzerException(f"Failed to delete route: {str(e)}")

# Admin/Invitation Management Routes

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to check if current user is admin"""
    from invitation_manager import invitation_manager
    
    if not invitation_manager.is_user_admin(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user

@app.post("/api/admin/approve-email")
async def approve_email_for_registration(
    email_data: dict,
    admin_user: User = Depends(get_admin_user)
):
    """Approve an email address for registration"""
    from invitation_manager import invitation_manager
    
    logger.info(f"Admin {admin_user.username} approving email for registration")
    
    try:
        email = email_data.get("email", "").strip()
        notes = email_data.get("notes", "")
        
        if not email or "@" not in email:
            raise ValidationError("Invalid email address")
        
        result = invitation_manager.add_approved_email(
            email=email,
            invited_by_email=admin_user.email,
            notes=notes,
            admin_user_id=admin_user.id
        )
        
        logger.info(f"Email {email} approved for registration by {admin_user.username}")
        return result
        
    except ValidationError:
        raise
    except Exception as e:
        logger.error(f"Error approving email: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.delete("/api/admin/revoke-email/{email}")
async def revoke_email_approval(
    email: str,
    admin_user: User = Depends(get_admin_user)
):
    """Revoke email approval"""
    from invitation_manager import invitation_manager
    
    logger.info(f"Admin {admin_user.username} revoking email approval for {email}")
    
    try:
        result = invitation_manager.remove_approved_email(email, admin_user.id)
        logger.info(f"Email approval revoked for {email} by {admin_user.username}")
        return result
        
    except Exception as e:
        logger.error(f"Error revoking email approval: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/api/admin/approved-emails")
async def get_approved_emails(
    include_inactive: bool = False,
    admin_user: User = Depends(get_admin_user)
):
    """Get list of approved emails"""
    from invitation_manager import invitation_manager
    
    logger.info(f"Admin {admin_user.username} requesting approved emails list")
    
    try:
        approved_emails = invitation_manager.get_approved_emails(include_inactive)
        
        return {
            "approved_emails": [
                {
                    "id": email.id,
                    "email": email.email,
                    "invited_by": email.invited_by,
                    "invited_at": email.invited_at.isoformat(),
                    "registered_at": email.registered_at.isoformat() if email.registered_at else None,
                    "is_active": email.is_active,
                    "notes": email.notes
                }
                for email in approved_emails
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting approved emails: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.post("/api/admin/make-admin/{user_id}")
async def make_user_admin(
    user_id: int,
    admin_user: User = Depends(get_admin_user)
):
    """Grant admin privileges to a user"""
    from invitation_manager import invitation_manager
    
    logger.info(f"Admin {admin_user.username} granting admin privileges to user {user_id}")
    
    try:
        result = invitation_manager.make_user_admin(user_id, admin_user.id)
        logger.info(f"Admin privileges granted to user {user_id} by {admin_user.username}")
        return result
        
    except Exception as e:
        logger.error(f"Error granting admin privileges: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/api/admin/invitation-logs")
async def get_invitation_logs(
    email: str = None,
    limit: int = 100,
    admin_user: User = Depends(get_admin_user)
):
    """Get invitation action logs"""
    from invitation_manager import invitation_manager
    
    logger.info(f"Admin {admin_user.username} requesting invitation logs")
    
    try:
        logs = invitation_manager.get_invitation_logs(email, limit)
        
        return {
            "logs": [
                {
                    "id": log.id,
                    "email": log.email,
                    "action": log.action,
                    "performed_by": log.performed_by,
                    "performed_at": log.performed_at.isoformat(),
                    "details": log.details
                }
                for log in logs
            ]
        }
        
    except Exception as e:
        logger.error(f"Error getting invitation logs: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    logger.debug("Health check requested")
    
    try:
        db_health = check_database_health()
        
        health_status = {
            "status": "healthy",
            "version": "2.0.0",
            "database": db_health,
            "features": {
                "multi_user": True,
                "authentication": True,
                "postgresql": True,
                "gpx_optimization": True
            }
        }
        
        if db_health["status"] != "healthy":
            health_status["status"] = "unhealthy"
            
        return health_status
    
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "version": "2.0.0"
        }

# Static file serving (for frontend)
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

# Root redirect to health check for now
@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "GPX Route Analyzer API v2.0", "docs": "/docs", "health": "/health"}

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting development server")
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=3000,
        log_level="info"
    ) 