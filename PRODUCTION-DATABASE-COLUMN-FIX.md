# Production Database Column Mapping Fix

## Issue Identified
In production, slowdown % and start times for routes were not being saved due to column name mismatches between the application code and the actual database schema.

## Root Cause
The production database contains BOTH `estimated_time_seconds` and `target_time_seconds` columns. The migration logic created the new `target_time_seconds` column but did not rename the existing `estimated_time_seconds` column, leaving both in the database.

The application code was updated to use `target_time_seconds`, but the production database is still actively using `estimated_time_seconds`.

## Problem Details

### Database State
- ✅ `estimated_time_seconds` column exists (original, actively used)
- ✅ `target_time_seconds` column exists (added by migration, not used)
- ❓ `slowdown_factor_percent` column may not exist (migration not run)
- ❓ `start_time` column may not exist (migration not run)

### Application Code Issues
- **BEFORE**: Code tried to update `target_time_seconds` column
- **PROBLEM**: Production uses `estimated_time_seconds` column
- **RESULT**: Target time updates were ignored

## Solution Applied

### Updated Field Mapping
```python
# BEFORE:
field_mapping = {
    'target_time_seconds': 'target_time_seconds',  # ❌ Wrong column in production
}

# AFTER:
field_mapping = {
    'target_time_seconds': 'estimated_time_seconds',  # ✅ Correct column in production
}
```

### Functions Updated
1. **`update_route_data()`**: Fixed field mapping to use `estimated_time_seconds`
2. **`get_route_detail()`**: Updated to read from `estimated_time_seconds`
3. **`get_user_routes()`**: Updated to read from `estimated_time_seconds`
4. **`save_route_data()`**: Updated to insert into `estimated_time_seconds`

## Files Modified
- `backend/database.py` - Fixed all database column references

## What This Fixes
- ✅ Target time (race completion time) now saves properly
- ✅ Target time displays correctly when loading routes
- ✅ Route updates include target time changes
- ❓ Slowdown % and start time (pending column verification)

## Next Steps for Complete Fix

If `slowdown_factor_percent` and `start_time` columns don't exist in production:

1. **Run Migration 001** (adds these columns):
   ```sql
   \i backend/database_migration_001.sql
   ```

2. **Or add columns manually**:
   ```sql
   ALTER TABLE routes ADD COLUMN slowdown_factor_percent REAL DEFAULT 0;
   ALTER TABLE routes ADD COLUMN start_time TIME;
   ```

## Verification Commands

Check which columns exist in production:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'routes' 
AND column_name IN ('estimated_time_seconds', 'target_time_seconds', 'slowdown_factor_percent', 'start_time')
ORDER BY column_name;
```

## Long-term Solution
Once all functionality is verified working with `estimated_time_seconds`, consider:
1. Migrating data from `estimated_time_seconds` to `target_time_seconds`
2. Dropping the `estimated_time_seconds` column
3. Updating code back to use `target_time_seconds`

For now, using `estimated_time_seconds` maintains backward compatibility with production. 