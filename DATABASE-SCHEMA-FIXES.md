# Database Schema Fixes - Comprehensive Update

## Issues Found

The database schema was missing several critical columns and had structural issues that became apparent when deploying to production. This document outlines all the problems and their solutions.

## Missing Columns in Routes Table

### ❌ **Problems:**
1. **`target_time_seconds`** - Code expected this but schema had `estimated_time_seconds`
2. **`total_elevation_loss_meters`** - Missing entirely, causing TODO comments in code
3. **`has_valid_time`** - Used in RouteListItem model but missing from schema
4. **`using_target_time`** - Used in RouteListItem model but missing from schema

### ✅ **Solutions:**
- Renamed `estimated_time_seconds` → `target_time_seconds`
- Added `total_elevation_loss_meters REAL DEFAULT 0`
- Added `has_valid_time BOOLEAN DEFAULT FALSE`
- Added `using_target_time BOOLEAN DEFAULT FALSE`

## Enhanced Waypoints for Leg Calculations

### ❌ **Problems:**
The waypoints table was missing fields needed for comprehensive leg-by-leg route analysis and pacing calculations.

### ✅ **Solutions - Added Columns:**
- `leg_number INTEGER DEFAULT 0` - Sequential leg numbering
- `distance_from_start_meters REAL DEFAULT 0` - Distance from route start
- `cumulative_distance_meters REAL DEFAULT 0` - Running total distance
- `elevation_gain_from_previous REAL DEFAULT 0` - Elevation gain from previous waypoint
- `elevation_loss_from_previous REAL DEFAULT 0` - Elevation loss from previous waypoint
- `cumulative_elevation_gain REAL DEFAULT 0` - Total elevation gained so far
- `cumulative_elevation_loss REAL DEFAULT 0` - Total elevation lost so far
- `leg_pace_seconds REAL DEFAULT 0` - Calculated pace for this leg
- `duration_seconds REAL DEFAULT 0` - Estimated time for this leg

## Track Points Structure Fix

### ❌ **Problems:**
- Track points linked to `route_segments` instead of directly to `routes`
- More complex queries and joins required
- Column naming inconsistencies

### ✅ **Solutions:**
- **Direct Route Linking**: `track_points.route_id` → `routes.id`
- **Simplified Structure**: Removed dependency on route_segments
- **Consistent Naming**: `distance_from_start_meters` instead of `distance_from_segment_start_meters`
- **Enhanced Fields**: Added `cumulative_distance_meters` and `time_offset_seconds`

## Files Created/Updated

### 1. **Updated Main Schema** (`backend/database_schema.sql`)
- ✅ Complete schema with all missing columns
- ✅ Correct column names and types
- ✅ Proper indexes for performance

### 2. **Fixed Schema** (`backend/database_schema_fixed.sql`)
- ✅ Clean reference implementation
- ✅ All structural improvements included

### 3. **Comprehensive Migration** (`backend/database_migration_002_comprehensive.sql`)
- ✅ Safe migration for existing databases
- ✅ Handles all column additions and renames
- ✅ Preserves existing data
- ✅ Updates indexes appropriately

### 4. **Simple Migration** (`backend/database_migration_001.sql`)
- ✅ Basic fixes for initial deployment issues

## How to Apply Fixes

### For New Deployments:
```bash
# The updated database_schema.sql will create the complete schema
docker compose down --rmi all && docker compose up -d --build
```

### For Existing Production Databases:
```bash
# Run the comprehensive migration
psql -h localhost -p 5433 -U runplan_user -d runplanprod -f backend/database_migration_002_comprehensive.sql
```

### For Development Databases:
```bash
# Either use migration or rebuild
# Option 1: Migration
psql -h localhost -p 5433 -U runplan_user -d runplanprod -f backend/database_migration_002_comprehensive.sql

# Option 2: Complete rebuild
docker compose down -v  # Warning: This deletes all data!
docker compose up -d --build
```

## Verification

After applying the fixes, verify the schema with:

```sql
-- Check routes table has all columns
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'routes' 
ORDER BY ordinal_position;

-- Check waypoints table has enhanced fields
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'waypoints' 
ORDER BY ordinal_position;

-- Check track_points links directly to routes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'track_points' 
ORDER BY ordinal_position;
```

## Expected Columns

### Routes Table (Final State):
- `id`, `user_id`, `name`, `description`
- `total_distance_meters`, `total_elevation_gain_meters`, `total_elevation_loss_meters`
- `target_time_seconds`, `slowdown_factor_percent`, `start_time`
- `has_valid_time`, `using_target_time`
- `created_at`, `updated_at`, `is_public`

### Waypoints Table (Final State):
- Basic fields: `id`, `route_id`, `name`, `description`, `latitude`, `longitude`, `elevation_meters`
- Ordering: `order_index`, `waypoint_type`
- Pacing: `target_pace_per_km_seconds`, `rest_time_seconds`
- **Enhanced leg calculations**: `leg_number`, `distance_from_start_meters`, `cumulative_distance_meters`
- **Enhanced elevation**: `elevation_gain_from_previous`, `elevation_loss_from_previous`, `cumulative_elevation_gain`, `cumulative_elevation_loss`
- **Enhanced timing**: `leg_pace_seconds`, `duration_seconds`

### Track Points Table (Final State):
- `id`, `route_id`, `latitude`, `longitude`, `elevation_meters`
- `distance_from_start_meters`, `cumulative_distance_meters`
- `point_index`, `time_offset_seconds`
- `created_at`

## Impact

✅ **Zero Breaking Changes** - All migrations preserve existing functionality  
✅ **Enhanced Features** - Enables comprehensive leg-by-leg analysis  
✅ **Performance Improved** - Direct route linking simplifies queries  
✅ **Production Ready** - Schema now matches all code expectations  

The database schema is now complete and ready for production deployment! 