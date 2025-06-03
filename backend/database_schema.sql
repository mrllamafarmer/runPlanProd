-- Multi-user Route Planning Database Schema
-- Optimized for storage efficiency while maintaining functionality
-- PostgreSQL Version

-- Users table for authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Routes table - user's main route plans
CREATE TABLE routes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    total_distance_meters REAL DEFAULT 0,
    total_elevation_gain_meters REAL DEFAULT 0,
    estimated_time_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Waypoints - user-defined points of interest
CREATE TABLE waypoints (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation_meters REAL,
    order_index INTEGER NOT NULL,
    waypoint_type VARCHAR(20) DEFAULT 'checkpoint', -- start, checkpoint, finish, poi
    target_pace_per_km_seconds INTEGER, -- user's target pace for this segment
    rest_time_seconds INTEGER DEFAULT 0, -- rest time in seconds (supports multiday races)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

-- Route segments - calculated data between waypoints
CREATE TABLE route_segments (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL,
    from_waypoint_id INTEGER NOT NULL,
    to_waypoint_id INTEGER NOT NULL,
    distance_meters REAL NOT NULL,
    elevation_gain_meters REAL NOT NULL,
    elevation_loss_meters REAL NOT NULL,
    estimated_time_seconds INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
    FOREIGN KEY (from_waypoint_id) REFERENCES waypoints(id) ON DELETE CASCADE,
    FOREIGN KEY (to_waypoint_id) REFERENCES waypoints(id) ON DELETE CASCADE
);

-- Simplified track points for route visualization
-- Using Douglas-Peucker algorithm to reduce point count while preserving shape
CREATE TABLE track_points (
    id SERIAL PRIMARY KEY,
    route_segment_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    elevation_meters REAL,
    distance_from_segment_start_meters REAL NOT NULL,
    point_index INTEGER NOT NULL, -- order within segment
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_segment_id) REFERENCES route_segments(id) ON DELETE CASCADE
);

-- Original GPX metadata (optional, for backup/export)
CREATE TABLE gpx_files (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL,
    original_filename VARCHAR(255),
    file_hash VARCHAR(64), -- SHA-256 hash to detect duplicates
    original_point_count INTEGER,
    simplified_point_count INTEGER,
    compression_ratio REAL, -- percentage reduction
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_routes_user_id ON routes(user_id);
CREATE INDEX idx_waypoints_route_id ON waypoints(route_id);
CREATE INDEX idx_waypoints_order ON waypoints(route_id, order_index);
CREATE INDEX idx_route_segments_route_id ON route_segments(route_id);
CREATE INDEX idx_track_points_segment_id ON track_points(route_segment_id);
CREATE INDEX idx_track_points_order ON track_points(route_segment_id, point_index);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Update trigger for routes.updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at 
    BEFORE UPDATE ON routes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 