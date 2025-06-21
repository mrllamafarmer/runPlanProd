-- Database Migration Script 004 - Fix Track Points Table Structure
-- Fixes the route_segment_id constraint issue and aligns with current schema
-- Run this on existing databases to fix track_points table structure

DO $$ 
BEGIN
    -- Check if route_segment_id column exists and make it nullable if it does
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'track_points' 
        AND column_name = 'route_segment_id'
    ) THEN
        -- Make route_segment_id nullable since we now use route_id for direct linking
        ALTER TABLE track_points ALTER COLUMN route_segment_id DROP NOT NULL;
        RAISE NOTICE 'Made route_segment_id nullable in track_points table';
    ELSE
        RAISE NOTICE 'Column route_segment_id does not exist in track_points table';
    END IF;
    
    -- Check if distance_from_segment_start_meters exists and make it nullable if it does
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'track_points' 
        AND column_name = 'distance_from_segment_start_meters'
    ) THEN
        -- Make distance_from_segment_start_meters nullable for backward compatibility
        ALTER TABLE track_points ALTER COLUMN distance_from_segment_start_meters DROP NOT NULL;
        RAISE NOTICE 'Made distance_from_segment_start_meters nullable in track_points table';
    ELSE
        RAISE NOTICE 'Column distance_from_segment_start_meters does not exist in track_points table';
    END IF;
    
    -- Ensure route_id column exists and is properly configured
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'track_points' 
        AND column_name = 'route_id'
    ) THEN
        -- Add route_id column for direct route linking
        ALTER TABLE track_points ADD COLUMN route_id INTEGER;
        
        -- Populate it from existing route_segment relationships if they exist
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'track_points' 
            AND column_name = 'route_segment_id'
        ) THEN
            UPDATE track_points 
            SET route_id = rs.route_id 
            FROM route_segments rs 
            WHERE track_points.route_segment_id = rs.id;
        END IF;
        
        -- Add the foreign key constraint
        ALTER TABLE track_points ADD CONSTRAINT fk_track_points_route_id 
            FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;
            
        RAISE NOTICE 'Added route_id column to track_points table';
    ELSE
        RAISE NOTICE 'Column route_id already exists in track_points table';
    END IF;
    
    -- Ensure cumulative_distance_meters column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'track_points' 
        AND column_name = 'cumulative_distance_meters'
    ) THEN
        ALTER TABLE track_points ADD COLUMN cumulative_distance_meters REAL DEFAULT 0;
        -- Copy data from distance_from_start_meters if it exists
        UPDATE track_points SET cumulative_distance_meters = distance_from_start_meters;
        RAISE NOTICE 'Added cumulative_distance_meters column to track_points table';
    ELSE
        RAISE NOTICE 'Column cumulative_distance_meters already exists in track_points table';
    END IF;
    
    -- Ensure distance_from_start_meters column exists (modern schema)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'track_points' 
        AND column_name = 'distance_from_start_meters'
    ) THEN
        ALTER TABLE track_points ADD COLUMN distance_from_start_meters REAL DEFAULT 0;
        -- Copy data from cumulative_distance_meters if it exists
        UPDATE track_points SET distance_from_start_meters = cumulative_distance_meters;
        RAISE NOTICE 'Added distance_from_start_meters column to track_points table';
    ELSE
        RAISE NOTICE 'Column distance_from_start_meters already exists in track_points table';
    END IF;
    
    -- Ensure time_offset_seconds column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'track_points' 
        AND column_name = 'time_offset_seconds'
    ) THEN
        ALTER TABLE track_points ADD COLUMN time_offset_seconds INTEGER DEFAULT 0;
        RAISE NOTICE 'Added time_offset_seconds column to track_points table';
    ELSE
        RAISE NOTICE 'Column time_offset_seconds already exists in track_points table';
    END IF;
    
    -- Create indexes if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'track_points' 
        AND indexname = 'idx_track_points_route_id'
    ) THEN
        CREATE INDEX idx_track_points_route_id ON track_points(route_id);
        RAISE NOTICE 'Created index idx_track_points_route_id';
    ELSE
        RAISE NOTICE 'Index idx_track_points_route_id already exists';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'track_points' 
        AND indexname = 'idx_track_points_order'
    ) THEN
        CREATE INDEX idx_track_points_order ON track_points(route_id, point_index);
        RAISE NOTICE 'Created index idx_track_points_order';
    ELSE
        RAISE NOTICE 'Index idx_track_points_order already exists';
    END IF;
    
END $$;

-- Comments for documentation
COMMENT ON COLUMN track_points.route_segment_id IS 'Legacy column - nullable for backward compatibility. Use route_id for direct route linking.';
COMMENT ON COLUMN track_points.distance_from_segment_start_meters IS 'Legacy column - nullable for backward compatibility. Use distance_from_start_meters.';
COMMENT ON COLUMN track_points.route_id IS 'Direct reference to route - preferred over route_segment_id';
COMMENT ON COLUMN track_points.distance_from_start_meters IS 'Distance from route start to this point (modern schema)';
COMMENT ON COLUMN track_points.cumulative_distance_meters IS 'Total distance from route start to this point (same as distance_from_start_meters)';
COMMENT ON COLUMN track_points.time_offset_seconds IS 'Time offset from route start (for GPX time data)'; 