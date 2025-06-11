-- Database Migration Script 001
-- Adds missing columns that were added after initial deployment
-- Run this on existing databases that were created before the schema was complete

-- Add missing columns to routes table
DO $$ 
BEGIN
    -- Add slowdown_factor_percent column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' 
        AND column_name = 'slowdown_factor_percent'
    ) THEN
        ALTER TABLE routes ADD COLUMN slowdown_factor_percent REAL DEFAULT 0;
        RAISE NOTICE 'Added slowdown_factor_percent column to routes table';
    ELSE
        RAISE NOTICE 'Column slowdown_factor_percent already exists in routes table';
    END IF;
    
    -- Add start_time column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'routes' 
        AND column_name = 'start_time'
    ) THEN
        ALTER TABLE routes ADD COLUMN start_time TIME;
        RAISE NOTICE 'Added start_time column to routes table';
    ELSE
        RAISE NOTICE 'Column start_time already exists in routes table';
    END IF;
END $$;

-- Verify the schema is complete
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('users', 'routes', 'waypoints', 'route_segments', 'track_points', 'gpx_files')
ORDER BY table_name, ordinal_position; 