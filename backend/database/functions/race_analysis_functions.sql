-- Race Analysis Database Functions

-- Function to create a new race analysis
CREATE OR REPLACE FUNCTION create_race_analysis(
    p_route_id INTEGER,
    p_user_id INTEGER,
    p_race_name VARCHAR(255),
    p_race_date DATE,
    p_actual_gpx_filename VARCHAR(255),
    p_total_race_time_seconds INTEGER,
    p_total_actual_distance_meters DECIMAL(10,2),
    p_race_start_time TIMESTAMP DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_analysis_id INTEGER;
BEGIN
    INSERT INTO race_analyses (
        route_id, user_id, race_name, race_date, actual_gpx_filename,
        total_race_time_seconds, total_actual_distance_meters, race_start_time, notes
    ) VALUES (
        p_route_id, p_user_id, p_race_name, p_race_date, p_actual_gpx_filename,
        p_total_race_time_seconds, p_total_actual_distance_meters, p_race_start_time, p_notes
    ) RETURNING id INTO v_analysis_id;
    
    RETURN v_analysis_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add race track points
CREATE OR REPLACE FUNCTION add_race_track_points(
    p_race_analysis_id INTEGER,
    p_track_points JSONB
)
RETURNS INTEGER AS $$
DECLARE
    v_point JSONB;
    v_count INTEGER := 0;
BEGIN
    FOR v_point IN SELECT * FROM jsonb_array_elements(p_track_points)
    LOOP
        INSERT INTO race_track_points (
            race_analysis_id, latitude, longitude, elevation_meters,
            race_time_seconds, cumulative_distance_meters, point_order
        ) VALUES (
            p_race_analysis_id,
            (v_point->>'lat')::DECIMAL(10,8),
            (v_point->>'lon')::DECIMAL(11,8),
            CASE WHEN v_point->>'elevation' IS NOT NULL THEN (v_point->>'elevation')::DECIMAL(8,2) ELSE NULL END,
            (v_point->>'cumulativeTime')::INTEGER,
            (v_point->>'cumulativeDistance')::DECIMAL(10,2),
            (v_point->>'order')::INTEGER
        );
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to add waypoint comparisons
CREATE OR REPLACE FUNCTION add_waypoint_comparisons(
    p_race_analysis_id INTEGER,
    p_comparisons JSONB
)
RETURNS INTEGER AS $$
DECLARE
    v_comparison JSONB;
    v_count INTEGER := 0;
    v_track_point_id INTEGER;
BEGIN
    FOR v_comparison IN SELECT * FROM jsonb_array_elements(p_comparisons)
    LOOP
        -- Find the closest track point ID if coordinates are provided
        v_track_point_id := NULL;
        IF v_comparison->>'closestPointLat' IS NOT NULL AND v_comparison->>'closestPointLon' IS NOT NULL THEN
            SELECT id INTO v_track_point_id
            FROM race_track_points 
            WHERE race_analysis_id = p_race_analysis_id
            ORDER BY (
                POW(latitude - (v_comparison->>'closestPointLat')::DECIMAL(10,8), 2) +
                POW(longitude - (v_comparison->>'closestPointLon')::DECIMAL(11,8), 2)
            ) ASC
            LIMIT 1;
        END IF;
        
        INSERT INTO race_waypoint_comparisons (
            race_analysis_id, waypoint_id, planned_cumulative_time_seconds,
            actual_cumulative_time_seconds, time_difference_seconds, leg_duration_seconds,
            leg_distance_miles, actual_pace_seconds_per_mile, planned_pace_seconds_per_mile,
            closest_track_point_id
        ) VALUES (
            p_race_analysis_id,
            (v_comparison->>'waypointId')::INTEGER,
            (v_comparison->>'plannedCumulativeTime')::INTEGER,
            CASE WHEN v_comparison->>'actualCumulativeTime' IS NOT NULL THEN (v_comparison->>'actualCumulativeTime')::INTEGER ELSE NULL END,
            CASE WHEN v_comparison->>'timeDifference' IS NOT NULL THEN (v_comparison->>'timeDifference')::INTEGER ELSE NULL END,
            CASE WHEN v_comparison->>'legDuration' IS NOT NULL THEN (v_comparison->>'legDuration')::INTEGER ELSE NULL END,
            CASE WHEN v_comparison->>'legDistance' IS NOT NULL THEN (v_comparison->>'legDistance')::DECIMAL(8,4) ELSE NULL END,
            CASE WHEN v_comparison->>'actualPace' IS NOT NULL THEN (v_comparison->>'actualPace')::INTEGER ELSE NULL END,
            CASE WHEN v_comparison->>'plannedPace' IS NOT NULL THEN (v_comparison->>'plannedPace')::INTEGER ELSE NULL END,
            v_track_point_id
        );
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get race analyses for a user
CREATE OR REPLACE FUNCTION get_user_race_analyses(p_user_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    route_id INTEGER,
    route_name VARCHAR(255),
    race_name VARCHAR(255),
    race_date DATE,
    actual_gpx_filename VARCHAR(255),
    total_race_time_seconds INTEGER,
    total_actual_distance_meters DECIMAL(10,2),
    race_start_time TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP,
    waypoint_count INTEGER,
    track_point_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ra.id,
        ra.route_id,
        r.name as route_name,
        ra.race_name,
        ra.race_date,
        ra.actual_gpx_filename,
        ra.total_race_time_seconds,
        ra.total_actual_distance_meters,
        ra.race_start_time,
        ra.notes,
        ra.created_at,
        COUNT(DISTINCT rwc.id)::INTEGER as waypoint_count,
        COUNT(DISTINCT rtp.id)::INTEGER as track_point_count
    FROM race_analyses ra
    JOIN routes r ON ra.route_id = r.id
    LEFT JOIN race_waypoint_comparisons rwc ON ra.id = rwc.race_analysis_id
    LEFT JOIN race_track_points rtp ON ra.id = rtp.race_analysis_id
    WHERE ra.user_id = p_user_id
    GROUP BY ra.id, r.name
    ORDER BY ra.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get race analyses for a specific route
CREATE OR REPLACE FUNCTION get_route_race_analyses(p_route_id INTEGER, p_user_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    race_name VARCHAR(255),
    race_date DATE,
    actual_gpx_filename VARCHAR(255),
    total_race_time_seconds INTEGER,
    total_actual_distance_meters DECIMAL(10,2),
    race_start_time TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP,
    waypoint_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ra.id,
        ra.race_name,
        ra.race_date,
        ra.actual_gpx_filename,
        ra.total_race_time_seconds,
        ra.total_actual_distance_meters,
        ra.race_start_time,
        ra.notes,
        ra.created_at,
        COUNT(DISTINCT rwc.id)::INTEGER as waypoint_count
    FROM race_analyses ra
    LEFT JOIN race_waypoint_comparisons rwc ON ra.id = rwc.race_analysis_id
    WHERE ra.route_id = p_route_id AND ra.user_id = p_user_id
    GROUP BY ra.id
    ORDER BY ra.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to get detailed race analysis with comparisons
CREATE OR REPLACE FUNCTION get_race_analysis_detail(p_analysis_id INTEGER, p_user_id INTEGER)
RETURNS TABLE (
    -- Analysis info
    analysis_id INTEGER,
    route_id INTEGER,
    route_name VARCHAR(255),
    race_name VARCHAR(255),
    race_date DATE,
    actual_gpx_filename VARCHAR(255),
    total_race_time_seconds INTEGER,
    total_actual_distance_meters DECIMAL(10,2),
    race_start_time TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP,
    -- Waypoint comparison data
    comparison_data JSONB,
    track_points_data JSONB
) AS $$
DECLARE
    v_analysis_record RECORD;
    v_comparisons JSONB;
    v_track_points JSONB;
BEGIN
    -- Get analysis basic info
    SELECT ra.id, ra.route_id, r.name, ra.race_name, ra.race_date, ra.actual_gpx_filename,
           ra.total_race_time_seconds, ra.total_actual_distance_meters, ra.race_start_time,
           ra.notes, ra.created_at
    INTO v_analysis_record
    FROM race_analyses ra
    JOIN routes r ON ra.route_id = r.id
    WHERE ra.id = p_analysis_id AND ra.user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Get waypoint comparisons
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', rwc.id,
            'waypointId', rwc.waypoint_id,
            'waypointName', w.name,
            'waypointType', w.waypoint_type,
            'plannedCumulativeTime', rwc.planned_cumulative_time_seconds,
            'actualCumulativeTime', rwc.actual_cumulative_time_seconds,
            'timeDifference', rwc.time_difference_seconds,
            'legDuration', rwc.leg_duration_seconds,
            'legDistance', rwc.leg_distance_miles,
            'actualPace', rwc.actual_pace_seconds_per_mile,
            'plannedPace', rwc.planned_pace_seconds_per_mile
        ) ORDER BY w.order_index
    ) INTO v_comparisons
    FROM race_waypoint_comparisons rwc
    JOIN waypoints w ON rwc.waypoint_id = w.id
    WHERE rwc.race_analysis_id = p_analysis_id;
    
    -- Get track points
    SELECT jsonb_agg(
        jsonb_build_object(
            'lat', rtp.latitude,
            'lon', rtp.longitude,
            'elevation', rtp.elevation_meters,
            'cumulativeTime', rtp.race_time_seconds,
            'cumulativeDistance', rtp.cumulative_distance_meters
        ) ORDER BY rtp.point_order
    ) INTO v_track_points
    FROM race_track_points rtp
    WHERE rtp.race_analysis_id = p_analysis_id;
    
    -- Return the result
    RETURN QUERY
    SELECT 
        v_analysis_record.id,
        v_analysis_record.route_id,
        v_analysis_record.name,
        v_analysis_record.race_name,
        v_analysis_record.race_date,
        v_analysis_record.actual_gpx_filename,
        v_analysis_record.total_race_time_seconds,
        v_analysis_record.total_actual_distance_meters,
        v_analysis_record.race_start_time,
        v_analysis_record.notes,
        v_analysis_record.created_at,
        COALESCE(v_comparisons, '[]'::jsonb),
        COALESCE(v_track_points, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to delete race analysis
CREATE OR REPLACE FUNCTION delete_race_analysis(p_analysis_id INTEGER, p_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM race_analyses 
    WHERE id = p_analysis_id AND user_id = p_user_id;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    
    RETURN v_deleted > 0;
END;
$$ LANGUAGE plpgsql; 