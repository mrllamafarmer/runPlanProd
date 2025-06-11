import pytest
import tempfile
import os
from pathlib import Path
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch

# Import application components
from main import app
import database
from logging_config import setup_logging

@pytest.fixture(scope="session")
def test_logger():
    """Setup test logging"""
    return setup_logging()

@pytest.fixture
def test_db():
    """Create a test database setup - using PostgreSQL functions"""
    # For PostgreSQL-based testing, we'll use the existing database functions
    # The test database should be set up via environment variables
    yield database

@pytest.fixture
def test_user():
    """Create a test user for testing"""
    from auth import AuthManager
    from models import UserCreate
    
    auth_manager = AuthManager()
    
    # Create a test user
    test_username = "testuser"
    test_email = "test@example.com"
    test_password = "testpassword123"
    
    try:
        # Try to create the user (will fail if already exists)
        user_data = UserCreate(
            username=test_username,
            email=test_email,
            password=test_password
        )
        result = auth_manager.register_user(user_data)
        user_id = result['user_id']
    except Exception:
        # User might already exist, create one directly in the database
        with database.get_db_cursor() as cursor:
            cursor.execute("""
                INSERT INTO users (username, email, password_hash, created_at)
                VALUES (%s, %s, %s, NOW())
                ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
                RETURNING id
            """, (test_username, test_email, auth_manager.hash_password(test_password)))
            result = cursor.fetchone()
            user_id = result['id'] if result else 1
    
    return user_id

@pytest.fixture
def client():
    """Create a test client"""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def sample_route_data():
    """Sample route data for testing"""
    return {
        "filename": "test_route.gpx",
        "totalDistance": 10.5,
        "totalElevationGain": 500.0,
        "totalElevationLoss": 450.0,
        "startTime": "2023-01-01T10:00:00Z",
        "targetTimeSeconds": 3600,
        "slowdownFactorPercent": 5.0,
        "hasValidTime": True,
        "usingTargetTime": True,
        "gpxData": "<gpx>test data</gpx>",
        "waypoints": [
            {
                "legNumber": 1,
                "legName": "Start to Mile 1",
                "distanceMiles": 1.0,
                "cumulativeDistance": 1.0,
                "durationSeconds": 360.0,
                "legPaceSeconds": 360.0,
                "elevationGain": 50.0,
                "elevationLoss": 10.0,
                "cumulativeElevationGain": 50.0,
                "cumulativeElevationLoss": 10.0,
                "restTimeSeconds": 0,
                "notes": "First mile",
                "latitude": 40.0,
                "longitude": -74.0,
                "elevation": 100.0
            }
        ],
        "trackPoints": [
            {
                "lat": 40.0,
                "lon": -74.0,
                "elevation": 100.0,
                "time": "2023-01-01T10:00:00Z",
                "distance": 0.0,
                "cumulativeDistance": 0.0
            },
            {
                "lat": 40.001,
                "lon": -74.001,
                "elevation": 105.0,
                "time": "2023-01-01T10:01:00Z",
                "distance": 0.1,
                "cumulativeDistance": 0.1
            }
        ]
    }

@pytest.fixture
def sample_waypoint_data():
    """Sample waypoint data for testing"""
    return {
        "legNumber": 1,
        "legName": "Test Waypoint",
        "distanceMiles": 1.0,
        "cumulativeDistance": 1.0,
        "durationSeconds": 360.0,
        "legPaceSeconds": 360.0,
        "elevationGain": 50.0,
        "elevationLoss": 10.0,
        "cumulativeElevationGain": 50.0,
        "cumulativeElevationLoss": 10.0,
        "restTimeSeconds": 0,
        "notes": "Test notes",
        "latitude": 40.0,
        "longitude": -74.0,
        "elevation": 100.0
    }

@pytest.fixture
def minimal_route_data():
    """Minimal valid route data for testing"""
    return {
        "filename": "minimal.gpx",
        "totalDistance": 5.0,
        "totalElevationGain": 100.0,
        "totalElevationLoss": 80.0
    } 