# Waypoint Features Documentation

## Overview

The route planning application now supports comprehensive waypoint management with enhanced features for multiday races and detailed route planning.

## Features Implemented

### ✅ Interactive Waypoint Creation
- **Click-to-create**: Click anywhere on the map to add waypoints
- **Smart positioning**: Waypoints are automatically inserted in the correct order along the route
- **Real-time updates**: Changes are immediately saved to the database

### ✅ Waypoint Editing Modal
- **Comprehensive editing**: Edit all waypoint properties in a user-friendly modal
- **Form validation**: Input validation with helpful error messages
- **Real-time preview**: Changes are reflected immediately on the map

### ✅ Waypoint Properties

#### Name and Description
- **Custom naming**: Rename waypoints to meaningful names (e.g., "Aid Station 1", "Mountain Summit")
- **Notes field**: Add detailed descriptions and notes for each waypoint
- **Character limits**: Name limited to 100 characters, description to 500 characters

#### Waypoint Types
- **Start**: Race/route starting point (green marker with "S")
- **Checkpoint**: Intermediate waypoints (blue marker with "C") 
- **Finish**: Race/route ending point (red marker with "F")
- **Point of Interest**: Notable locations (orange marker with "P")

#### Rest Time Support
- **MM:SS format**: Enter rest time in minutes:seconds format (e.g., "15:30" for 15 minutes 30 seconds)
- **No limits**: Supports multiday races with extended rest periods (e.g., "480:00" for 8 hours)
- **Flexible input**: Accepts any duration from seconds to days
- **Display formatting**: Shows rest time in human-readable format (e.g., "8h 30m")

### ✅ Map Integration
- **Visual markers**: Different colored icons for each waypoint type
- **Draggable waypoints**: Drag waypoints to new positions on the map
- **Interactive popups**: Click waypoints to see details and access edit/delete options
- **Rest time display**: Popup shows formatted rest time for each waypoint

### ✅ API Integration
- **RESTful endpoints**: Full CRUD operations for waypoints
- **Real-time sync**: Changes are immediately synchronized with the backend
- **Error handling**: Comprehensive error handling with user-friendly messages
- **Authentication**: Secure waypoint operations with user authentication

## Technical Implementation

### Backend Changes

#### Database Schema
```sql
-- Added rest_time_seconds column to waypoints table
ALTER TABLE waypoints ADD COLUMN rest_time_seconds INTEGER DEFAULT 0;
```

#### API Endpoints
- `POST /api/routes/{route_id}/waypoints` - Create waypoint
- `PUT /api/waypoints/{waypoint_id}` - Update waypoint
- `DELETE /api/waypoints/{waypoint_id}` - Delete waypoint
- `GET /api/routes/{route_id}/waypoints` - Get route waypoints

#### Models Updated
- `WaypointCreate` - Added `rest_time_seconds` field
- `WaypointUpdate` - Added `rest_time_seconds` field  
- `WaypointDB` - Added `rest_time_seconds` field

### Frontend Changes

#### New Components
- `WaypointEditModal.tsx` - Modal for editing waypoint properties
- Time utility functions in `timeUtils.ts`

#### Updated Components
- `MapVisualization.tsx` - Enhanced with waypoint creation and editing
- `types/index.ts` - Updated interfaces for rest time support

#### Time Utilities
```typescript
// Convert seconds to MM:SS format
secondsToMMSS(seconds: number): string

// Convert MM:SS format to seconds  
mmssToSeconds(timeString: string): number

// Validate MM:SS format
isValidMMSS(timeString: string): boolean

// Format rest time for display
formatRestTime(seconds: number): string
```

## Usage Examples

### Creating Waypoints
1. Click "Add Waypoints" button on the map
2. Click anywhere on the map to create a waypoint
3. Waypoint is automatically positioned in the correct order
4. Edit the waypoint to add name, description, and rest time

### Editing Waypoints
1. Click on any waypoint marker on the map
2. Click "Edit" in the popup
3. Modify properties in the edit modal:
   - **Name**: "Aid Station 1"
   - **Type**: "Checkpoint"
   - **Rest Time**: "15:00" (15 minutes)
   - **Notes**: "Water and snacks available"
4. Click "Save Changes"

### Rest Time Examples
- `00:30` - 30 seconds
- `05:00` - 5 minutes
- `15:30` - 15 minutes 30 seconds
- `60:00` - 1 hour
- `480:00` - 8 hours (overnight rest)
- `1440:00` - 24 hours (full day rest)

## Migration

### Existing Databases
Run the migration script to add rest time support:
```sql
-- See backend/database_migration_add_rest_time.sql
ALTER TABLE waypoints ADD COLUMN rest_time_seconds INTEGER DEFAULT 0;
```

### Testing
Run the comprehensive test script:
```bash
python backend/test_waypoint_rest_time.py
```

## Future Enhancements

### Planned Features
- [ ] Drag-and-drop waypoint reordering
- [ ] Bulk waypoint operations
- [ ] Waypoint import/export
- [ ] Waypoint templates for common race types
- [ ] Elevation-based rest time suggestions

### Potential Improvements
- [ ] Waypoint categories (aid station, water stop, etc.)
- [ ] Waypoint photos and attachments
- [ ] Collaborative waypoint editing
- [ ] Waypoint sharing between users
- [ ] Integration with external POI databases

## Support

For issues or questions about waypoint functionality:
1. Check the test script for usage examples
2. Review the API documentation
3. Examine the frontend components for implementation details
4. Refer to the database schema for data structure

The waypoint system is designed to be flexible and extensible, supporting everything from short recreational routes to complex multiday ultramarathons. 