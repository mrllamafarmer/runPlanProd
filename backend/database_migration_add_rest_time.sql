-- Migration script to add rest_time_seconds column to waypoints table
-- Run this script on existing databases to add the new rest time functionality

-- Add rest_time_seconds column to waypoints table
ALTER TABLE waypoints ADD COLUMN rest_time_seconds INTEGER DEFAULT 0;

-- Update any existing waypoints to have 0 rest time by default
UPDATE waypoints SET rest_time_seconds = 0 WHERE rest_time_seconds IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN waypoints.rest_time_seconds IS 'Rest time in seconds (supports multiday races with no limit)';

-- Verify the migration
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'waypoints' AND column_name = 'rest_time_seconds'; 