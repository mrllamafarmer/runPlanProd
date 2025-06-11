-- Database Migration Script 002 - Comprehensive Schema Fixes
-- Adds all missing columns and fixes structural issues
-- Run this on existing databases to bring them up to the complete schema

-- Add missing columns to routes table
DO $$ 
BEGIN
    -- Add total_elevation_loss_meters column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' 
        AND column_name = 'total_elevation_loss_meters'
    ) THEN
        ALTER TABLE routes ADD COLUMN total_elevation_loss_meters REAL DEFAULT 0;
        RAISE NOTICE 'Added total_elevation_loss_meters column to routes table';
    ELSE
        RAISE NOTICE 'Column total_elevation_loss_meters already exists in routes table';
    END IF;
    
    -- Rename estimated_time_seconds to target_time_seconds if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' 
        AND column_name = 'estimated_time_seconds'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' 
        AND column_name = 'target_time_seconds'
    ) THEN
        ALTER TABLE routes RENAME COLUMN estimated_time_seconds TO target_time_seconds;
        RAISE NOTICE 'Renamed estimated_time_seconds to target_time_seconds in routes table';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' 
        AND column_name = 'target_time_seconds'
    ) THEN
        ALTER TABLE routes ADD COLUMN target_time_seconds INTEGER DEFAULT 0;
        RAISE NOTICE 'Added target_time_seconds column to routes table';
    ELSE
        RAISE NOTICE 'Column target_time_seconds already exists in routes table';
    END IF;
    
    -- Add has_valid_time column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' 
        AND column_name = 'has_valid_time'
    ) THEN
        ALTER TABLE routes ADD COLUMN has_valid_time BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added has_valid_time column to routes table';
    ELSE
        RAISE NOTICE 'Column has_valid_time already exists in routes table';
    END IF;
    
    -- Add using_target_time column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' 
        AND column_name = 'using_target_time'
    ) THEN
        ALTER TABLE routes ADD COLUMN using_target_time BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added using_target_time column to routes table';
    ELSE
        RAISE NOTICE 'Column using_target_time already exists in routes table';
    END IF;
END $$;

-- Add enhanced leg calculation columns to waypoints table
DO $$ 
BEGIN
    -- Add leg_number column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'waypoints' 
        AND column_name = 'leg_number'
    ) THEN
        ALTER TABLE waypoints ADD COLUMN leg_number INTEGER DEFAULT 0;
        RAISE NOTICE 'Added leg_number column to waypoints table';
    ELSE
        RAISE NOTICE 'Column leg_number already exists in waypoints table';
    END IF;
    
    -- Add distance_from_start_meters column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'waypoints' 
        AND column_name = 'distance_from_start_meters'
    ) THEN
        ALTER TABLE waypoints ADD COLUMN distance_from_start_meters REAL DEFAULT 0;
        RAISE NOTICE 'Added distance_from_start_meters column to waypoints table';
    ELSE
        RAISE NOTICE 'Column distance_from_start_meters already exists in waypoints table';
    END IF;
    
    -- Add cumulative_distance_meters column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'waypoints' 
        AND column_name = 'cumulative_distance_meters'
    ) THEN
        ALTER TABLE waypoints ADD COLUMN cumulative_distance_meters REAL DEFAULT 0;
        RAISE NOTICE 'Added cumulative_distance_meters column to waypoints table';
    ELSE
        RAISE NOTICE 'Column cumulative_distance_meters already exists in waypoints table';
    END IF;
    
    -- Add elevation gain/loss columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'waypoints' 
        AND column_name = 'elevation_gain_from_previous'
    ) THEN
        ALTER TABLE waypoints ADD COLUMN elevation_gain_from_previous REAL DEFAULT 0;
        RAISE NOTICE 'Added elevation_gain_from_previous column to waypoints table';
    ELSE
        RAISE NOTICE 'Column elevation_gain_from_previous already exists in waypoints table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'waypoints' 
        AND column_name = 'elevation_loss_from_previous'
    ) THEN
        ALTER TABLE waypoints ADD COLUMN elevation_loss_from_previous REAL DEFAULT 0;
        RAISE NOTICE 'Added elevation_loss_from_previous column to waypoints table';
    ELSE
        RAISE NOTICE 'Column elevation_loss_from_previous already exists in waypoints table';
    END IF;
    
    -- Add cumulative elevation columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'waypoints' 
        AND column_name = 'cumulative_elevation_gain'
    ) THEN
        ALTER TABLE waypoints ADD COLUMN cumulative_elevation_gain REAL DEFAULT 0;
        RAISE NOTICE 'Added cumulative_elevation_gain column to waypoints table';
    ELSE
        RAISE NOTICE 'Column cumulative_elevation_gain already exists in waypoints table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'waypoints' 
        AND column_name = 'cumulative_elevation_loss'
    ) THEN
        ALTER TABLE waypoints ADD COLUMN cumulative_elevation_loss REAL DEFAULT 0;
        RAISE NOTICE 'Added cumulative_elevation_loss column to waypoints table';
    ELSE
        RAISE NOTICE 'Column cumulative_elevation_loss already exists in waypoints table';
    END IF;
    
    -- Add pace and duration columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'waypoints' 
        AND column_name = 'leg_pace_seconds'
    ) THEN
        ALTER TABLE waypoints ADD COLUMN leg_pace_seconds REAL DEFAULT 0;
        RAISE NOTICE 'Added leg_pace_seconds column to waypoints table';
    ELSE
        RAISE NOTICE 'Column leg_pace_seconds already exists in waypoints table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'waypoints' 
        AND column_name = 'duration_seconds'
    ) THEN
        ALTER TABLE waypoints ADD COLUMN duration_seconds REAL DEFAULT 0;
        RAISE NOTICE 'Added duration_seconds column to waypoints table';
    ELSE
        RAISE NOTICE 'Column duration_seconds already exists in waypoints table';
    END IF;
