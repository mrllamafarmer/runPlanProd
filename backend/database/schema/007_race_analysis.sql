-- Race Analysis Tables
-- Stores actual race performance data and comparisons against planned routes

-- Table to store race analysis sessions
CREATE TABLE IF NOT EXISTS race_analyses (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    race_name VARCHAR(255) NOT NULL,
    race_date DATE,
    actual_gpx_filename VARCHAR(255) NOT NULL,
    total_race_time_seconds INTEGER NOT NULL,
    total_actual_distance_meters DECIMAL(10,2) NOT NULL,
    race_start_time TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store sampled actual race track points
CREATE TABLE IF NOT EXISTS race_track_points (
    id SERIAL PRIMARY KEY,
    race_analysis_id INTEGER NOT NULL REFERENCES race_analyses(id) ON DELETE CASCADE,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    elevation_meters DECIMAL(8,2),
    race_time_seconds INTEGER NOT NULL, -- seconds from race start
    cumulative_distance_meters DECIMAL(10,2) NOT NULL,
    point_order INTEGER NOT NULL, -- order in the sampled sequence
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to store waypoint comparison results
CREATE TABLE IF NOT EXISTS race_waypoint_comparisons (
    id SERIAL PRIMARY KEY,
    race_analysis_id INTEGER NOT NULL REFERENCES race_analyses(id) ON DELETE CASCADE,
    waypoint_id INTEGER NOT NULL REFERENCES waypoints(id) ON DELETE CASCADE,
    planned_cumulative_time_seconds INTEGER NOT NULL,
    actual_cumulative_time_seconds INTEGER,
    time_difference_seconds INTEGER, -- actual - planned (negative = ahead)
    leg_duration_seconds INTEGER, -- actual time for this leg
    leg_distance_miles DECIMAL(8,4),
    actual_pace_seconds_per_mile INTEGER, -- actual pace for this leg
    planned_pace_seconds_per_mile INTEGER, -- planned pace for this leg
    closest_track_point_id INTEGER REFERENCES race_track_points(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_race_analyses_route_user ON race_analyses(route_id, user_id);
CREATE INDEX IF NOT EXISTS idx_race_analyses_race_date ON race_analyses(race_date);
CREATE INDEX IF NOT EXISTS idx_race_track_points_analysis ON race_track_points(race_analysis_id, point_order);
CREATE INDEX IF NOT EXISTS idx_race_waypoint_comparisons_analysis ON race_waypoint_comparisons(race_analysis_id);

-- Update trigger for race_analyses
CREATE OR REPLACE FUNCTION update_race_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER race_analyses_updated_at_trigger
    BEFORE UPDATE ON race_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_race_analyses_updated_at(); 