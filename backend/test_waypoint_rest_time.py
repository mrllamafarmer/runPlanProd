#!/usr/bin/env python3
"""
Test script for waypoint rest time functionality.
This script tests the new rest_time_seconds field in waypoints.
"""

import requests
import json
import sys
import os

# Configuration
BASE_URL = "http://localhost:8000/api"
TEST_USER = {
    "username": "test_waypoint_user",
    "email": "test_waypoint@example.com", 
    "password": "testpassword123"
}

def test_waypoint_rest_time():
    """Test the complete waypoint rest time functionality."""
    
    print("🧪 Testing Waypoint Rest Time Functionality")
    print("=" * 50)
    
    # Step 1: Register test user
    print("1. Registering test user...")
    try:
        response = requests.post(f"{BASE_URL}/auth/register", json=TEST_USER)
        if response.status_code == 201:
            auth_data = response.json()
            token = auth_data["access_token"]
            print(f"✅ User registered successfully")
        else:
            # Try to login if user already exists
            response = requests.post(f"{BASE_URL}/auth/login", json={
                "username_or_email": TEST_USER["username"],
                "password": TEST_USER["password"]
            })
            if response.status_code == 200:
                auth_data = response.json()
                token = auth_data["access_token"]
                print(f"✅ User logged in successfully")
            else:
                print(f"❌ Failed to register/login user: {response.text}")
                return False
    except Exception as e:
        print(f"❌ Error during authentication: {e}")
        return False
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Step 2: Create a test route
    print("2. Creating test route...")
    route_data = {
        "name": "Test Route for Rest Time",
        "description": "Testing waypoint rest time functionality",
        "is_public": False
    }
    
    try:
        response = requests.post(f"{BASE_URL}/routes", json=route_data, headers=headers)
        if response.status_code == 201:
            route_id = response.json()["route_id"]
            print(f"✅ Route created with ID: {route_id}")
        else:
            print(f"❌ Failed to create route: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error creating route: {e}")
        return False
    
    # Step 3: Create waypoints with different rest times
    print("3. Creating waypoints with rest times...")
    waypoints_to_create = [
        {
            "name": "Start Point",
            "description": "Race start with no rest",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "order_index": 0,
            "waypoint_type": "start",
            "rest_time_seconds": 0
        },
        {
            "name": "Aid Station 1",
            "description": "First aid station with 5 minute rest",
            "latitude": 40.7589,
            "longitude": -73.9851,
            "order_index": 1,
            "waypoint_type": "checkpoint",
            "rest_time_seconds": 300  # 5 minutes
        },
        {
            "name": "Overnight Stop",
            "description": "Overnight rest for multiday race",
            "latitude": 40.7831,
            "longitude": -73.9712,
            "order_index": 2,
            "waypoint_type": "checkpoint",
            "rest_time_seconds": 28800  # 8 hours (480 minutes)
        },
        {
            "name": "Finish Line",
            "description": "Race finish",
            "latitude": 40.7505,
            "longitude": -73.9934,
            "order_index": 3,
            "waypoint_type": "finish",
            "rest_time_seconds": 0
        }
    ]
    
    created_waypoints = []
    for waypoint_data in waypoints_to_create:
        try:
            response = requests.post(f"{BASE_URL}/routes/{route_id}/waypoints", 
                                   json=waypoint_data, headers=headers)
            if response.status_code == 201:
                waypoint_id = response.json()["waypoint_id"]
                created_waypoints.append(waypoint_id)
                rest_minutes = waypoint_data["rest_time_seconds"] // 60
                print(f"✅ Created waypoint '{waypoint_data['name']}' with {rest_minutes} minutes rest")
            else:
                print(f"❌ Failed to create waypoint '{waypoint_data['name']}': {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error creating waypoint '{waypoint_data['name']}': {e}")
            return False
    
    # Step 4: Retrieve and verify waypoints
    print("4. Retrieving and verifying waypoints...")
    try:
        response = requests.get(f"{BASE_URL}/routes/{route_id}/waypoints", headers=headers)
        if response.status_code == 200:
            waypoints = response.json()
            print(f"✅ Retrieved {len(waypoints)} waypoints")
            
            # Verify rest times
            for waypoint in waypoints:
                rest_seconds = waypoint.get("rest_time_seconds", 0)
                rest_minutes = rest_seconds // 60
                rest_hours = rest_minutes // 60
                rest_display_minutes = rest_minutes % 60
                
                if rest_hours > 0:
                    rest_display = f"{rest_hours}h {rest_display_minutes}m"
                elif rest_minutes > 0:
                    rest_display = f"{rest_minutes}m"
                else:
                    rest_display = "No rest"
                
                print(f"   - {waypoint['name']}: {rest_display}")
        else:
            print(f"❌ Failed to retrieve waypoints: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error retrieving waypoints: {e}")
        return False
    
    # Step 5: Update a waypoint's rest time
    print("5. Updating waypoint rest time...")
    if created_waypoints:
        waypoint_id = created_waypoints[1]  # Aid Station 1
        update_data = {
            "name": "Aid Station 1 - Extended",
            "description": "Extended rest time for testing",
            "rest_time_seconds": 900  # 15 minutes
        }
        
        try:
            response = requests.put(f"{BASE_URL}/waypoints/{waypoint_id}", 
                                  json=update_data, headers=headers)
            if response.status_code == 200:
                print(f"✅ Updated waypoint rest time to 15 minutes")
            else:
                print(f"❌ Failed to update waypoint: {response.text}")
                return False
        except Exception as e:
            print(f"❌ Error updating waypoint: {e}")
            return False
    
    # Step 6: Test time formatting utilities (simulate frontend)
    print("6. Testing time formatting...")
    
    def seconds_to_mmss(seconds):
        """Convert seconds to MM:SS format"""
        if not seconds or seconds < 0:
            return '00:00'
        minutes = seconds // 60
        remaining_seconds = seconds % 60
        return f"{minutes:02d}:{remaining_seconds:02d}"
    
    def mmss_to_seconds(time_string):
        """Convert MM:SS format to seconds"""
        if not time_string:
            return 0
        parts = time_string.split(':')
        if len(parts) != 2:
            return 0
        try:
            minutes = int(parts[0])
            seconds = int(parts[1])
            return minutes * 60 + seconds
        except ValueError:
            return 0
    
    # Test various time formats
    test_times = [0, 300, 900, 3600, 28800]  # 0s, 5m, 15m, 1h, 8h
    for seconds in test_times:
        mmss = seconds_to_mmss(seconds)
        back_to_seconds = mmss_to_seconds(mmss)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        
        if hours > 0:
            display = f"{hours}h {minutes}m"
        elif minutes > 0:
            display = f"{minutes}m"
        else:
            display = "No rest"
            
        print(f"   - {seconds}s → {mmss} → {back_to_seconds}s ({display})")
        
        if back_to_seconds != seconds:
            print(f"❌ Time conversion error for {seconds} seconds")
            return False
    
    print("✅ Time formatting tests passed")
    
    # Step 7: Cleanup
    print("7. Cleaning up...")
    try:
        response = requests.delete(f"{BASE_URL}/routes/{route_id}", headers=headers)
        if response.status_code == 200:
            print("✅ Test route deleted")
        else:
            print(f"⚠️  Could not delete test route: {response.text}")
    except Exception as e:
        print(f"⚠️  Error during cleanup: {e}")
    
    print("\n🎉 All waypoint rest time tests passed!")
    return True

if __name__ == "__main__":
    success = test_waypoint_rest_time()
    sys.exit(0 if success else 1) 