END $$;

-- Enhance track_points table structure
DO $$ 
BEGIN
    -- Add route_id column if it doesn't exist (for direct route linking)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'track_points' 
        AND column_name = 'route_id'
    ) THEN
        -- Add the column first
        ALTER TABLE track_points ADD COLUMN route_id INTEGER;
        
        -- Populate it from existing route_segment relationships
        UPDATE track_points 
        SET route_id = rs.route_id 
        FROM route_segments rs 
        WHERE track_points.route_segment_id = rs.id;
        
        -- Add the foreign key constraint
        ALTER TABLE track_points ADD CONSTRAINT fk_track_points_route_id 
            FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;
            
        RAISE NOTICE 'Added route_id column to track_points table and populated from route_segments';
    ELSE
        RAISE NOTICE 'Column route_id already exists in track_points table';
    END IF;
    
    -- Add cumulative_distance_meters column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'track_points' 
        AND column_name = 'cumulative_distance_meters'
    ) THEN
        ALTER TABLE track_points ADD COLUMN cumulative_distance_meters REAL DEFAULT 0;
        -- Copy data from distance_from_segment_start_meters if it exists
        UPDATE track_points SET cumulative_distance_meters = distance_from_segment_start_meters;
        RAISE NOTICE 'Added cumulative_distance_meters column to track_points table';
    ELSE
        RAISE NOTICE 'Column cumulative_distance_meters already exists in track_points table';
    END IF;
    
    -- Rename distance_from_segment_start_meters to distance_from_start_meters if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'track_points' 
        AND column_name = 'distance_from_segment_start_meters'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'track_points' 
        AND column_name = 'distance_from_start_meters'
    ) THEN
        ALTER TABLE track_points RENAME COLUMN distance_from_segment_start_meters TO distance_from_start_meters;
        RAISE NOTICE 'Renamed distance_from_segment_start_meters to distance_from_start_meters in track_points table';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'track_points' 
        AND column_name = 'distance_from_start_meters'
    ) THEN
        ALTER TABLE track_points ADD COLUMN distance_from_start_meters REAL DEFAULT 0;
        RAISE NOTICE 'Added distance_from_start_meters column to track_points table';
    ELSE
        RAISE NOTICE 'Column distance_from_start_meters already exists in track_points table';
    END IF;
    
    -- Add time_offset_seconds column if it doesn't exist
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
END $$;

-- Update indexes for the new structure
DO $$
BEGIN
    -- Add index for track_points.route_id if it doesn't exist
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
    
    -- Update the existing track_points order index to use route_id
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'track_points' 
        AND indexname = 'idx_track_points_order'
    ) THEN
        DROP INDEX IF EXISTS idx_track_points_order;
        CREATE INDEX idx_track_points_order ON track_points(route_id, point_index);
        RAISE NOTICE 'Updated idx_track_points_order index to use route_id';
    ELSE
        CREATE INDEX idx_track_points_order ON track_points(route_id, point_index);
        RAISE NOTICE 'Created idx_track_points_order index';
    END IF;
END $$;

-- Verify the schema is complete
RAISE NOTICE 'Migration complete! Verifying schema...';

-- Show the updated table structures
SELECT 'ROUTES TABLE COLUMNS:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'routes'
ORDER BY ordinal_position;

SELECT 'WAYPOINTS TABLE COLUMNS:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'waypoints'
ORDER BY ordinal_position;

SELECT 'TRACK_POINTS TABLE COLUMNS:' as info;
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'track_points'
ORDER BY ordinal_position; 