-- Migration: Fix get_race_analysis_detail function ORDER BY issue
-- Date: 2024-12-19
-- Description: Move ORDER BY clause inside jsonb_agg() to fix PostgreSQL aggregation error

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
    
    -- Get waypoint comparisons (ORDER BY moved inside jsonb_agg)
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